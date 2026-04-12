import type { NormalizedEntry } from './types'
import { addDays, toDayIndex, type WeekStartDay } from './week'

const SLOT_START = 9 * 60   // 09:00
const SLOT_END = 23 * 60    // 23:00 (exclusive)

/** 09:00 ~ 22:30 사이 30분 슬롯 목록 */
export const TIME_ROWS: number[] = []
for (let m = SLOT_START; m < SLOT_END; m += 30) TIME_ROWS.push(m)

/** 주간 범위 내 접수완료 엔트리 필터 */
function weekEntries(entries: NormalizedEntry[], weekStart: Date): NormalizedEntry[] {
  const weekEnd = addDays(weekStart, 7)
  return entries.filter((e) =>
    e.status === '접수완료' &&
    e.lectureDateObj >= weekStart &&
    e.lectureDateObj < weekEnd,
  )
}

/** "dayIndex-minutes" → NormalizedEntry[] 슬롯 맵 (30분 단위) */
export function buildSlots(
  entries: NormalizedEntry[],
  weekStart: Date,
  weekStartDay: WeekStartDay,
): Map<string, NormalizedEntry[]> {
  const slots = new Map<string, NormalizedEntry[]>()

  for (const entry of weekEntries(entries, weekStart)) {
    const dayIndex = toDayIndex(entry.lectureDateObj.getDay(), weekStartDay)

    for (let min = entry.startMinutes; min < entry.endMinutes; min += 30) {
      if (min < SLOT_START || min >= SLOT_END) continue
      const key = `${dayIndex}-${min}`
      if (!slots.has(key)) slots.set(key, [])
      slots.get(key)!.push(entry)
    }
  }
  return slots
}

/** 해당 슬롯과 겹치는 모든 항목 (시작~종료 사이에 min이 포함되는 것들) */
export function getSlotEntries(
  allEntries: NormalizedEntry[],
  weekStart: Date,
  dayIndex: number,
  min: number,
  weekStartDay: WeekStartDay,
): NormalizedEntry[] {
  return weekEntries(allEntries, weekStart).filter((e) => {
    const di = toDayIndex(e.lectureDateObj.getDay(), weekStartDay)
    return di === dayIndex && e.startMinutes <= min && min < e.endMinutes
  })
}

export function overlapColor(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'bg-[#B7DEB8]'
  if (count === 2) return 'bg-[#FFF59D]'
  return 'bg-[#F7B3B6]'
}
