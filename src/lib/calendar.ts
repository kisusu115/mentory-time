import type { NormalizedEntry } from './types'

function toCalendarDateStr(date: string, time: string): string {
  // "2026-04-24" + "14:00:00" → "20260424T140000"
  return date.replace(/-/g, '') + 'T' + time.replace(/:/g, '').slice(0, 6)
}

export function buildGoogleCalendarUrl(
  entry: NormalizedEntry,
  tabOrigin: string,
  location?: string,
): string {
  const text = `${entry.title} - ${entry.author} 멘토`
  const start = toCalendarDateStr(entry.lectureDate, entry.lectureStartTime)
  const end = toCalendarDateStr(entry.lectureDate, entry.lectureEndTime)
  const details = `${tabOrigin}${entry.detailUrl}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${start}/${end}`,
    ctz: 'Asia/Seoul',
    details,
  })
  if (location) params.set('location', location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
