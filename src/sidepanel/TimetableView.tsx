import { useState, useMemo, useEffect } from 'react'
import { useStore } from './store'
import type { NormalizedEntry } from '../lib/types'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_START = 9 * 60   // 09:00
const SLOT_END = 22 * 60    // 22:00 (exclusive)

// 해당 날짜가 속한 주의 월요일 00:00 반환
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  if (isNaN(d.getTime())) return new Date(new Date().setHours(0, 0, 0, 0))
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

interface PopoverState {
  dayIndex: number
  min: number
  entries: NormalizedEntry[]
}

// 해당 슬롯과 겹치는 모든 항목 (시작~종료 사이에 min이 포함되는 것들)
function getSlotEntries(
  allEntries: NormalizedEntry[],
  weekStart: Date,
  dayIndex: number,
  min: number,
): NormalizedEntry[] {
  const weekEnd = addDays(weekStart, 7)
  return allEntries.filter((e) => {
    if (e.status !== '접수완료') return false
    const d = e.lectureDateObj
    if (d < weekStart || d >= weekEnd) return false
    const raw = d.getDay()
    const di = raw === 0 ? 6 : raw - 1
    return di === dayIndex && e.startMinutes <= min && min < e.endMinutes
  })
}

export default function TimetableView() {
  const { entries } = useStore()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [autoNavigated, setAutoNavigated] = useState(false)
  const [popover, setPopover] = useState<PopoverState | null>(null)

  // entries 로드 시 가장 가까운 강좌 주로 자동 이동
  useEffect(() => {
    if (autoNavigated || entries.length === 0) return
    const completed = entries.filter((e) => e.status === '접수완료')
    if (completed.length === 0) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcoming = completed.filter((e) => e.lectureDateObj >= today)
    const target = upcoming.length > 0 ? upcoming[0] : completed[completed.length - 1]

    setWeekStart(getWeekStart(target.lectureDateObj))
    setAutoNavigated(true)
  }, [entries, autoNavigated])

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

      {/* 범례 */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 text-[10px] text-gray-500">
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

      {/* 요일 헤더 (고정) */}
      <div className="flex text-[10px] border-b border-gray-100">
        <div className="w-10 flex-shrink-0" />
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="flex-1 py-1 text-center font-semibold text-gray-500">
            {label}
          </div>
        ))}
      </div>

      {/* 시간표 그리드 + 팝오버 컨테이너 */}
      <div className="flex-1 relative overflow-hidden">
        {/* 스크롤 영역 */}
        <div className="h-full overflow-auto">
          <table className="w-full text-[10px] border-collapse">
            <tbody>
              {rows.map((min) => (
                <tr key={min} className="h-5">
                  {/* 시간 레이블: 정각만 표시 */}
                  <td className="w-10 sticky left-0 bg-white text-right pr-1 text-gray-400 align-top leading-none whitespace-nowrap">
                    {min % 60 === 0 ? formatHM(min) : ''}
                  </td>
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const count = slots.get(`${dayIndex}-${min}`)?.length ?? 0
                    return (
                      <td
                        key={dayIndex}
                        onClick={
                          count > 0
                            ? () =>
                                setPopover({
                                  dayIndex,
                                  min,
                                  entries: getSlotEntries(entries, weekStart, dayIndex, min),
                                })
                            : undefined
                        }
                        className={`border-l border-gray-50 ${
                          min % 60 === 0 ? 'border-t border-gray-100' : ''
                        } ${overlapColor(count)} ${count > 0 ? 'cursor-pointer hover:opacity-70' : ''}`}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 슬롯 클릭 팝오버 */}
        {popover && (
          <>
            <div className="absolute inset-0 z-10" onClick={() => setPopover(null)} />
            <div className="absolute inset-x-2 top-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 flex flex-col">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-700">
                  {(() => {
                    const day = addDays(weekStart, popover.dayIndex)
                    return `${day.getMonth() + 1}/${day.getDate()}(${DAY_SHORT[day.getDay()]}) ${formatHM(popover.min)}`
                  })()}
                </span>
                <button
                  onClick={() => setPopover(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm leading-none"
                >
                  ✕
                </button>
              </div>
              {/* 항목 목록 */}
              <div className="overflow-y-auto">
                {popover.entries.map((entry, i) => (
                  <div key={entry.no} className={`px-3 py-2 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                    <p className="text-xs font-medium text-gray-800 leading-snug mb-0.5 line-clamp-2">
                      {entry.title}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {entry.author} · {formatHM(entry.startMinutes)}~{formatHM(entry.endMinutes)}
                    </p>
                    <a
                      href={`https://swmaestro.ai${entry.detailUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-brand-600 hover:underline"
                    >
                      상세보기 →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
