import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the iCal content server-side
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Studyverse/1.0',
        'Accept': 'text/calendar, text/plain, */*'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch calendar: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const icalContent = await response.text();
    
    // Parse the iCal content
    const events = parseICalContent(icalContent);
    
    if (events.length === 0) {
      return NextResponse.json(
        { error: 'No events found in the calendar feed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('iCal import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import calendar' },
      { status: 500 }
    );
  }
}

function parseICalContent(content: string) {
  const events: Array<{
    summary?: string;
    description?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    location?: string;
  }> = [];
  
  const lines = content.split('\n');
  let currentEvent: any = {};
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      inEvent = false;
    } else if (inEvent) {
      const [rawKey, ...valueParts] = line.split(':');
      const value = valueParts.join(':');
      const key = rawKey.split(';')[0]; // handle DTSTART;TZID=... etc
      
      switch (key) {
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
          break;
        default:
          if (key.startsWith('DTSTART')) {
            currentEvent.start = parseICalDate(value);
            currentEvent.allDay = value.length === 8; // YYYYMMDD format
          } else if (key.startsWith('DTEND')) {
            currentEvent.end = parseICalDate(value);
          } else if (key === 'LOCATION') {
            currentEvent.location = value;
          }
          break;
      }
    }
  }
  
  return events;
}

function parseICalDate(dateStr: string): Date {
  // Normalize by removing parameters (just in case)
  const val = dateStr.trim();
  if (val.includes('T')) {
    // DateTime format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
    const year = parseInt(val.substring(0, 4));
    const month = parseInt(val.substring(4, 6)) - 1;
    const day = parseInt(val.substring(6, 8));
    const hour = parseInt(val.substring(9, 11));
    const minute = parseInt(val.substring(11, 13));
    const second = parseInt(val.substring(13, 15)) || 0;
    const isUTC = /Z$/.test(val);

    if (isUTC) {
      // Interpret as UTC then convert to local via Date
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    // Local time
    return new Date(year, month, day, hour, minute, second);
  } else {
    // Date format: YYYYMMDD (all-day)
    const year = parseInt(val.substring(0, 4));
    const month = parseInt(val.substring(4, 6)) - 1;
    const day = parseInt(val.substring(6, 8));
    return new Date(year, month, day);
  }
} 
