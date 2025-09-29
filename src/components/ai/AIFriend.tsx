'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LeafIcon } from '@/components/icons/leaf-icon'
import { studyAdvisor, type AIAdvice, type StudyContext } from '@/ai/flows/study-advisor'
import { notificationService } from '@/lib/notifications'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  type: 'ai' | 'user'
  content: string
  timestamp: Date
  advice?: AIAdvice
}

export function AIFriend() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [advice, setAdvice] = useState<AIAdvice[]>([])
  const [showAdvice, setShowAdvice] = useState(false)

  // Initialize AI friend with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'ai',
      content: "Hello! I'm your AI study companion 🌱 I'm here to help you with personalized study advice, motivation, and support. How can I assist you today?",
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
    generateInitialAdvice()
  }, [])

  const generateInitialAdvice = async () => {
    try {
      // Mock study context - in real app, this would come from user data
      const mockContext: StudyContext = {
        currentSubject: 'Mathematics',
        studyTime: 120,
        energyLevel: 4,
        recentSessions: [
          {
            id: '1',
            subject: 'Mathematics',
            duration: 45,
            energyLevel: 4,
            productivity: 0.8,
            notes: 'Focused on calculus problems',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
          }
        ],
        goals: [
          {
            id: '1',
            title: 'Complete Calculus Assignment',
            description: 'Finish all problems in Chapter 3',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            progress: 0.6,
            subject: 'Mathematics',
            priority: 'high'
          }
        ],
        analytics: {
          totalStudyTime: 480,
          averageSessionLength: 45,
          productivityTrend: 0.75,
          burnoutRisk: 0.3,
          subjectPerformance: { 'Mathematics': 0.8, 'Physics': 0.7 },
          studyStreak: 5,
          weeklyGoals: 3,
          weeklyAchievements: 2
        },
        currentTime: new Date()
      }

      studyAdvisor.setContext(mockContext)
      const advice = await studyAdvisor.getPersonalizedAdvice()
      setAdvice(advice)
    } catch (error) {
      console.error('Failed to generate advice:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(async () => {
      const response = await generateAIResponse(inputValue)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.content,
        timestamp: new Date(),
        advice: response.advice
      }

      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1000 + Math.random() * 2000) // Random delay for natural feel
  }

  const generateAIResponse = async (userInput: string): Promise<{ content: string; advice?: AIAdvice }> => {
    const input = userInput.toLowerCase()

    if (input.includes('advice') || input.includes('help') || input.includes('suggest')) {
      const recommendations = await studyAdvisor.getStudyRecommendations()
      return {
        content: `Here are some personalized recommendations for you:\n\n${recommendations.map(rec => `• ${rec}`).join('\n')}\n\nWould you like me to elaborate on any of these? 🌿`,
        advice: advice[0]
      }
    }

    if (input.includes('burnout') || input.includes('tired') || input.includes('exhausted')) {
      const tips = await studyAdvisor.getBurnoutPreventionTips()
      return {
        content: `I understand you're feeling tired. Here are some gentle tips to help you recharge:\n\n${tips.slice(0, 5).map(tip => `• ${tip}`).join('\n')}\n\nRemember, taking care of yourself is just as important as studying! 🌸`,
        advice: advice.find(a => a.type === 'warning')
      }
    }

    if (input.includes('motivation') || input.includes('encourage') || input.includes('inspire')) {
      return {
        content: "You're doing amazing! Every study session, no matter how small, is a step toward your goals. Your dedication and consistency are truly inspiring. Remember, the journey of learning is beautiful, just like a garden that grows with patience and care. Keep nurturing your knowledge! 🌱✨"
      }
    }

    if (input.includes('timer') || input.includes('study session')) {
      return {
        content: "Great idea! Using the study timer can help you stay focused and track your progress. I recommend starting with a 25-minute session and taking a 5-minute break. This Pomodoro technique works wonders for maintaining concentration! 🕐"
      }
    }

    if (input.includes('goal') || input.includes('target')) {
      return {
        content: "Setting and achieving goals is such a rewarding part of learning! I can help you break down big goals into smaller, manageable steps. What specific goal would you like to work on? Remember, every small step counts toward your bigger dreams! 🎯"
      }
    }

    // Default response
    const responses = [
      "That's an interesting thought! I'm here to support your learning journey. Is there anything specific about your studies you'd like to discuss? 🌿",
      "I appreciate you sharing that with me. Learning is a beautiful process, and I'm here to help make it as enjoyable as possible. What would you like to focus on today? ✨",
      "Thank you for reaching out! I'm your dedicated study companion, ready to help with advice, motivation, or just a friendly chat about your learning journey. What's on your mind? 🌱"
    ]

    return {
      content: responses[Math.floor(Math.random() * responses.length)]
    }
  }

  const getAdviceIcon = (type: AIAdvice['type']) => {
    switch (type) {
      case 'encouragement': return '🌱'
      case 'warning': return '⚠️'
      case 'suggestion': return '💡'
      case 'celebration': return '🎉'
      case 'strategy': return '📋'
      default: return '✨'
    }
  }

  const getAdviceColor = (type: AIAdvice['type']) => {
    switch (type) {
      case 'encouragement': return 'bg-green-50 border-green-200 text-green-800'
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'suggestion': return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'celebration': return 'bg-pink-50 border-pink-200 text-pink-800'
      case 'strategy': return 'bg-purple-50 border-purple-200 text-purple-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-800'
    }
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
        {/* Advice Panel */}
        {showAdvice && advice.length > 0 && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-green-200 shadow-sm">
            <h4 className="font-semibold text-green-800 flex items-center gap-2">
              <LeafIcon className="w-4 h-4" />
              Personalized Advice
            </h4>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {advice.slice(0, 3).map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm",
                      getAdviceColor(item.type)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{getAdviceIcon(item.type)}</span>
                      <div className="flex-1">
                        <h5 className="font-medium mb-1">{item.title}</h5>
                        <p className="text-xs opacity-80 mb-2">{item.message}</p>
                        <div className="space-y-1">
                          {item.actionItems.slice(0, 2).map((action, idx) => (
                            <div key={idx} className="text-xs flex items-center gap-1">
                              <span className="w-1 h-1 bg-current rounded-full opacity-60"></span>
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className="h-64 border border-green-200 rounded-lg bg-white p-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.type === 'ai' && (
                  <Avatar className="w-6 h-6 bg-green-100 border border-green-300">
                    <AvatarFallback className="bg-green-200 text-green-700 text-xs">
                      <LeafIcon className="w-3 h-3" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg text-sm",
                    message.type === 'user'
                      ? "bg-green-600 text-white"
                      : "bg-green-50 text-green-800 border border-green-200"
                  )}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.advice && (
                    <div className="mt-2 p-2 bg-white rounded border border-green-200">
                      <div className="text-xs font-medium text-green-700">
                        {getAdviceIcon(message.advice.type)} {message.advice.title}
                      </div>
                    </div>
                  )}
                </div>

                {message.type === 'user' && (
                  <Avatar className="w-6 h-6 bg-blue-100 border border-blue-300">
                    <AvatarFallback className="bg-blue-200 text-blue-700 text-xs">
                      You
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <Avatar className="w-6 h-6 bg-green-100 border border-green-300">
                  <AvatarFallback className="bg-green-200 text-green-700 text-xs">
                    <LeafIcon className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-green-50 text-green-800 border border-green-200 p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvice(!showAdvice)}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <LeafIcon className="w-4 h-4 mr-1" />
              {showAdvice ? 'Hide' : 'Show'} Advice
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInitialAdvice}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              Refresh Advice
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your studies..."
              className="flex-1 resize-none bg-white border-green-200 focus:border-green-400"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="bg-green-600 hover:bg-green-700 text-white px-4"
            >
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 