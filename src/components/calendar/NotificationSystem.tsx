'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, BellOff, TestTube, Settings, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import type { Reminder, EnhancedCalendarEvent } from '@/types/enhanced-calendar'

interface NotificationSettings {
  enabled: boolean
  sound: boolean
  vibration: boolean
  desktop: boolean
  email: boolean
  emailAddress: string
  defaultReminderMinutes: number
}

interface NotificationTest {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  timestamp: Date
}

export function NotificationSystem() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    sound: true,
    vibration: false,
    desktop: true,
    email: false,
    emailAddress: user?.email || '',
    defaultReminderMinutes: 15
  })

  const [testNotifications, setTestNotifications] = useState<NotificationTest[]>([])
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Check notification permission on mount
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Update email address when user changes
  useEffect(() => {
    if (user?.email && user.email !== settings.emailAddress) {
      setSettings(prev => ({ ...prev, emailAddress: user.email }))
    }
  }, [user?.email, settings.emailAddress])

  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive notifications for your events.",
        })
      }
    }
  }

  const sendTestNotification = (type: 'success' | 'warning' | 'info' | 'error') => {
    const now = new Date();
    const testNotification: NotificationTest = {
      id: `test-${Date.now()}`,
      type,
      title: `Test ${type.charAt(0).toUpperCase() + type.slice(1)} Notification`,
      message: `This is a test ${type} notification sent at ${now.toLocaleTimeString()}`,
      timestamp: now
    };

    setTestNotifications(prev => [testNotification, ...prev.slice(0, 9)])

    // Send browser notification if permission granted
    if (permission === 'granted' && settings.enabled) {
      new Notification(testNotification.title, {
        body: testNotification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: testNotification.id,
        requireInteraction: type === 'error',
        silent: !settings.sound
      })
    }

    // Send email notification if enabled
    if (settings.email && settings.emailAddress) {
      sendEmailNotification(testNotification.title, testNotification.message)
    }

    // Show toast notification
    toast({
      title: testNotification.title,
      description: testNotification.message,
      variant: type === 'error' ? 'destructive' : 'default'
    })

    // Simulate vibration if enabled
    if (settings.vibration && 'vibrate' in navigator) {
      navigator.vibrate(200)
    }
  }

  const sendEventReminder = (eventTitle: string, minutes: number) => {
    const now = new Date();
    const reminderNotification: NotificationTest = {
      id: `reminder-${Date.now()}`,
      type: 'info',
      title: `Event Reminder: ${eventTitle}`,
      message: `Your event starts in ${minutes} minutes`,
      timestamp: now
    };

    setTestNotifications(prev => [reminderNotification, ...prev.slice(0, 9)])

    if (permission === 'granted' && settings.enabled) {
      new Notification(reminderNotification.title, {
        body: reminderNotification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: reminderNotification.id,
        requireInteraction: false,
        silent: !settings.sound
      })
    }

    // Send email notification if enabled
    if (settings.email && settings.emailAddress) {
      sendEmailNotification(reminderNotification.title, reminderNotification.message)
    }

    toast({
      title: reminderNotification.title,
      description: reminderNotification.message,
    })
  }

  // Send email notification
  const sendEmailNotification = async (subject: string, message: string) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: settings.emailAddress,
          subject: subject,
          message: message,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email notification')
      }

      console.log('Email notification sent successfully')
    } catch (error) {
      console.error('Error sending email notification:', error)
      toast({
        title: 'Email Notification Failed',
        description: 'Could not send email notification. Please check your email settings.',
        variant: 'destructive'
      })
    }
  }

  const clearTestNotifications = () => {
    setTestNotifications([])
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  // Bell sound functionality
  const playBellSound = () => {
    try {
      // Create audio context for bell sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Bell-like sound (combination of frequencies)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2)
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.warn('Could not play bell sound:', error)
    }
  }

  const triggerReminder = (reminder: Reminder, event: EnhancedCalendarEvent) => {
    // Play bell sound
    playBellSound()
    
    // Show notification
    toast({
      title: `Reminder: ${event.title}`,
      description: event.description || 'Event starting soon',
      duration: 10000,
    })
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Permission Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Browser Permission</Label>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' ? 'Notifications allowed' : 
                 permission === 'denied' ? 'Notifications blocked' : 
                 'Permission not requested'}
              </p>
            </div>
            <Badge variant={permission === 'granted' ? 'default' : 'secondary'}>
              {permission}
            </Badge>
          </div>

          {permission !== 'granted' && (
            <Button onClick={requestPermission} className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </Button>
          )}

          {/* Notification Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enable Notifications</Label>
              <Switch
                id="enabled"
                checked={settings.enabled}
                onCheckedChange={async (checked) => {
                  setSettings(prev => ({ ...prev, enabled: checked }))
                  if (checked && 'Notification' in window && Notification.permission !== 'granted') {
                    const result = await Notification.requestPermission()
                    if (result === 'granted') {
                      sendTestNotification('success')
                    }
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sound">Sound</Label>
              <Switch
                id="sound"
                checked={settings.sound}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, sound: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="vibration">Vibration</Label>
              <Switch
                id="vibration"
                checked={settings.vibration}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, vibration: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="desktop">Desktop Notifications</Label>
              <Switch
                id="desktop"
                checked={settings.desktop}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, desktop: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="email">Email Notifications</Label>
              <Switch
                id="email"
                checked={settings.email}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email: checked }))}
              />
            </div>
          </div>

          {/* Email Address Input */}
          {settings.email && (
            <div className="space-y-2">
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input
                id="emailAddress"
                type="email"
                value={settings.emailAddress}
                onChange={(e) => setSettings(prev => ({ ...prev, emailAddress: e.target.value }))}
                placeholder="Enter email address for notifications"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This email will be used for event reminders and notifications
              </p>
            </div>
          )}

          {/* Default Reminder Time */}
          <div className="space-y-2">
            <Label>Default Reminder Time</Label>
            <Select 
              value={settings.defaultReminderMinutes.toString()} 
              onValueChange={(value) => setSettings(prev => ({ ...prev, defaultReminderMinutes: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="1440">1 day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Test Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={() => sendTestNotification('success')}
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Success Test
            </Button>
            <Button 
              onClick={() => sendTestNotification('info')}
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Info className="h-4 w-4 mr-2" />
              Info Test
            </Button>
            <Button 
              onClick={() => sendTestNotification('warning')}
              variant="outline"
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Warning Test
            </Button>
            <Button 
              onClick={() => sendTestNotification('error')}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Error Test
            </Button>
          </div>

          {/* Event Reminder Test */}
          <div className="space-y-2">
            <Label>Test Event Reminder</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Event title" 
                defaultValue="Study Session"
                id="testEventTitle"
              />
              <Select defaultValue="15">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => {
                  const title = (document.getElementById('testEventTitle') as HTMLInputElement)?.value || 'Study Session'
                  const minutes = 15 // You could get this from the select
                  sendEventReminder(title, minutes)
                }}
                size="sm"
              >
                Send Reminder
              </Button>
            </div>
          </div>

          {/* Test History */}
          {testNotifications.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Test History</Label>
                <Button variant="ghost" size="sm" onClick={clearTestNotifications}>
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {testNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-2 p-2 border rounded text-sm">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{notification.title}</p>
                      <p className="text-muted-foreground truncate">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 