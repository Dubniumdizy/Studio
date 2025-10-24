"use client"

import { useEffect, useState } from "react"

type Animal = {
  id: string
  x: number // 0..1
  y: number // 0..1
  emoji: string
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
}

export function DancingAnimals({
  elapsedSeconds,
  totalSeconds,
  isComplete,
  onCakePartyDone,
}: {
  elapsedSeconds: number
  totalSeconds: number
  isComplete: boolean
  onCakePartyDone?: () => void
}) {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [showCake, setShowCake] = useState(false)
  const animalEmojis = ["🐶", "🐱", "🐰", "🐹", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🦊", "🐷", "🐮", "🐔", "🦆", "🐧", "🦉", "🐺", "🦄"]

  // Add one animal at the start of each minute (at 0, 60, 120, etc seconds)
  useEffect(() => {
    const minutesStarted = Math.ceil(elapsedSeconds / 60)
    const currentAnimalCount = animals.length
    
    if (minutesStarted > currentAnimalCount) {
      // Use modulo to cycle through emojis if we have more minutes than unique animals
      const emojiIndex = (minutesStarted - 1) % animalEmojis.length
      const newAnimal: Animal = {
        id: `animal-${Date.now()}-${Math.random()}`,
        x: 0.1 + Math.random() * 0.8,
        y: 0.3 + Math.random() * 0.4,
        emoji: animalEmojis[emojiIndex],
        vx: (Math.random() - 0.5) * 0.001,
        vy: (Math.random() - 0.5) * 0.001,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 2,
      }
      setAnimals(prev => [...prev, newAnimal])
    }
  }, [elapsedSeconds, animals.length, animalEmojis])

  // Animate animals bouncing around
  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(() => {
      setAnimals(prev =>
        prev.map(animal => {
          let { x, y, vx, vy, rotation, rotSpeed } = animal

          // Update position
          x += vx
          y += vy

          // Bounce off edges
          if (x <= 0 || x >= 0.95) vx *= -1
          if (y <= 0 || y >= 0.9) vy *= -1

          // Keep in bounds
          x = Math.max(0, Math.min(0.95, x))
          y = Math.max(0, Math.min(0.9, y))

          // Rotate
          rotation = (rotation + rotSpeed) % 360
          
          return {
            ...animal,
            x,
            y,
            vx,
            vy,
            rotation,
            rotSpeed,
          }
        })
      )
    }, 50)

    return () => clearInterval(interval)
  }, [elapsedSeconds, totalSeconds, isComplete])

  // Show cake party in last 15 seconds OR when complete
  useEffect(() => {
    const timeLeft = totalSeconds - elapsedSeconds
    if (isComplete || (timeLeft <= 15 && timeLeft > 0)) {
      setShowCake(true)
    }
    
    if (isComplete) {
      const timeout = setTimeout(() => {
        onCakePartyDone?.()
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [isComplete, elapsedSeconds, totalSeconds, onCakePartyDone])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        @keyframes cake-appear {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes happy-jump {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.15); }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Confetti when cake appears */}
      {showCake && (
        <>
          {[...Array(30)].map((_, i) => (
            <div
              key={`confetti-${i}`}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: -20,
                animation: `confetti-fall ${2 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                fontSize: '20px',
              }}
            >
              {['🎉', '🎊', '✨', '⭐', '🌟'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </>
      )}

      {/* Dancing animals */}
      {animals.map((animal) => {
        const left = `${animal.x * 100}%`
        const top = `${animal.y * 100}%`

        return (
          <div
            key={animal.id}
            className="absolute transition-all duration-100"
            style={{
              left,
              top,
              transform: `rotate(${animal.rotation}deg)`,
              animation: showCake
                ? 'happy-jump 0.8s ease-in-out infinite'
                : 'bounce 2s ease-in-out infinite',
              fontSize: showCake ? '48px' : '32px',
            }}
          >
            {animal.emoji}
          </div>
        )
      })}

      {/* Cake in center when complete */}
      {showCake && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            animation: 'cake-appear 0.8s ease-out',
            fontSize: '120px',
          }}
        >
          🎂
        </div>
      )}

      {/* Completion message */}
      {showCake && (
        <div
          className="absolute left-1/2 bottom-20 -translate-x-1/2 bg-white/95 px-8 py-4 rounded-2xl shadow-2xl border-4 border-yellow-400"
          style={{
            animation: 'cake-appear 1s ease-out',
          }}
        >
          <h2 className="text-3xl font-bold text-green-600 text-center">
            🎉 Party Time! 🎉
          </h2>
          <p className="text-xl text-gray-700 text-center mt-2">
            Everyone gets cake because you finished! 🍰
          </p>
        </div>
      )}
    </div>
  )
}

// Sad message component for early stop
export function SadAnimalsMessage({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center relative animate-in fade-in zoom-in duration-300">
        <style>{`
          @keyframes sad-sway {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
          }
          @keyframes tear-drop {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(30px); opacity: 0; }
          }
        `}</style>
        
        {/* Sad animals */}
        <div className="flex justify-center gap-4 mb-6" style={{ animation: 'sad-sway 2s ease-in-out infinite' }}>
          <span className="text-5xl">😢</span>
          <span className="text-5xl">😿</span>
          <span className="text-5xl">😭</span>
        </div>

        {/* Tears */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 flex gap-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={`tear-${i}`}
              className="text-3xl"
              style={{
                animation: 'tear-drop 1.5s ease-in infinite',
                animationDelay: `${i * 0.3}s`,
              }}
            >
              💧
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold text-red-600 mb-4 mt-8">
          Oh no! No cake! 🚫🎂
        </h2>
        
        <p className="text-xl text-gray-700 mb-4">
          The animals are sad because you stopped early...
        </p>
        
        <p className="text-lg text-gray-600 mb-6">
          They won't get any cake at their party. 😢
        </p>

        <div className="text-6xl mb-6">🍰❌</div>

        <button
          onClick={onClose}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
