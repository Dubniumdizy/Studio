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
  const events: Array<any> = [];
  
  const lines = content.split('\n');
  let currentEvent: any = {};
  let inEvent = false;
  let lastKey = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line folding (lines starting with space/tab continue previous line)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      inEvent = false;
    } else if (inEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const rawKey = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      const key = rawKey.split(';')[0]; // handle DTSTART;TZID=... etc
      
      // Clean and unescape value
      const cleanValue = value
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
      
      // Store with lowercase key for consistency
      const lowerKey = key.toLowerCase();
      lastKey = lowerKey;
      
      switch (key) {
        case 'SUMMARY':
          // Replace backslashes with nothing to join (e.g., "CTMAT\1" -> "CTMAT1")
          currentEvent.summary = cleanValue.replace(/\\/g, '');
          break;
        case 'DESCRIPTION':
          currentEvent.description = cleanValue;
          break;
        case 'LOCATION':
          currentEvent.location = cleanValue;
          break;
        case 'ORGANIZER':
          currentEvent.organizer = cleanValue.replace(/^mailto:/i, '');
          break;
        case 'ATTENDEE':
          if (!currentEvent.attendees) currentEvent.attendees = [];
          currentEvent.attendees.push(cleanValue.replace(/^mailto:/i, ''));
          break;
        case 'CATEGORIES':
          // Split on both commas and forward slashes, but keep course codes intact
          currentEvent.categories = cleanValue
            .split(/[,\/]/)  // Split on comma OR forward slash
            .map((c: string) => c.trim().replace(/\\/g, ''))  // Remove backslashes
            .filter((c: string) => c.length > 0);  // Remove empty strings
          break;
        case 'RESOURCES':
          // Split on both commas and forward slashes
          currentEvent.resources = cleanValue
            .split(/[,\/]/)
            .map((r: string) => r.trim().replace(/\\/g, ''))
            .filter((r: string) => r.length > 0);
          break;
        case 'STATUS':
          currentEvent.status = cleanValue;
          break;
        case 'CLASS':
          currentEvent.class = cleanValue;
          break;
        case 'PRIORITY':
          currentEvent.priority = cleanValue;
          break;
        case 'URL':
          currentEvent.url = cleanValue;
          break;
        default:
          if (key.startsWith('DTSTART')) {
            currentEvent.start = parseICalDate(value);
            currentEvent.allDay = value.length === 8; // YYYYMMDD format
          } else if (key.startsWith('DTEND')) {
            currentEvent.end = parseICalDate(value);
          } else if (key.startsWith('X-')) {
            // Store custom X- properties
            currentEvent[lowerKey] = cleanValue;
          } else {
            // Store any other unrecognized fields
            currentEvent[lowerKey] = cleanValue;
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
