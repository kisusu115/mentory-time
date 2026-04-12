import type { NormalizedEntry } from "./types";

function formatGoogleDateTime(lectureDate: string, minutes: number): string {
  const ymd = lectureDate.replace(/-/g, "");
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${ymd}T${h}${m}00`;
}

export function buildGoogleCalendarUrl(
  entry: NormalizedEntry,
  tabOrigin: string,
  location = "",
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: entry.title,
    dates: `${formatGoogleDateTime(entry.lectureDate, entry.startMinutes)}/${formatGoogleDateTime(entry.lectureDate, entry.endMinutes)}`,
    details: `MentoryTime에서 추가한 일정\n상세 페이지: ${tabOrigin}${entry.detailUrl}`,
    ctz: "Asia/Seoul",
  });

  if (location.trim()) {
    params.set("location", location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
