import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, message, body: emailBody, html } = body

    // Validate required fields
    if (!to || !subject || (!emailBody && !message)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and either body or message' },
        { status: 400 }
      )
    }

    // Use message if provided, otherwise use emailBody
    const emailContent = message || emailBody

    // In a real implementation, you would integrate with an email service
    // like SendGrid, Mailgun, or AWS SES. For now, we'll simulate the email sending.
    
    console.log('Email would be sent:', {
      to,
      subject,
      body: emailContent,
      html,
      timestamp: new Date().toISOString()
    })

    // Example SendGrid integration (uncomment and configure):
    /*
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'noreply@studyversegarden.com' },
        subject: subject,
        content: [
          { type: 'text/plain', value: emailContent },
          { type: 'text/html', value: html || emailContent }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.statusText}`)
    }
    */

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json(
      { 
        success: true, 
        message: 'Email sent successfully',
        emailId: `email_${Date.now()}`
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Email sending error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Email API endpoint',
      usage: 'POST with { to, subject, body, html? }'
    },
    { status: 200 }
  )
} 