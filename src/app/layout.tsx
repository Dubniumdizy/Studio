import './globals.css';
import { cn } from '@/lib/utils';
import { AppRoot } from '@/components/app-root';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full")} suppressHydrationWarning>
      <head>
        <title>Studyverse Garden</title>
        <meta name="description" content="Nurture your knowledge and watch it grow." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#6b9d7f" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Studyverse" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased h-full flex flex-col min-h-0")} suppressHydrationWarning>
        <AppRoot>{children}</AppRoot>
      </body>
    </html>
  );
}
