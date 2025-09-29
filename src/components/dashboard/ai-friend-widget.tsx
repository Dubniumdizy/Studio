'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LeafIcon } from '@/components/icons/leaf-icon'
import { studyAdvisor } from '@/ai/flows/study-advisor'
import { cn } from '@/lib/utils'

interface AIFriendWidgetProps {
  id: string
}

export function AIFriendWidget({ id }: AIFriendWidgetProps) {
  const [isTyping, setIsTyping] = useState(false)
  const [lastAdvice, setLastAdvice] = useState<string>('')
  const [showFullAdvice, setShowFullAdvice] = useState(false)

  const getQuickAdvice = async () => {
    setIsTyping(true)
    
    try {
      const recommendations = await studyAdvisor.getStudyRecommendations()
      const tips = await studyAdvisor.getBurnoutPreventionTips()
      
      const advice = recommendations.length > 0 
        ? recommendations[0] 
        : tips[0] || 'Take a short break and stay hydrated! 🌱'
      
      setLastAdvice(advice)
    } catch (error) {
      console.error('Failed to get advice:', error)
      setLastAdvice('Keep up the great work! Your dedication is inspiring. 🌿')
    }
    
    setIsTyping(false)
  }

  const getMotivationalMessage = () => {
    const messages = [
      "Ready to grow your knowledge garden? 🌱",
      "Every study session is a step toward your dreams! ✨",
      "Your brain is like a garden - nurture it daily! 🌿",
      "Time to plant some knowledge seeds! 🌱",
      "Let's make today's study session amazing! 🌟"
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }

  return (
    <Card className="h-full bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Avatar className="w-8 h-8 bg-green-100 border-2 border-green-300">
            <AvatarFallback className="bg-green-200 text-green-700">
              <LeafIcon className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          AI Study Companion
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
            Online
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Welcome Message */}
        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
          <p className="text-green-700 text-sm">
            {getMotivationalMessage()}
          </p>
        </div>

        {/* Quick Advice */}
        {lastAdvice && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div className="flex-1">
                <p className="text-sm text-green-800">
                  {showFullAdvice ? lastAdvice : lastAdvice.slice(0, 80) + '...'}
                </p>
                {lastAdvice.length > 80 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullAdvice(!showFullAdvice)}
                    className="text-xs text-green-600 hover:text-green-700 p-0 h-auto mt-1"
                  >
                    {showFullAdvice ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={getQuickAdvice}
            disabled={isTyping}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isTyping ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                Thinking...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LeafIcon className="w-4 h-4" />
                Get Study Advice
              </div>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full border-green-200 text-green-700 hover:bg-green-100"
            onClick={() => window.location.href = '/study-timer'}
          >
            Start Study Session
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-white rounded border border-green-200 text-center">
            <div className="font-medium text-green-800">Today's Goal</div>
            <div className="text-green-600">2 hours</div>
          </div>
          <div className="p-2 bg-white rounded border border-green-200 text-center">
            <div className="font-medium text-green-800">Streak</div>
            <div className="text-green-600">5 days</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 