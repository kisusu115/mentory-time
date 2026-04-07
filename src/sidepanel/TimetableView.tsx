import { useState, useMemo } from 'react'
import { useStore } from './store'
import type { NormalizedEntry } from '../lib/types'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_START = 9 * 60   // 09:00
const SLOT_END = 22 * 60    // 22:00 (exclusive)

// 해당 날짜가 속한 주의 월요일 00:00 반환
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=일, 1=월 ...
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// "dayIndex-minutes" → NormalizedEntry[] 슬롯 맵 (30분 단위)
function buildSlots(entries: NormalizedEntry[], weekStart: Date) {
  const slots = new Map<string, NormalizedEntry[]>()
  const weekEnd = addDays(weekStart, 7)

  for (const entry of entries) {
    if (entry.status !== '접수완료') continue
    const d = entry.lectureDateObj
    if (d < weekStart || d >= weekEnd) continue

    // dayIndex: 월=0 ... 일=6
    const raw = d.getDay()
    const dayIndex = raw === 0 ? 6 : raw - 1

    for (let min = entry.startMinutes; min < entry.endMinutes; min += 30) {
      if (min < SLOT_START || min >= SLOT_END) continue
      const key = `${dayIndex}-${min}`
      if (!slots.has(key)) slots.set(key, [])
      slots.get(key)!.push(entry)
    }
  }
  return slots
}

function overlapColor(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'bg-[#C8E6C9]'
  if (count === 2) return 'bg-[#FFF9C4]'
  return 'bg-[#FFCDD2]'
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${DAY_SHORT[d.getDay()]})`
  return `${fmt(weekStart)} ~ ${fmt(weekEnd)}`
}

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// 09:00 ~ 21:30 사이 30분 슬롯 목록
const TIME_ROWS: number[] = []
for (let m = SLOT_START; m < SLOT_END; m += 30) TIME_ROWS.push(m)

export default function TimetableView() {
  const { entries } = useStore()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))

  const slots = useMemo(() => buildSlots(entries, weekStart), [entries, weekStart])

  const prevWeek = () => setWeekStart((w) => addDays(w, -7))
  const nextWeek = () => setWeekStart((w) => addDays(w, 7))

  // 이번 주에 데이터가 있는 시간 범위만 표시 (없으면 전체)
  const activeRows = useMemo(() => {
    const used = new Set<number>()
    slots.forEach((_, key) => {
      const min = parseInt(key.split('-')[1])
      used.add(min)
    })
    if (used.size === 0) return TIME_ROWS
    const minMin = Math.min(...used)
    const maxMin = Math.max(...used)
    // 앞뒤로 30분 여유
    return TIME_ROWS.filter((m) => m >= minMin - 30 && m <= maxMin + 30)
  }, [slots])

  const rows = activeRows.length > 0 ? activeRows : TIME_ROWS

  return (
    <div className="flex flex-col h-full">
      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <button
          onClick={prevWeek}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-600 transition-colors"
        >
          ◀
        </button>
        <span className="text-xs font-semibold text-gray-700">{formatWeekLabel(weekStart)}</span>
        <button
          onClick={nextWeek}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-600 transition-colors"
        >
          ▶
        </button>
      </div>

      {/* 시간표 그리드 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="w-10 sticky left-0 bg-white" />
              {DAY_LABELS.map((label, i) => (
                <th
                  key={i}
                  className="py-1 font-semibold text-gray-500 border-b border-gray-100 text-center"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((min) => (
              <tr key={min} className="h-5">
                {/* 시간 레이블: 정각만 표시 */}
                <td className="sticky left-0 bg-white text-right pr-1 text-gray-400 align-top leading-none whitespace-nowrap">
                  {min % 60 === 0 ? formatHM(min) : ''}
                </td>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const count = slots.get(`${dayIndex}-${min}`)?.length ?? 0
                  return (
                    <td
                      key={dayIndex}
                      className={`border-l border-gray-50 ${
                        min % 60 === 0 ? 'border-t border-gray-100' : ''
                      } ${overlapColor(count)}`}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 범례 */}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#C8E6C9]" /> 1개
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#FFF9C4]" /> 2개 겹침
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#FFCDD2]" /> 3개 이상
          </span>
        </div>
      </div>
    </div>
  )
}
