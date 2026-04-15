import { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from './store'
import LoginForm from './LoginForm'
import type { NormalizedListEntry, LectureListStatus } from '../lib/types'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function statusBadgeClass(status: LectureListStatus): string {
  switch (status) {
    case '접수중': return 'bg-blue-50 text-blue-600'
    case '마감': return 'bg-gray-100 text-gray-500'
    case '대기': return 'bg-yellow-50 text-yellow-600'
  }
}

function enrollBadgeClass(current: number, max: number): string {
  if (current >= max) return 'text-red-500'
  if (current >= max * 0.7) return 'text-yellow-600'
  return 'text-green-600'
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

const TIME_OPTIONS = [
  { label: '전체', from: 0, to: 1440 },
  { label: '오전 (~ 12시)', from: 0, to: 720 },
  { label: '오후 (12 ~ 18시)', from: 720, to: 1080 },
  { label: '저녁 (18시 ~)', from: 1080, to: 1440 },
]

export default function AllLecturesView() {
  const {
    allLectures,
    allLecturesLoading,
    allLecturesProgress,
    allLecturesError,
    refreshDayLectures,
    tabOrigin,
    entries,
  } = useStore(
    useShallow((s) => ({
      allLectures: s.allLectures,
      allLecturesLoading: s.allLecturesLoading,
      allLecturesProgress: s.allLecturesProgress,
      allLecturesError: s.allLecturesError,
      refreshDayLectures: s.refreshDayLectures,
      tabOrigin: s.tabOrigin,
      entries: s.entries,
    })),
  )

  /** 접수완료된 qustnrSn 세트 */
  const registeredSet = useMemo(() => {
    const s = new Set<string>()
    for (const e of entries) {
      if (e.status === '접수완료') s.add(e.qustnrSn)
    }
    return s
  }, [entries])

  const [statusFilter, setStatusFilter] = useState<LectureListStatus | '전체'>('전체')
  const [categoryFilter, setCategoryFilter] = useState<string>('전체')
  const [timeFilter, setTimeFilter] = useState(0)
  const [currentDate, setCurrentDate] = useState(() => getToday())

  const currentDateKey = toDateKey(currentDate)

  /** 이미 fetch한 날짜를 추적 */
  const fetchedDatesRef = useRef<Set<string>>(new Set())

  /** 날짜별 강의 Map (O(1) lookup) */
  const lecturesByDate = useMemo(() => {
    const m = new Map<string, NormalizedListEntry[]>()
    for (const e of allLectures) {
      const arr = m.get(e.lectureDate)
      if (arr) arr.push(e)
      else m.set(e.lectureDate, [e])
    }
    return m
  }, [allLectures])

  const dayAllEntries = useMemo(
    () => lecturesByDate.get(currentDateKey) ?? [],
    [lecturesByDate, currentDateKey],
  )
  const hasCacheForDay = dayAllEntries.length > 0
  const totalForDay = dayAllEntries.length

  /** 날짜가 바뀌면 캐시가 없는 경우 자동 fetch */
  useEffect(() => {
    if (!hasCacheForDay && !allLecturesLoading && !fetchedDatesRef.current.has(currentDateKey)) {
      fetchedDatesRef.current.add(currentDateKey)
      refreshDayLectures(currentDateKey)
    }
  }, [currentDateKey, hasCacheForDay, allLecturesLoading, refreshDayLectures])

  /** 현재 날짜에 해당하는 강의 (필터 적용) */
  const dayEntries = useMemo(() => {
    const tf = TIME_OPTIONS[timeFilter]
    return dayAllEntries
      .filter((e) => statusFilter === '전체' || e.status === statusFilter)
      .filter((e) => categoryFilter === '전체' || e.category === categoryFilter)
      .filter((e) => e.startMinutes >= tf.from && e.startMinutes < tf.to)
  }, [dayAllEntries, statusFilter, categoryFilter, timeFilter])

  const goToDate = useCallback((offset: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + offset)
      return next
    })
  }, [])

  const isToday = currentDateKey === toDateKey(getToday())

  const [toast, setToast] = useState(false)
  const handleShare = useCallback((entry: NormalizedListEntry) => {
    const text = `${entry.title} · ${entry.author} · ${minutesToTime(entry.startMinutes)}~${minutesToTime(entry.endMinutes)}\n${tabOrigin}${entry.detailUrl}`
    navigator.clipboard.writeText(text).then(() => {
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    })
  }, [tabOrigin])

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
        <button
          onClick={() => goToDate(-1)}
          disabled={allLecturesLoading}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default text-gray-600"
        >
          ◀
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={currentDateKey}
            onChange={(e) => {
              if (e.target.value) setCurrentDate(new Date(e.target.value))
            }}
            className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer text-center"
          />
          <span className="text-xs text-gray-500">
            ({DAY_LABELS[currentDate.getDay()]})
          </span>
          {isToday && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">
              오늘
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => refreshDayLectures(currentDateKey)}
            disabled={allLecturesLoading}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default text-gray-500"
            title="이 날짜 새로고침"
          >
            ↻
          </button>
          <button
            onClick={() => goToDate(1)}
            disabled={allLecturesLoading}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default text-gray-600"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['전체', '접수중', '마감'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${statusFilter === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-50 text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
                }`}
            >
              {s}
            </button>
          ))}
          <span className="text-gray-200 mx-0.5">|</span>
          {(['전체', '멘토특강', '자유멘토링'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${categoryFilter === c
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-50 text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
                }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TIME_OPTIONS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTimeFilter(i)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${timeFilter === i
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-50 text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
                }`}
            >
              {t.label}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 ml-auto">
            {dayEntries.length}/{totalForDay}개
          </span>
        </div>
      </div>

      {/* 강의 목록 */}
      <div className="flex-1 overflow-y-auto [will-change:transform]">
        {allLecturesLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-brand-600">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            {allLecturesProgress && (
              <p className="text-xs text-gray-400">
                {allLecturesProgress.current} / {allLecturesProgress.total} 페이지
              </p>
            )}
          </div>
        ) : allLecturesError ? (
          allLecturesError.includes('로그인') ? (
            <LoginForm onSuccess={() => refreshDayLectures(currentDateKey)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2 px-6 text-center">
              <p className="text-xs text-red-500">{allLecturesError}</p>
              <button onClick={() => refreshDayLectures(currentDateKey)} className="text-xs text-brand-600 underline">
                다시 시도
              </button>
            </div>
          )
        ) : dayEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            {totalForDay === 0 ? '이 날짜에 강의가 없습니다.' : '필터 조건에 맞는 강의가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dayEntries.map((entry) => (
              <LectureCard key={`${entry.qustnrSn}-${entry.no}`} entry={entry} tabOrigin={tabOrigin} onShare={handleShare} registered={registeredSet.has(entry.qustnrSn)} />
            ))}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg animate-fade-in">
          복사되었습니다!
        </div>
      )}
    </div>
  )
}

const LectureCard = memo(function LectureCard({ entry, tabOrigin, onShare, registered }: { entry: NormalizedListEntry; tabOrigin: string; onShare: (entry: NormalizedListEntry) => void; registered: boolean }) {
  return (
    <div className={`px-4 py-3 [contain:content] ${registered ? 'bg-brand-50/60 border-l-2 border-brand-500' : 'hover:bg-brand-50'}`}>
      <a
        href={`${tabOrigin}${entry.detailUrl}`}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <p
          className={`font-medium leading-snug line-clamp-2 ${entry.status === '접수중' ? 'text-brand-700' : 'text-gray-400'}`}
        >
          {entry.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {entry.author} · {minutesToTime(entry.startMinutes)}~{minutesToTime(entry.endMinutes)}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusBadgeClass(entry.status)}`}>
            {entry.status}
          </span>
          <span className="text-[10px] text-gray-300">·</span>
          <span className={`text-[10px] font-medium ${enrollBadgeClass(entry.enrollCurrent, entry.enrollMax)}`}>
            {entry.enrollCurrent}/{entry.enrollMax}명
          </span>
          <span className="text-[10px] text-gray-300">·</span>
          <span className="text-[10px] text-gray-500">{entry.category}</span>
          {registered && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
              접수완료
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); onShare(entry) }}
            className="text-[10px] text-emerald-600 hover:underline ml-auto"
          >
            공유하기
          </button>
        </div>
      </a>
    </div>
  )
})