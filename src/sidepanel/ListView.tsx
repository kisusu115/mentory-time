import { useState } from 'react'
import { useStore } from './store'
import { buildGoogleCalendarUrl } from '../lib/calendar'
import LoginForm from './LoginForm'
import type { NormalizedEntry } from '../lib/types'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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

export default function ListView() {
  const { entries, loading, progress, error, fetchAll, cancelRegistration, hideCancel, toggleHideCancel, tabOrigin } = useStore()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelMsg, setCancelMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const handleCancel = async (entry: NormalizedEntry) => {
    if (!entry.cancelId) return
    if (!confirm(`"${entry.title}" 접수를 취소하시겠습니까?`)) return
    setCancellingId(entry.qustnrSn)
    const result = await cancelRegistration(entry.cancelId, entry.qustnrSn)
    setCancellingId(null)
    setCancelMsg({ text: result.message, ok: result.success })
    setTimeout(() => setCancelMsg(null), 3000)
  }
  const [showPast, setShowPast] = useState(false)

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
        <button onClick={fetchAll} className="text-xs text-brand-600 underline">
          다시 시도
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

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* 필터 바 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-wrap">
        <button
          onClick={toggleHideCancel}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${!hideCancel
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-gray-50 text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
            }`}
        >
          접수 취소 포함
        </button>
        <button
          onClick={() => setShowPast((v) => !v)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${showPast
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-gray-50 text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
            }`}
        >
          이전 기록 포함
        </button>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="ml-auto w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default text-gray-500"
          title="접수 목록 새로고침"
        >
          ↻
        </button>
      </div>

      {/* 날짜 그룹 목록 */}
      <div className="flex-1 overflow-y-auto">
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
                  <div key={entry.qustnrSn} className="px-4 py-3 hover:bg-brand-50 transition-colors">
                    <a
                      href={`${tabOrigin}${entry.detailUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <p
                        className={`font-medium leading-snug line-clamp-2 ${entry.status === '접수완료' ? 'text-brand-700' : 'text-gray-400'
                          }`}
                      >
                        {entry.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.author} · {entry.lectureStartTime.slice(0, 5)}~{entry.lectureEndTime.slice(0, 5)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${entry.status === '접수완료'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-500'
                            }`}
                        >
                          {entry.status}
                        </span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-500">{entry.category}</span>
                      </div>
                    </a>
                    <div className="mt-1 flex items-center gap-3">
                      <a
                        href={buildGoogleCalendarUrl(entry, tabOrigin)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-600 hover:underline"
                      >
                        Google Calendar에 추가
                      </a>
                      {entry.cancelId && entry.status === '접수완료' && (
                        <button
                          onClick={() => handleCancel(entry)}
                          disabled={cancellingId === entry.qustnrSn}
                          className="text-[10px] text-red-500 hover:underline disabled:opacity-40"
                        >
                          {cancellingId === entry.qustnrSn ? '취소 중...' : '접수 취소'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 취소 결과 토스트 */}
      {cancelMsg && (
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs rounded-lg shadow-lg ${cancelMsg.ok ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'}`}>
          {cancelMsg.text}
        </div>
      )}
    </div>
  )
}
