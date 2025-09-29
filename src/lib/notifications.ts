// Notification system for Studyverse Garden
export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
  silent?: boolean
  actions?: NotificationAction[]
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export interface EmailNotification {
  to: string
  subject: string
  body: string
  html?: string
}

class NotificationService {
  private hasPermission = false
  private emailService: EmailService | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkPermission()
    }
  }

  async checkPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted'
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      this.hasPermission = permission === 'granted'
      return this.hasPermission
    }
    return false
  }

  async sendBrowserNotification(options: NotificationOptions): Promise<boolean> {
    if (!this.hasPermission) {
      const granted = await this.requestPermission()
      if (!granted) return false
    }

    try {
      // Browser Notification API (without Service Worker) does NOT support actions.
      // To avoid runtime TypeError, we strip actions here.
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      } as NotificationOptions)

      // Auto-close after 10 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 10000)
      }

      return true
    } catch (error) {
      // Swallow errors so app logic continues (e.g., saving session data)
      console.error('Failed to send browser notification:', error)
      return false
    }
  }

  async sendEmailNotification(email: EmailNotification): Promise<boolean> {
    // For now, we'll use a simple email service
    // In production, you'd integrate with SendGrid, Mailgun, etc.
    try {
      // Simulate email sending
      console.log('Sending email notification:', email)
      
      // You can integrate with your preferred email service here
      // Example with SendGrid:
      // const response = await fetch('/api/send-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(email)
      // })
      
      return true
    } catch (error) {
      console.error('Failed to send email notification:', error)
      return false
    }
  }

  async sendStudyReminder(eventTitle: string, eventTime: Date, reminderType: 'before' | 'after' | 'start'): Promise<void> {
    const timeString = eventTime.toLocaleTimeString()
    const dateString = eventTime.toLocaleDateString()
    
    const notificationOptions: NotificationOptions = {
      title: `Study Reminder: ${eventTitle}`,
      body: `Your study session ${reminderType === 'before' ? 'starts in 15 minutes' : reminderType === 'after' ? 'ended 15 minutes ago' : 'is starting now'} on ${dateString} at ${timeString}`,
      icon: '/favicon.ico',
      tag: `study-reminder-${eventTitle}`,
      requireInteraction: true,
      // actions omitted for compatibility
    }

    await this.sendBrowserNotification(notificationOptions)
  }

  async sendTimerComplete(): Promise<void> {
    const notificationOptions: NotificationOptions = {
      title: 'Study Session Complete! 🌟',
      body: 'Great job! Your study session has finished. Take a break and reflect on your progress.',
      icon: '/favicon.ico',
      tag: 'timer-complete',
      requireInteraction: true,
      // actions are intentionally omitted for compatibility without SW
    }

    await this.sendBrowserNotification(notificationOptions)
  }

  async sendGoalReminder(goalTitle: string, dueDate: Date): Promise<void> {
    const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    
    const notificationOptions: NotificationOptions = {
      title: `Goal Reminder: ${goalTitle}`,
      body: daysLeft > 0 
        ? `Your goal is due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Keep up the great work!`
        : `Your goal was due today. Don't give up!`,
      icon: '/favicon.ico',
      tag: `goal-reminder-${goalTitle}`,
      requireInteraction: false
    }

    await this.sendBrowserNotification(notificationOptions)
  }

  async sendBurnoutWarning(analytics: any): Promise<void> {
    const notificationOptions: NotificationOptions = {
      title: 'Burnout Warning ⚠️',
      body: 'You\'ve been working hard! Consider taking a break or reducing your workload to maintain your well-being.',
      icon: '/favicon.ico',
      tag: 'burnout-warning',
      requireInteraction: true,
      // actions omitted for compatibility
    }

    await this.sendBrowserNotification(notificationOptions)
  }

  async sendWeeklySummary(analytics: any): Promise<void> {
    const notificationOptions: NotificationOptions = {
      title: 'Weekly Study Summary 📊',
      body: `You studied for ${Math.round(analytics.totalStudyTime / 60)} hours this week. ${analytics.achievements.length > 0 ? 'Great achievements!' : 'Keep pushing forward!'}`,
      icon: '/favicon.ico',
      tag: 'weekly-summary',
      requireInteraction: false
    }

    await this.sendBrowserNotification(notificationOptions)
  }
}

// Email service for sending email notifications
class EmailService {
  private apiKey: string | null = null

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  async sendEmail(email: EmailNotification): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('Email service not configured. Please provide an API key.')
      return false
    }

    try {
      // Implementation would depend on your email service
      // Example with SendGrid:
      // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     personalizations: [{ to: [{ email: email.to }] }],
      //     from: { email: 'noreply@studyversegarden.com' },
      //     subject: email.subject,
      //     content: [
      //       { type: 'text/plain', value: email.body },
      //       { type: 'text/html', value: email.html || email.body }
      //     ]
      //   })
      // })
      
      console.log('Email sent:', email)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()

