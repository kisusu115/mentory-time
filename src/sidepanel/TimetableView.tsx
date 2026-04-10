import { useState, useMemo, useEffect } from 'react'
import { useStore } from './store'
import type { NormalizedEntry } from '../lib/types'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_START = 9 * 60   // 09:00
const SLOT_END = 23 * 60    // 23:00 (exclusive)

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
  if (count === 1) return 'bg-[#B7DEB8]'
  if (count === 2) return 'bg-[#FFCC99]'
  return 'bg-[#F7B3B6]'
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

// 09:00 ~ 22:30 사이 30분 슬롯 목록
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
  const { entries, previewEntry, pendingQustnrSn, activatePreview, clearPreview, tabOrigin, locationCache, fetchLocation } = useStore()
  const [alreadyRegisteredMsg, setAlreadyRegisteredMsg] = useState(false)

  const handleSimulate = async () => {
    if (!pendingQustnrSn) return
    const isAlready = await activatePreview(pendingQustnrSn)
    if (isAlready) {
      setAlreadyRegisteredMsg(true)
      setTimeout(() => setAlreadyRegisteredMsg(false), 3000)
    }
  }
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const todayIndex = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isThisWeek = today >= weekStart && today < addDays(weekStart, 7)
    if (!isThisWeek) return -1
    const raw = today.getDay()
    return raw === 0 ? 6 : raw - 1
  }, [weekStart])
  const [autoNavigated, setAutoNavigated] = useState(false)
  const [popover, setPopover] = useState<PopoverState | null>(null)

  // 팝오버 열릴 때 장소 정보 lazy fetch
  useEffect(() => {
    if (!popover) return
    popover.entries.forEach((entry) => {
      if (locationCache[entry.qustnrSn] === undefined) {
        void fetchLocation(entry.qustnrSn)
      }
    })
  }, [popover, locationCache, fetchLocation])

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

  // 미리보기 활성 시 해당 주로 자동 이동
  const previewData = useMemo(() => {
    if (!previewEntry) return null
    const date = new Date(previewEntry.lectureDate)
    if (isNaN(date.getTime())) return null
    const raw = date.getDay()
    const dayIndex = raw === 0 ? 6 : raw - 1
    const [sh = 0, sm = 0] = previewEntry.lectureStartTime.split(':').map(Number)
    const [eh = 0, em = 0] = previewEntry.lectureEndTime.split(':').map(Number)
    return { dayIndex, startMin: sh * 60 + sm, endMin: eh * 60 + em, weekStart: getWeekStart(date) }
  }, [previewEntry])

  useEffect(() => {
    if (previewData) setWeekStart(previewData.weekStart)
  }, [previewData])

  const slots = useMemo(() => buildSlots(entries, weekStart), [entries, weekStart])

  const prevWeek = () => setWeekStart((w) => addDays(w, -7))
  const nextWeek = () => setWeekStart((w) => addDays(w, 7))

  const rows = TIME_ROWS

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

      {/* 범례 + 시뮬레이션 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        {/* 좌측: 시뮬레이션 컨트롤 */}
        <div className="flex items-center h-7">
          {alreadyRegisteredMsg ? (
            <span className="text-xs text-amber-600 font-medium">이미 접수완료된 특강입니다</span>
          ) : pendingQustnrSn && !previewEntry ? (
            <button
              onClick={handleSimulate}
              className="px-2.5 py-1 bg-orange-500 text-white text-xs font-bold rounded hover:bg-orange-600 transition-colors"
            >
              시뮬레이션
            </button>
          ) : previewEntry ? (
            <button
              onClick={clearPreview}
              className="px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-400 rounded hover:bg-orange-200 transition-colors"
            >
              반영 해제
            </button>
          ) : (
            <div className="h-5" />
          )}
        </div>
        {/* 우측: 범례 */}
        <div className="flex items-center gap-2.5 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#B7DEB8]" /> 1개
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#FFCC99]" /> 2개 겹침
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#F7B3B6]" /> 3개 이상
          </span>
        </div>
      </div>

      {/* 시간표 그리드 + 팝오버 컨테이너 */}
      <div className="flex-1 relative overflow-hidden">
        {/* 스크롤 영역 */}
        <div className="h-full overflow-auto">
          <table className="w-full text-[10px] border-collapse table-fixed">
            {/* 요일 헤더 (sticky) */}
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-gray-100">
                <td className="w-10" />
                {DAY_LABELS.map((label, i) => {
                  const date = addDays(weekStart, i)
                  const isToday = i === todayIndex
                  return (
                    <td key={i} className={`py-0.5 text-center ${isToday ? 'border-b-2 border-brand-600' : ''}`}>
                      <div className={`text-[10px] font-semibold pb-0.5 ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>{label}</div>
                      <div className={`text-[11px] font-bold pt-0.5 border-t border-gray-100 ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>{date.getDate()}</div>
                    </td>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((min) => (
                <tr key={min} className="h-5">
                  {/* 시간 레이블: 정각만 표시 */}
                  <td className="w-10 sticky left-0 bg-white text-right pr-1 text-gray-400 align-top leading-none whitespace-nowrap">
                    {min % 60 === 0 ? formatHM(min) : ''}
                  </td>
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const count = slots.get(`${dayIndex}-${min}`)?.length ?? 0
                    const isPreview =
                      previewData !== null &&
                      weekStart.getTime() === previewData.weekStart.getTime() &&
                      dayIndex === previewData.dayIndex &&
                      min >= previewData.startMin &&
                      min < previewData.endMin
                    return (
                      <td
                        key={dayIndex}
                        onClick={
                          count > 0 && !isPreview
                            ? () =>
                                setPopover({
                                  dayIndex,
                                  min,
                                  entries: getSlotEntries(entries, weekStart, dayIndex, min),
                                })
                            : undefined
                        }
                        className={`border-l border-gray-100 ${
                          min % 60 === 0 ? 'border-t border-gray-200' : 'border-t border-gray-100'
                        } ${isPreview ? overlapColor(count + 1) : overlapColor(count) || 'bg-gray-50'} ${count > 0 && !isPreview ? 'cursor-pointer hover:opacity-70' : ''}`}
                        style={isPreview ? { boxShadow: 'inset 3px 0 0 0 #4B5563' } : undefined}
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
                    {locationCache[entry.qustnrSn] !== undefined && locationCache[entry.qustnrSn] !== '' && (
                      <p className="text-[10px] text-gray-400">
                        📍 {locationCache[entry.qustnrSn]}
                      </p>
                    )}
                    <a
                      href={`${tabOrigin}${entry.detailUrl}`}
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
