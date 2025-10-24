// Study Session Tracking System
export interface StudySession {
  id: string
  subject: string
  duration: number // in minutes
  energyLevel: number // 1-5
  productivity: number // 0-1
  notes: string
  timestamp: Date
  tags: string[]
  goals: string[]
  interruptions: number
  breaks: number
  totalBreakTime: number // in minutes
}

export interface StudyAnalytics {
  totalStudyTime: number // in minutes
  averageSessionLength: number
  productivityTrend: number // 0-1
  burnoutRisk: number // 0-1
  subjectPerformance: Record<string, number>
  studyStreak: number
  weeklyGoals: number
  weeklyAchievements: number
  dailyStudyHours: number[]
  subjectBreakdown: Record<string, number>
  optimalStudyTimes: number[]
  focusScore: number // 0-1
  consistencyScore: number // 0-1
}

export interface StudyGoal {
  id: string
  title: string
  description: string
  targetHours: number
  currentHours: number
  deadline: Date
  subject: string
  priority: 'low' | 'medium' | 'high'
  completed: boolean
}

class StudySessionTracker {
  private sessions: StudySession[] = []
  private goals: StudyGoal[] = []

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const savedSessions = localStorage.getItem('studySessions')
      const savedGoals = localStorage.getItem('studyGoals')
      
      if (savedSessions) {
        this.sessions = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          timestamp: new Date(session.timestamp)
        }))
      }
      
      if (savedGoals) {
        this.goals = JSON.parse(savedGoals).map((goal: any) => ({
          ...goal,
          deadline: new Date(goal.deadline)
        }))
      }
    } catch (error) {
      console.error('Failed to load study data:', error)
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem('studySessions', JSON.stringify(this.sessions))
      localStorage.setItem('studyGoals', JSON.stringify(this.goals))
    } catch (error) {
      console.error('Failed to save study data:', error)
    }
  }

  addSession(session: Omit<StudySession, 'id' | 'timestamp'>): string {
    const newSession: StudySession = {
      ...session,
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    
    this.sessions.push(newSession)
    this.saveToStorage()
    return newSession.id
  }

  getSessions(filters?: {
    subject?: string
    startDate?: Date
    endDate?: Date
    minDuration?: number
  }): StudySession[] {
    let filteredSessions = [...this.sessions]

    if (filters?.subject) {
      filteredSessions = filteredSessions.filter(s => s.subject === filters.subject)
    }

    if (filters?.startDate) {
      filteredSessions = filteredSessions.filter(s => s.timestamp >= filters.startDate!)
    }

    if (filters?.endDate) {
      filteredSessions = filteredSessions.filter(s => s.timestamp <= filters.endDate!)
    }

    if (filters?.minDuration) {
      filteredSessions = filteredSessions.filter(s => s.duration >= filters.minDuration!)
    }

    return filteredSessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getAnalytics(timeRange: 'week' | 'month' | 'all' = 'week'): StudyAnalytics {
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    const relevantSessions = this.getSessions({ startDate, endDate: now })
    
    // Calculate total study time
    const totalStudyTime = relevantSessions.reduce((sum, session) => sum + session.duration, 0)
    
    // Calculate average session length
    const averageSessionLength = relevantSessions.length > 0 
      ? totalStudyTime / relevantSessions.length 
      : 0

    // Calculate productivity trend
    const recentSessions = relevantSessions.slice(0, 10)
    const productivityTrend = recentSessions.length > 0
      ? recentSessions.reduce((sum, session) => sum + session.productivity, 0) / recentSessions.length
      : 0

    // Calculate burnout risk
    const burnoutRisk = this.calculateBurnoutRisk(relevantSessions)

    // Calculate subject performance
    const subjectPerformance: Record<string, number> = {}
    const subjectSessions: Record<string, StudySession[]> = {}
    
    relevantSessions.forEach(session => {
      if (!subjectSessions[session.subject]) {
        subjectSessions[session.subject] = []
      }
      subjectSessions[session.subject].push(session)
    })

    Object.entries(subjectSessions).forEach(([subject, sessions]) => {
      subjectPerformance[subject] = sessions.reduce((sum, session) => sum + session.productivity, 0) / sessions.length
    })

    // Calculate study streak
    const studyStreak = this.calculateStudyStreak()

    // Calculate daily study hours for the past week
    const dailyStudyHours = this.calculateDailyStudyHours()

    // Calculate subject breakdown
    const subjectBreakdown = this.calculateSubjectBreakdown(relevantSessions)

    // Calculate optimal study times
    const optimalStudyTimes = this.calculateOptimalStudyTimes(relevantSessions)

    // Calculate focus score
    const focusScore = this.calculateFocusScore(relevantSessions)

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(relevantSessions)

    return {
      totalStudyTime,
      averageSessionLength,
      productivityTrend,
      burnoutRisk,
      subjectPerformance,
      studyStreak,
      weeklyGoals: this.goals.filter(g => !g.completed).length,
      weeklyAchievements: this.goals.filter(g => g.completed && g.deadline >= startDate).length,
      dailyStudyHours,
      subjectBreakdown,
      optimalStudyTimes,
      focusScore,
      consistencyScore
    }
  }

  private calculateBurnoutRisk(sessions: StudySession[]): number {
    if (sessions.length === 0) return 0

    const recentSessions = sessions.slice(-10)
    const avgSessionLength = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length
    const avgEnergyLevel = recentSessions.reduce((sum, s) => sum + s.energyLevel, 0) / recentSessions.length
    const avgProductivity = recentSessions.reduce((sum, s) => sum + s.productivity, 0) / recentSessions.length

    // Factors that increase burnout risk:
    // - Very long sessions (>90 minutes)
    // - Low energy levels
    // - Declining productivity
    // - High number of sessions per day

    let risk = 0

    if (avgSessionLength > 90) risk += 0.3
    if (avgEnergyLevel < 3) risk += 0.2
    if (avgProductivity < 0.6) risk += 0.2

    const sessionsPerDay = sessions.length / 7 // Assuming week view
    if (sessionsPerDay > 4) risk += 0.2

    return Math.min(1, risk)
  }

  private calculateStudyStreak(): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let streak = 0
    let currentDate = new Date(today)

    while (true) {
      const daySessions = this.getSessions({
        startDate: currentDate,
        endDate: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      })

      if (daySessions.length === 0) break
      
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    }

    return streak
  }

  private calculateDailyStudyHours(): number[] {
    const hours = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const daySessions = this.getSessions({
        startDate: date,
        endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000)
      })
      
      const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0)
      hours.push(totalMinutes / 60)
    }

    return hours
  }

  private calculateSubjectBreakdown(sessions: StudySession[]): Record<string, number> {
    const breakdown: Record<string, number> = {}
    const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0)
    
    if (totalTime === 0) return breakdown

    sessions.forEach(session => {
      if (!breakdown[session.subject]) {
        breakdown[session.subject] = 0
      }
      breakdown[session.subject] += session.duration
    })

    // Convert to percentages
    Object.keys(breakdown).forEach(subject => {
      breakdown[subject] = (breakdown[subject] / totalTime) * 100
    })

    return breakdown
  }

  private calculateOptimalStudyTimes(sessions: StudySession[]): number[] {
    const hourlyProductivity: Record<number, number[]> = {}
    
    sessions.forEach(session => {
      const hour = session.timestamp.getHours()
      if (!hourlyProductivity[hour]) {
        hourlyProductivity[hour] = []
      }
      hourlyProductivity[hour].push(session.productivity)
    })

    const avgProductivityByHour = Object.entries(hourlyProductivity)
      .map(([hour, scores]) => ({
        hour: parseInt(hour),
        avgProductivity: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))
      .sort((a, b) => b.avgProductivity - a.avgProductivity)
      .slice(0, 3)
      .map(item => item.hour)

    return avgProductivityByHour
  }

  private calculateFocusScore(sessions: StudySession[]): number {
    if (sessions.length === 0) return 0

    const avgInterruptions = sessions.reduce((sum, session) => sum + session.interruptions, 0) / sessions.length
    const avgProductivity = sessions.reduce((sum, session) => sum + session.productivity, 0) / sessions.length

    // Lower interruptions and higher productivity = better focus
    const interruptionScore = Math.max(0, 1 - (avgInterruptions / 5)) // Normalize to 0-1
    const productivityScore = avgProductivity

    return (interruptionScore + productivityScore) / 2
  }

  private calculateConsistencyScore(sessions: StudySession[]): number {
    if (sessions.length === 0) return 0

    const dailySessions = this.calculateDailyStudyHours()
    const nonZeroDays = dailySessions.filter(hours => hours > 0).length
    const consistencyRatio = nonZeroDays / 7

    return consistencyRatio
  }

  addGoal(goal: Omit<StudyGoal, 'id' | 'currentHours' | 'completed'>): string {
    const newGoal: StudyGoal = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      currentHours: 0,
      completed: false
    }
    
    this.goals.push(newGoal)
    this.saveToStorage()
    return newGoal.id
  }

  updateGoalProgress(goalId: string, additionalHours: number): void {
    const goal = this.goals.find(g => g.id === goalId)
    if (goal) {
      goal.currentHours += additionalHours
      if (goal.currentHours >= goal.targetHours) {
        goal.completed = true
      }
      this.saveToStorage()
    }
  }

  getGoals(filters?: {
    subject?: string
    completed?: boolean
    priority?: 'low' | 'medium' | 'high'
  }): StudyGoal[] {
    let filteredGoals = [...this.goals]

    if (filters?.subject) {
      filteredGoals = filteredGoals.filter(g => g.subject === filters.subject)
    }

    if (filters?.completed !== undefined) {
      filteredGoals = filteredGoals.filter(g => g.completed === filters.completed)
    }

    if (filters?.priority) {
      filteredGoals = filteredGoals.filter(g => g.priority === filters.priority)
    }

    return filteredGoals.sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
  }

  getRecommendations(): string[] {
    const analytics = this.getAnalytics()
    const recommendations: string[] = []

    if (analytics.burnoutRisk > 0.6) {
      recommendations.push('Consider taking a break to prevent burnout')
    }

    if (analytics.averageSessionLength < 25) {
      recommendations.push('Try longer study sessions for better retention')
    }

    if (analytics.productivityTrend < 0.7) {
      recommendations.push('Review your study environment and methods')
    }

    const lowPerformingSubjects = Object.entries(analytics.subjectPerformance)
      .filter(([_, score]) => score < 0.7)
      .map(([subject, _]) => subject)

    if (lowPerformingSubjects.length > 0) {
      recommendations.push(`Focus more on: ${lowPerformingSubjects.join(', ')}`)
    }

    if (analytics.optimalStudyTimes.length > 0) {
      const bestTime = analytics.optimalStudyTimes[0]
      recommendations.push(`Study during ${bestTime}:00 for optimal productivity`)
    }

    return recommendations
  }

  exportData(): { sessions: StudySession[], goals: StudyGoal[], analytics: StudyAnalytics } {
    return {
      sessions: this.sessions,
      goals: this.goals,
      analytics: this.getAnalytics('all')
    }
  }

  importData(data: { sessions: StudySession[], goals: StudyGoal[] }): void {
    this.sessions = data.sessions.map(session => ({
      ...session,
      timestamp: new Date(session.timestamp)
    }))
    this.goals = data.goals.map(goal => ({
      ...goal,
      deadline: new Date(goal.deadline)
    }))
    this.saveToStorage()
  }
}

// Export singleton instance
export const studySessionTracker = new StudySessionTracker()

