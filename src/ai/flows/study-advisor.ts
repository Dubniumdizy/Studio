// AI Study Advisor for Studyverse Garden
export interface StudyContext {
  currentSubject: string
  studyTime: number
  energyLevel: number
  recentSessions: StudySession[]
  goals: Goal[]
  analytics: StudyAnalytics
  currentTime: Date
  weather?: string
  mood?: string
}

export interface StudySession {
  id: string
  subject: string
  duration: number
  energyLevel: number
  productivity: number
  notes: string
  timestamp: Date
}

export interface Goal {
  id: string
  title: string
  description: string
  dueDate: Date
  progress: number
  subject: string
  priority: 'low' | 'medium' | 'high'
}

export interface StudyAnalytics {
  totalStudyTime: number
  averageSessionLength: number
  productivityTrend: number
  burnoutRisk: number
  subjectPerformance: Record<string, number>
  studyStreak: number
  weeklyGoals: number
  weeklyAchievements: number
}

export interface AIAdvice {
  type: 'encouragement' | 'warning' | 'suggestion' | 'celebration' | 'strategy'
  title: string
  message: string
  actionItems: string[]
  priority: 'low' | 'medium' | 'high'
  relatedResources?: string[]
  estimatedImpact: string
}

class StudyAdvisor {
  private context: StudyContext | null = null

  setContext(context: StudyContext) {
    this.context = context
  }

  async getPersonalizedAdvice(): Promise<AIAdvice[]> {
    if (!this.context) {
      throw new Error('Study context not set')
    }

    const advice: AIAdvice[] = []

    // Analyze study patterns and provide specific advice
    advice.push(...this.analyzeStudyPatterns())
    advice.push(...this.analyzeBurnoutRisk())
    advice.push(...this.analyzeGoalProgress())
    advice.push(...this.analyzeSubjectPerformance())
    advice.push(...this.analyzeOptimalStudyTimes())
    advice.push(...this.generateMotivationalAdvice())

    return advice.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  private analyzeStudyPatterns(): AIAdvice[] {
    const { recentSessions, analytics } = this.context!
    const advice: AIAdvice[] = []

    // Analyze session length patterns
    const avgSessionLength = analytics.averageSessionLength
    if (avgSessionLength < 25) {
      advice.push({
        type: 'suggestion',
        title: 'Short Study Sessions Detected',
        message: 'Your average study session is quite short. Consider extending sessions to 45-60 minutes for better retention and deeper learning.',
        actionItems: [
          'Try the Pomodoro technique: 25 min work + 5 min break',
          'Gradually increase session length by 5 minutes each week',
          'Use the study timer to track longer sessions'
        ],
        priority: 'medium',
        estimatedImpact: 'Improve focus and retention by 30%'
      })
    } else if (avgSessionLength > 90) {
      advice.push({
        type: 'warning',
        title: 'Very Long Study Sessions',
        message: 'Your study sessions are quite long. While dedication is admirable, very long sessions can lead to diminishing returns and burnout.',
        actionItems: [
          'Break sessions into 45-60 minute chunks',
          'Take 15-20 minute breaks between sessions',
          'Use the energy level tracker to monitor fatigue'
        ],
        priority: 'high',
        estimatedImpact: 'Reduce burnout risk and improve efficiency'
      })
    }

    // Analyze productivity trends
    if (analytics.productivityTrend < 0.7) {
      advice.push({
        type: 'strategy',
        title: 'Productivity Decline Detected',
        message: 'Your productivity has been declining. This might indicate burnout, lack of variety, or ineffective study methods.',
        actionItems: [
          'Try different study techniques (flashcards, mind maps, practice tests)',
          'Review your study environment and eliminate distractions',
          'Consider taking a short break to recharge',
          'Use the inspiration generator for fresh study ideas'
        ],
        priority: 'high',
        estimatedImpact: 'Restore productivity to optimal levels'
      })
    }

    return advice
  }

  private analyzeBurnoutRisk(): AIAdvice[] {
    const { analytics, recentSessions } = this.context!
    const advice: AIAdvice[] = []

    if (analytics.burnoutRisk > 0.7) {
      advice.push({
        type: 'warning',
        title: 'High Burnout Risk Detected',
        message: 'You\'re showing signs of potential burnout. Your study intensity has been very high, and your energy levels are declining.',
        actionItems: [
          'Take a 1-2 day complete break from studying',
          'Engage in relaxing activities (nature walks, meditation)',
          'Reduce study goals for the next week by 30%',
          'Focus on quality over quantity in your sessions'
        ],
        priority: 'high',
        estimatedImpact: 'Prevent burnout and maintain long-term motivation'
      })
    } else if (analytics.burnoutRisk > 0.5) {
      advice.push({
        type: 'suggestion',
        title: 'Moderate Burnout Risk',
        message: 'You\'re approaching burnout territory. Consider adjusting your study schedule to include more breaks and recovery time.',
        actionItems: [
          'Add 10-minute breaks every 45 minutes',
          'Schedule one full day off per week',
          'Practice stress-reduction techniques',
          'Monitor your energy levels more closely'
        ],
        priority: 'medium',
        estimatedImpact: 'Maintain sustainable study habits'
      })
    }

    return advice
  }

  private analyzeGoalProgress(): AIAdvice[] {
    const { goals, currentTime } = this.context!
    const advice: AIAdvice[] = []

    const upcomingGoals = goals.filter(goal => {
      const daysUntilDue = Math.ceil((goal.dueDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilDue <= 7 && goal.progress < 0.8
    })

    if (upcomingGoals.length > 0) {
      advice.push({
        type: 'warning',
        title: 'Upcoming Deadlines',
        message: `You have ${upcomingGoals.length} goal${upcomingGoals.length > 1 ? 's' : ''} due within a week that need attention.`,
        actionItems: [
          'Review and prioritize your upcoming goals',
          'Break large goals into smaller, manageable tasks',
          'Schedule dedicated time blocks for each goal',
          'Use the calendar to track progress daily'
        ],
        priority: 'high',
        estimatedImpact: 'Meet deadlines and reduce stress'
      })
    }

    const completedGoals = goals.filter(goal => goal.progress >= 1)
    if (completedGoals.length > 0) {
      advice.push({
        type: 'celebration',
        title: 'Goals Achieved!',
        message: `Congratulations! You've completed ${completedGoals.length} goal${completedGoals.length > 1 ? 's' : ''}. Take time to celebrate your achievements.`,
        actionItems: [
          'Reflect on what worked well',
          'Set new goals to maintain momentum',
          'Share your success with study buddies',
          'Treat yourself to something special'
        ],
        priority: 'low',
        estimatedImpact: 'Boost motivation and confidence'
      })
    }

    return advice
  }

  private analyzeSubjectPerformance(): AIAdvice[] {
    const ctx = this.context!
    const { currentSubject } = ctx
    const subjectPerformance: Record<string, number> = ctx.analytics.subjectPerformance
    const advice: AIAdvice[] = []

    const currentSubjectScore = subjectPerformance[currentSubject] || 0
    const allScores: number[] = Object.values(subjectPerformance)
    const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

    if (currentSubjectScore < avgScore * 0.8) {
      advice.push({
        type: 'strategy',
        title: `${currentSubject} Needs Attention`,
        message: `Your performance in ${currentSubject} is below your average. This subject might need different study approaches or more focused time.`,
        actionItems: [
          'Review past study sessions for this subject',
          'Try different study techniques (visual, auditory, kinesthetic)',
          'Use flashcards for memorization-heavy topics',
          'Practice with past exam questions',
          'Consider forming a study group for this subject'
        ],
        priority: 'medium',
        relatedResources: ['flashcards', 'question-bank', 'formula-sheet'],
        estimatedImpact: 'Improve subject performance by 25%'
      })
    }

    return advice
  }

  private analyzeOptimalStudyTimes(): AIAdvice[] {
    const { recentSessions, currentTime, energyLevel } = this.context!
    const advice: AIAdvice[] = []

    // Analyze when user is most productive
    const productivityByHour: Record<number, number[]> = {}
    recentSessions.forEach(session => {
      const hour = session.timestamp.getHours()
      if (!productivityByHour[hour]) productivityByHour[hour] = []
      productivityByHour[hour].push(session.productivity)
    })

    const avgProductivityByHour = Object.entries(productivityByHour).map(([hour, scores]) => ({
      hour: parseInt(hour),
      avgProductivity: scores.reduce((a, b) => a + b, 0) / scores.length
    })).sort((a, b) => b.avgProductivity - a.avgProductivity)

    if (avgProductivityByHour.length > 0) {
      const bestHour = avgProductivityByHour[0]
      const currentHour = currentTime.getHours()
      
      if (Math.abs(currentHour - bestHour.hour) <= 2) {
        advice.push({
          type: 'encouragement',
          title: 'Optimal Study Time!',
          message: `You're studying during your most productive hours (around ${bestHour.hour}:00). This is perfect timing for challenging subjects!`,
          actionItems: [
            'Tackle your most difficult topics now',
            'Use this time for deep work sessions',
            'Avoid distractions and maximize focus'
          ],
          priority: 'low',
          estimatedImpact: 'Maximize learning efficiency'
        })
      }
    }

    // Energy level advice
    if (energyLevel < 3) {
      advice.push({
        type: 'suggestion',
        title: 'Low Energy Detected',
        message: 'Your energy level is quite low. Consider lighter study activities or taking a short break to recharge.',
        actionItems: [
          'Try light review sessions instead of new material',
          'Use flashcards or practice questions',
          'Take a 15-minute power nap',
          'Do some light stretching or walking'
        ],
        priority: 'medium',
        estimatedImpact: 'Improve study quality and retention'
      })
    }

    return advice
  }

  private generateMotivationalAdvice(): AIAdvice[] {
    const { analytics } = this.context!
    const studyStreak = analytics.studyStreak
    const advice: AIAdvice[] = []

    // Celebrate streaks
    if (studyStreak >= 7) {
      advice.push({
        type: 'celebration',
        title: 'Amazing Study Streak!',
        message: `You've been studying for ${studyStreak} days in a row! Your consistency is building strong study habits.`,
        actionItems: [
          'Keep up the excellent work!',
          'Share your streak with friends',
          'Set a new streak goal',
          'Reward yourself for your dedication'
        ],
        priority: 'low',
        estimatedImpact: 'Maintain motivation and build confidence'
      })
    } else if (studyStreak >= 3) {
      advice.push({
        type: 'encouragement',
        title: 'Building Momentum!',
        message: `Great job! You're on a ${studyStreak}-day study streak. Consistency is key to long-term success.`,
        actionItems: [
          'Aim for a 7-day streak',
          'Use the study timer to maintain consistency',
          'Track your progress in the analytics'
        ],
        priority: 'low',
        estimatedImpact: 'Build sustainable study habits'
      })
    }

    // Weekly achievements
    if (analytics.weeklyAchievements > 0) {
      advice.push({
        type: 'celebration',
        title: 'Weekly Achievements Unlocked!',
        message: `You've achieved ${analytics.weeklyAchievements} goal${analytics.weeklyAchievements > 1 ? 's' : ''} this week. Your hard work is paying off!`,
        actionItems: [
          'Review your achievements in the goals section',
          'Set new goals for next week',
          'Share your success with your study community'
        ],
        priority: 'low',
        estimatedImpact: 'Boost motivation and self-confidence'
      })
    }

    return advice
  }

  async getStudyRecommendations(): Promise<string[]> {
    if (!this.context) return []

    const { currentSubject, energyLevel, recentSessions } = this.context
    const recommendations: string[] = []

    // Subject-specific recommendations
    if (currentSubject.toLowerCase().includes('math')) {
      recommendations.push('Practice with step-by-step problem solving')
      recommendations.push('Use the formula sheet for quick reference')
      recommendations.push('Try the question bank for varied problems')
    } else if (currentSubject.toLowerCase().includes('science')) {
      recommendations.push('Create concept maps for complex topics')
      recommendations.push('Use flashcards for terminology')
      recommendations.push('Review lab procedures and safety protocols')
    } else if (currentSubject.toLowerCase().includes('language')) {
      recommendations.push('Practice speaking and listening exercises')
      recommendations.push('Use flashcards for vocabulary building')
      recommendations.push('Read authentic materials in the target language')
    } else if (currentSubject.toLowerCase().includes('history')) {
      recommendations.push('Create timelines for historical events')
      recommendations.push('Use mind maps for cause-and-effect relationships')
      recommendations.push('Practice essay writing with historical analysis')
    }

    // Energy-based recommendations
    if (energyLevel >= 4) {
      recommendations.push('Tackle challenging new material')
      recommendations.push('Use the study timer for focused sessions')
      recommendations.push('Try the exam analyzer for practice tests')
    } else if (energyLevel >= 2) {
      recommendations.push('Review familiar material')
      recommendations.push('Use flashcards for light practice')
      recommendations.push('Organize notes and materials')
    } else {
      recommendations.push('Take a short break to recharge')
      recommendations.push('Do light reading or listening')
      recommendations.push('Plan tomorrow\'s study schedule')
    }

    return recommendations
  }

  async getBurnoutPreventionTips(): Promise<string[]> {
    return [
      'Take regular breaks every 45-60 minutes',
      'Practice stress-reduction techniques (deep breathing, meditation)',
      'Maintain a consistent sleep schedule',
      'Exercise regularly to reduce stress',
      'Stay hydrated and eat nutritious meals',
      'Set realistic study goals',
      'Celebrate small achievements',
      'Connect with study buddies for support',
      'Use the inspiration generator when feeling stuck',
      'Listen to your body and rest when needed'
    ]
  }
}

// Export singleton instance
export const studyAdvisor = new StudyAdvisor()

