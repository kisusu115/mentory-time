/** 주 시작 요일: 0 = 일요일, 1 = 월요일 */
export type WeekStartDay = 0 | 1

const DAY_LABELS: Record<WeekStartDay, readonly string[]> = {
  0: ['일', '월', '화', '수', '목', '금', '토'],
  1: ['월', '화', '수', '목', '금', '토', '일'],
}

/** JS 요일 이름 (getDay() 순서: 0=일 ~ 6=토) */
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

export function getDayLabels(weekStartDay: WeekStartDay): readonly string[] {
  return DAY_LABELS[weekStartDay]
}

/** JS getDay() 인덱스(0~6)로 요일 약어 반환 */
export function getDayName(jsDay: number): string {
  return DAY_NAMES[jsDay]
}

/** 해당 날짜가 속한 주의 시작일 00:00 반환 */
export function getWeekStart(date: Date, weekStartDay: WeekStartDay): Date {
  const d = new Date(date)
  if (isNaN(d.getTime())) return new Date(new Date().setHours(0, 0, 0, 0))
  d.setHours(0, 0, 0, 0)
  const offset = (d.getDay() - weekStartDay + 7) % 7
  d.setDate(d.getDate() - offset)
  return d
}

/** JS getDay() (0=일~6=토) → 그리드 column index 변환 */
export function toDayIndex(jsDay: number, weekStartDay: WeekStartDay): number {
  return (jsDay - weekStartDay + 7) % 7
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${getDayName(d.getDay())})`
  return `${fmt(weekStart)} ~ ${fmt(weekEnd)}`
}

export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}
