import { useState } from 'react'
import { useStore } from './store'
import LoginForm from './LoginForm'
import type { NormalizedEntry } from '../lib/types'
import GoogleCalendarButton from './GoogleCalendarButton'
import NotionButton from './NotionButton'
import { openHistoryCancelPage } from './cancel'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const RECENT_HOUR_OPTIONS = [
  { value: 0.5, label: '30분' },
  { value: 1, label: '1시간' },
  { value: 2, label: '2시간' },
  { value: 3, label: '3시간' },
  { value: 6, label: '6시간' },
  { value: 12, label: '12시간' },
] as const

function getToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function groupByDate(entries: NormalizedEntry[]): [string, NormalizedEntry[]][] {
  const map = new Map<string, NormalizedEntry[]>()
  for (const entry of entries) {
    const key = entry.lectureDate
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  return Array.from(map.entries())
}

function formatDateHeader(entry: NormalizedEntry): string {
  return `${entry.lectureDate} (${DAY_LABELS[entry.dayOfWeek]})`
}

function getRecentEntries(entries: NormalizedEntry[], hours: number): NormalizedEntry[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  return entries
    .filter((e) => {
      const ts = new Date(e.registDate.replace(' ', 'T')).getTime()
      return !isNaN(ts) && ts >= cutoff
    })
    .sort((a, b) => {
      const ta = new Date(a.registDate.replace(' ', 'T')).getTime()
      const tb = new Date(b.registDate.replace(' ', 'T')).getTime()
      return tb - ta
    })
}

function formatRecentLabel(hours: number): string {
  const opt = RECENT_HOUR_OPTIONS.find((o) => o.value === hours)
  return opt ? opt.label : `${hours}시간`
}

function EntryCard({
  entry,
  tabOrigin,
  entries,
  showNewBadge,
  showDate,
}: {
  entry: NormalizedEntry
  tabOrigin: string
  entries: NormalizedEntry[]
  showNewBadge?: boolean
  showDate?: boolean
}) {
  return (
    <a
      href={`${tabOrigin}${entry.detailUrl}`}
      target="_blank"
      rel="noreferrer"
      className="block px-4 py-3 hover:bg-brand-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {showNewBadge && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
              NEW
            </span>
          )}
          <p
            className={`font-medium leading-snug line-clamp-2 ${
              entry.status === '접수완료' ? 'text-brand-700' : 'text-gray-400'
            }`}
          >
            {entry.title}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotionButton entry={entry} />
          <GoogleCalendarButton entry={entry} tabOrigin={tabOrigin} />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        {entry.author} · {showDate && <>{entry.lectureDate} · </>}
        {entry.lectureStartTime.slice(0, 5)}~{entry.lectureEndTime.slice(0, 5)}
      </p>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              entry.status === '접수완료'
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-500'
            }`}
          >
            {entry.status}
          </span>
          <span className="text-[10px] text-gray-300">·</span>
          <span className="text-[10px] text-gray-500">{entry.category}</span>
        </div>
        {entry.status === '접수완료' && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openHistoryCancelPage(entry, entries, tabOrigin)
            }}
            className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-400 font-medium transition-colors"
          >
            접수 취소
          </button>
        )}
      </div>
    </a>
  )
}

export default function ListView() {
  const {
    entries, loading, progress, error, fetchAll,
    hideCancel, toggleHideCancel, tabOrigin,
    recentHours, setRecentHours,
  } = useStore()
  const [showPast, setShowPast] = useState(false)
  const [recentOpen, setRecentOpen] = useState(true)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-brand-600">
        <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        {progress && (
          <p className="text-xs text-gray-400">
            {progress.current} / {progress.total} 페이지 불러오는 중...
          </p>
        )}
      </div>
    )
  }

  if (error) {
    if (error.includes('로그인')) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoginForm onSuccess={fetchAll} />
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-xs text-red-500">{error}</p>
        <button
          onClick={() => chrome.tabs.create({ url: `${tabOrigin}/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=1` })}
          className="text-xs text-brand-600 font-semibold underline"
        >
          SW마에스트로 로그인하기
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-xs text-gray-400 leading-5">
          SW마에스트로 접수내역 페이지를 방문하거나<br />
          새로고침 버튼을 눌러주세요.
        </p>
        <button
          onClick={fetchAll}
          className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
        >
          불러오기
        </button>
      </div>
    )
  }

  const today = getToday()
  const filtered = entries
    .filter((e) => showPast || e.lectureDateObj >= today)
    .filter((e) => !hideCancel || e.status === '접수완료')
  const groups = groupByDate(filtered)

  const recentEntries = getRecentEntries(filtered, recentHours)

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* 필터 바 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-100 bg-brand-50">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleHideCancel}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              !hideCancel
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-400 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {!hideCancel ? '✓ ' : ''}접수 취소 포함
          </button>
          <button
            onClick={() => setShowPast((v) => !v)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              showPast
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-400 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {showPast ? '✓ ' : ''}이전 기록 포함
          </button>
          <select
            value={recentHours}
            onChange={(e) => setRecentHours(Number(e.target.value))}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-400 bg-white text-gray-600 font-medium hover:border-brand-400 hover:text-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-300 transition-colors"
            title="최근 등록 기준 시간"
          >
            {RECENT_HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                신청 {opt.label} 이내
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-brand-600 disabled:opacity-40 transition-colors"
          title="접수내역 새로고침"
        >
          {loading ? (
            <span className="block w-3.5 h-3.5 border-[1.5px] border-gray-300 border-t-brand-600 rounded-full animate-spin" />
          ) : (
            '↻'
          )}
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* 최근 등록 섹션 */}
        {recentEntries.length > 0 && (
          <div className="border-b-2 border-blue-100">
            <button
              onClick={() => setRecentOpen((v) => !v)}
              className="w-full flex items-center px-4 py-2 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <span className="text-xs font-semibold text-blue-700">
                {recentOpen ? '▾' : '▸'} 신청 {formatRecentLabel(recentHours)} 이내 ({recentEntries.length}건)
              </span>
            </button>
            {recentOpen && (
              <div className="divide-y divide-blue-50 bg-white">
                {recentEntries.map((entry) => (
                  <EntryCard key={entry.qustnrSn} entry={entry} tabOrigin={tabOrigin} entries={entries} showNewBadge showDate />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 날짜 그룹 목록 */}
        {groups.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            해당하는 멘토링/특강이 없습니다.
          </div>
        ) : (
          groups.map(([date, groupEntries]) => (
            <div key={date}>
              <div className="px-4 py-1.5 bg-gray-100 border-b border-gray-200 text-[13px] font-semibold text-gray-700 tracking-wide">
                {formatDateHeader(groupEntries[0])}
              </div>
              <div className="divide-y divide-gray-100">
                {groupEntries.map((entry) => (
                  <EntryCard key={entry.qustnrSn} entry={entry} tabOrigin={tabOrigin} entries={entries} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
