"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LeafIcon } from '@/components/icons/leaf-icon'
import { notificationService } from '@/lib/notifications'
import { studySessionTracker } from '@/lib/study-sessions'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '99 SEK',
    period: '/Month',
    savings: null,
  },
  {
    id: '3-months',
    title: '3 Months',
    price: '79 SEK',
    period: '/Month',
    savings: 'Save 20%',
  },
  {
    id: '6-months',
    title: '6 Months',
    price: '69 SEK',
    period: '/Month',
    savings: 'Save 30%',
  },
  {
    id: 'annual',
    title: 'Annual',
    price: '54 SEK',
    period: '/Month',
    savings: 'Save 45%',
  },
];

interface NotificationSettings {
  browserNotifications: boolean
  emailNotifications: boolean
  studyReminders: boolean
  goalReminders: boolean
  burnoutWarnings: boolean
  weeklySummaries: boolean
  emailAddress: string
  reminderTime: string
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

interface StudySettings {
  defaultSessionLength: number
  defaultBreakLength: number
  autoStartBreaks: boolean
  soundEnabled: boolean
  energyTracking: boolean
  productivityTracking: boolean
  subjects: string[]
  studyGoals: {
    dailyHours: number
    weeklyHours: number
    monthlyHours: number
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('3-months');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    browserNotifications: true,
    emailNotifications: false,
    studyReminders: true,
    goalReminders: true,
    burnoutWarnings: true,
    weeklySummaries: true,
    emailAddress: '',
    reminderTime: '09:00',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  })

  const [studySettings, setStudySettings] = useState<StudySettings>({
    defaultSessionLength: 25,
    defaultBreakLength: 5,
    autoStartBreaks: true,
    soundEnabled: true,
    energyTracking: true,
    productivityTracking: true,
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
    studyGoals: {
      dailyHours: 2,
      weeklyHours: 14,
      monthlyHours: 60
    }
  })

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    loadSettings()
    checkNotificationPermission()
  }, [])

  const loadSettings = () => {
    try {
      const savedNotificationSettings = localStorage.getItem('notificationSettings')
      const savedStudySettings = localStorage.getItem('studySettings')
      
      if (savedNotificationSettings) {
        setNotificationSettings(JSON.parse(savedNotificationSettings))
      }
      
      if (savedStudySettings) {
        setStudySettings(JSON.parse(savedStudySettings))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaveStatus('saving')
    
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings))
      localStorage.setItem('studySettings', JSON.stringify(studySettings))
      
      // Request notification permission if needed
      if (notificationSettings.browserNotifications && notificationPermission === 'default') {
        const permission = await notificationService.requestPermission()
        setNotificationPermission(permission ? 'granted' : 'denied')
      }
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveStatus('error')
    }
  }

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }

  const requestNotificationPermission = async () => {
    const permission = await notificationService.requestPermission()
    setNotificationPermission(permission ? 'granted' : 'denied')
  }

  const exportData = () => {
    const data = studySessionTracker.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studyverse-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        studySessionTracker.importData(data)
        alert('Data imported successfully!')
      } catch (error) {
        alert('Failed to import data. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const resetData = () => {
    if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      localStorage.clear()
      window.location.reload()
    }
  }

  const testNotification = async () => {
    try {
      await notificationService.sendBrowserNotification({
        title: 'Test Notification',
        body: 'This is a test notification from Studyverse Garden! 🌱',
        icon: '/favicon.ico'
      })
    } catch (error) {
      console.error('Failed to send test notification:', error)
    }
  }

  const handleUpdatePlan = () => {
    router.push(`/checkout?plan=${selectedPlan}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account settings, profile, and payment plan."
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>This information will be displayed publicly so be careful what you share.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" defaultValue="study-gardener" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="gardener@studyverse.app" />
          </div>
          <Button>Update Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your password here. After saving, you'll be logged out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input id="current-password" type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" type="password" />
          </div>
          <Button>Save Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choose Your Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-4">
            {plans.map((plan) => (
              <Label htmlFor={plan.id} key={plan.id} className="[&:has([data-state=checked])]:border-primary flex items-center justify-between rounded-lg border-2 border-muted bg-card p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground">
                <div className="flex flex-1 items-center gap-4 cursor-pointer">
                  <div className="bg-muted p-3 rounded-full">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{plan.title}</span>
                      {plan.savings && <Badge variant="secondary">{plan.savings}</Badge>}
                    </div>
                    <p className="text-muted-foreground">
                      <span className="font-bold text-card-foreground">{plan.price}</span>
                      <span className="text-sm"> {plan.period}</span>
                    </p>
                  </div>
                </div>
                <RadioGroupItem value={plan.id} id={plan.id} />
              </Label>
            ))}
          </RadioGroup>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>Bypass For Now</Button>
            <Button onClick={handleUpdatePlan}>Update Plan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Out</CardTitle>
          <CardDescription>Sign out of your account and return to the login page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="destructive"
            onClick={async () => {
              try {
                const { supabase } = await import('@/lib/supabaseClient')
                await supabase.auth.signOut()
              } catch (e) {
                console.warn('Sign out encountered an issue, proceeding to login anyway.', e)
              } finally {
                if (typeof window !== 'undefined') window.location.href = '/login'
              }
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-green-50">
          <TabsTrigger value="notifications" className="data-[state=active]:bg-green-200">Notifications</TabsTrigger>
          <TabsTrigger value="study" className="data-[state=active]:bg-green-200">Study</TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-green-200">Data</TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-green-200">About</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Browser Notifications */}
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800">Browser Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="browser-notifications">Enable Browser Notifications</Label>
                  <Switch
                    id="browser-notifications"
                    checked={notificationSettings.browserNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, browserNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Permission Status</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      notificationPermission === 'granted' ? 'bg-green-100 border-green-300 text-green-700' :
                      notificationPermission === 'denied' ? 'bg-red-100 border-red-300 text-red-700' :
                      'bg-yellow-100 border-yellow-300 text-yellow-700'
                    )}
                  >
                    {notificationPermission}
                  </Badge>
                </div>

                {notificationPermission === 'denied' && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertDescription className="text-yellow-800">
                      Notifications are blocked. Please enable them in your browser settings.
                    </AlertDescription>
                  </Alert>
                )}

                {notificationPermission === 'default' && (
                  <Button onClick={requestNotificationPermission} variant="outline" size="sm">
                    Request Permission
                  </Button>
                )}

                <Button onClick={testNotification} variant="outline" size="sm">
                  Test Notification
                </Button>
              </CardContent>
            </Card>

            {/* Email Notifications */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Email Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications">Enable Email Notifications</Label>
                  <Switch
                    id="email-notifications"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-address">Email Address</Label>
                  <Input
                    id="email-address"
                    type="email"
                    value={notificationSettings.emailAddress}
                    onChange={(e) => 
                      setNotificationSettings(prev => ({ ...prev, emailAddress: e.target.value }))
                    }
                    placeholder="your@email.com"
                    className="border-blue-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder-time">Daily Reminder Time</Label>
                  <Input
                    id="reminder-time"
                    type="time"
                    value={notificationSettings.reminderTime}
                    onChange={(e) => 
                      setNotificationSettings(prev => ({ ...prev, reminderTime: e.target.value }))
                    }
                    className="border-blue-200"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Types */}
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Notification Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="study-reminders">Study Reminders</Label>
                  <Switch
                    id="study-reminders"
                    checked={notificationSettings.studyReminders}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, studyReminders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="goal-reminders">Goal Reminders</Label>
                  <Switch
                    id="goal-reminders"
                    checked={notificationSettings.goalReminders}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, goalReminders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="burnout-warnings">Burnout Warnings</Label>
                  <Switch
                    id="burnout-warnings"
                    checked={notificationSettings.burnoutWarnings}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, burnoutWarnings: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="weekly-summaries">Weekly Summaries</Label>
                  <Switch
                    id="weekly-summaries"
                    checked={notificationSettings.weeklySummaries}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, weeklySummaries: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quiet Hours */}
            <Card className="border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">Quiet Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                  <Switch
                    id="quiet-hours"
                    checked={notificationSettings.quietHours.enabled}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ 
                        ...prev, 
                        quietHours: { ...prev.quietHours, enabled: checked }
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={notificationSettings.quietHours.start}
                      onChange={(e) => 
                        setNotificationSettings(prev => ({ 
                          ...prev, 
                          quietHours: { ...prev.quietHours, start: e.target.value }
                        }))
                      }
                      className="border-orange-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={notificationSettings.quietHours.end}
                      onChange={(e) => 
                        setNotificationSettings(prev => ({ 
                          ...prev, 
                          quietHours: { ...prev.quietHours, end: e.target.value }
                        }))
                      }
                      className="border-orange-200"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="study" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timer Settings */}
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800">Timer Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session-length">Default Session Length (minutes)</Label>
                  <Input
                    id="session-length"
                    type="number"
                    value={studySettings.defaultSessionLength}
                    onChange={(e) => 
                      setStudySettings(prev => ({ ...prev, defaultSessionLength: parseInt(e.target.value) }))
                    }
                    min="5"
                    max="120"
                    className="border-green-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="break-length">Default Break Length (minutes)</Label>
                  <Input
                    id="break-length"
                    type="number"
                    value={studySettings.defaultBreakLength}
                    onChange={(e) => 
                      setStudySettings(prev => ({ ...prev, defaultBreakLength: parseInt(e.target.value) }))
                    }
                    min="1"
                    max="30"
                    className="border-green-200"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-breaks">Auto-start Breaks</Label>
                  <Switch
                    id="auto-breaks"
                    checked={studySettings.autoStartBreaks}
                    onCheckedChange={(checked) => 
                      setStudySettings(prev => ({ ...prev, autoStartBreaks: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-enabled">Sound Effects</Label>
                  <Switch
                    id="sound-enabled"
                    checked={studySettings.soundEnabled}
                    onCheckedChange={(checked) => 
                      setStudySettings(prev => ({ ...prev, soundEnabled: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tracking Settings */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Tracking Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="energy-tracking">Energy Level Tracking</Label>
                  <Switch
                    id="energy-tracking"
                    checked={studySettings.energyTracking}
                    onCheckedChange={(checked) => 
                      setStudySettings(prev => ({ ...prev, energyTracking: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="productivity-tracking">Productivity Tracking</Label>
                  <Switch
                    id="productivity-tracking"
                    checked={studySettings.productivityTracking}
                    onCheckedChange={(checked) => 
                      setStudySettings(prev => ({ ...prev, productivityTracking: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Study Goals */}
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Study Goals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-hours">Daily Study Hours</Label>
                  <Input
                    id="daily-hours"
                    type="number"
                    value={studySettings.studyGoals.dailyHours}
                    onChange={(e) => 
                      setStudySettings(prev => ({ 
                        ...prev, 
                        studyGoals: { ...prev.studyGoals, dailyHours: parseFloat(e.target.value) }
                      }))
                    }
                    min="0.5"
                    max="12"
                    step="0.5"
                    className="border-purple-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly-hours">Weekly Study Hours</Label>
                  <Input
                    id="weekly-hours"
                    type="number"
                    value={studySettings.studyGoals.weeklyHours}
                    onChange={(e) => 
                      setStudySettings(prev => ({ 
                        ...prev, 
                        studyGoals: { ...prev.studyGoals, weeklyHours: parseFloat(e.target.value) }
                      }))
                    }
                    min="1"
                    max="84"
                    step="0.5"
                    className="border-purple-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-hours">Monthly Study Hours</Label>
                  <Input
                    id="monthly-hours"
                    type="number"
                    value={studySettings.studyGoals.monthlyHours}
                    onChange={(e) => 
                      setStudySettings(prev => ({ 
                        ...prev, 
                        studyGoals: { ...prev.studyGoals, monthlyHours: parseFloat(e.target.value) }
                      }))
                    }
                    min="1"
                    max="360"
                    step="0.5"
                    className="border-purple-200"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Export */}
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800">Export Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Export all your study data, including sessions, goals, and analytics.
                </p>
                <Button onClick={exportData} className="w-full bg-green-600 hover:bg-green-700">
                  Export Data
                </Button>
              </CardContent>
            </Card>

            {/* Data Import */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Import Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Import study data from a previously exported file.
                </p>
                <Input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="border-blue-200"
                />
              </CardContent>
            </Card>

            {/* Data Reset */}
            <Card className="border-2 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800">Reset Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Warning: This will permanently delete all your study data.
                </p>
                <Button 
                  onClick={resetData} 
                  variant="destructive" 
                  className="w-full"
                >
                  Reset All Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">About Studyverse Garden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-green-800">Version</h3>
                <p className="text-sm text-gray-600">1.0.0</p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-green-800">Description</h3>
                <p className="text-sm text-gray-600">
                  Studyverse Garden is a comprehensive study app designed with a cottage core aesthetic. 
                  It combines modern productivity tools with a calming, nature-inspired interface to help 
                  students achieve their academic goals while maintaining well-being.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-green-800">Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Resizable, movable dashboard widgets</li>
                  <li>• Enhanced calendar with energy tracking</li>
                  <li>• AI-powered study companion</li>
                  <li>• Comprehensive analytics and insights</li>
                  <li>• Real-time notifications</li>
                  <li>• Study timer with productivity tracking</li>
                  <li>• Goal setting and progress tracking</li>
                  <li>• Data export and import</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-green-800">Contact</h3>
                <p className="text-sm text-gray-600">
                  For support or feedback, please visit our documentation or contact us.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveSettings}
          disabled={saveStatus === 'saving'}
          className="bg-green-600 hover:bg-green-700 text-white px-8"
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
