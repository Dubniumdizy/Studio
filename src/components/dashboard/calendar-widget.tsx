"use client"

import { Calendar } from "@/components/ui/calendar"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"

export function CalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar_banner_image')
      if (saved) setBanner(saved)
    } catch {}
  }, [])

  const handleBannerChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { compressImageFileToDataUrl } = await import('@/lib/image-utils')
      const dataUrl = await compressImageFileToDataUrl(file, { maxWidth: 1600, maxHeight: 400, quality: 0.85, mime: 'image/jpeg' })
      try { localStorage.setItem('calendar_banner_image', dataUrl) } catch {}
      setBanner(dataUrl)
    } catch {
      // Fallback: raw
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        try { localStorage.setItem('calendar_banner_image', dataUrl) } catch {}
        setBanner(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }


  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Calendar</CardTitle>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-0">
        {/* Banner with persistent picture */}
        <div className="relative">
          {banner ? (
            <img src={banner} alt="Calendar banner" className="w-full h-28 object-cover" />
          ) : (
            <div className="w-full h-28 bg-muted flex items-center justify-center text-muted-foreground text-sm">Add a banner image</div>
          )}
          <div className="absolute right-2 bottom-2 bg-background/80 backdrop-blur rounded-md px-2 py-1">
            <label className="text-xs font-medium cursor-pointer">
              Change picture
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </label>
          </div>
        </div>

        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="p-0"
          />
        </div>
      </CardContent>
    </Card>
  )
}
