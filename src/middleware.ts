import { NextResponse } from 'next/server'

export async function middleware(req: Request) {
  // Redirect unauthenticated users from / and /calendar to /login.
  // We rely on Supabase client on the page to redirect after session check,
  // but we proactively push from the root route here.
  const url = new URL(req.url)
  if (url.pathname === '/') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/calendar']
}

