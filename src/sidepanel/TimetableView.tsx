import { useState, useMemo, useEffect } from 'react'
import { useStore } from './store'
import type { NormalizedEntry, GcalEvent } from '../lib/types'
import { getDayLabels, getDayName, getWeekStart, toDayIndex, addDays, formatWeekLabel, formatHM } from '../lib/week'
import { TIME_ROWS, buildSlots, buildGcalSlots, getSlotEntries, getSlotGcalEvents, overlapColor } from '../lib/slots'
import GoogleCalendarButton from './GoogleCalendarButton'
import NotionButton from './NotionButton'
import { openHistoryCancelPage } from './cancel'

const calendarIconUrl = chrome.runtime.getURL('icons/google-calendar-icon.svg')

interface PopoverState {
  dayIndex: number
  min: number
  entries: NormalizedEntry[]
  gcalEvents: GcalEvent[]
}

export default function TimetableView() {
  const { entries, previewEntry, pendingQustnrSn, activatePreview, clearPreview, tabOrigin, locationCache, fetchLocation, weekStartDay, toggleWeekStartDay, fetchAll, loading, gcalConnected, gcalEvents, gcalOverlay, gcalLoading, toggleGcalOverlay, fetchGcalEvents } = useStore()
  const dayLabels = getDayLabels(weekStartDay)
  const [alreadyRegisteredMsg, setAlreadyRegisteredMsg] = useState(false)

  const handleSimulate = async () => {
    if (!pendingQustnrSn) return
    const isAlready = await activatePreview(pendingQustnrSn)
    if (isAlready) {
      setAlreadyRegisteredMsg(true)
      setTimeout(() => setAlreadyRegisteredMsg(false), 3000)
    }
  }

  // anchorDate: 현재 보고 있는 주 안의 임의 날짜 (weekStart는 여기서 파생)
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const weekStart = useMemo(() => getWeekStart(anchorDate, weekStartDay), [anchorDate, weekStartDay])

  const todayIndex = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isThisWeek = today >= weekStart && today < addDays(weekStart, 7)
    if (!isThisWeek) return -1
    return toDayIndex(today.getDay(), weekStartDay)
  }, [weekStart, weekStartDay])

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

    setAnchorDate(target.lectureDateObj)
    setAutoNavigated(true)
  }, [entries, autoNavigated])

  // 미리보기 활성 시 해당 주로 자동 이동
  const previewData = useMemo(() => {
    if (!previewEntry) return null
    const date = new Date(previewEntry.lectureDate)
    if (isNaN(date.getTime())) return null
    const dayIndex = toDayIndex(date.getDay(), weekStartDay)
    const [sh = 0, sm = 0] = previewEntry.lectureStartTime.split(':').map(Number)
    const [eh = 0, em = 0] = previewEntry.lectureEndTime.split(':').map(Number)
    return { dayIndex, startMin: sh * 60 + sm, endMin: eh * 60 + em, weekStart: getWeekStart(date, weekStartDay) }
  }, [previewEntry, weekStartDay])

  useEffect(() => {
    if (previewData) setAnchorDate(new Date(previewData.weekStart))
  }, [previewData])

  const slots = useMemo(() => buildSlots(entries, weekStart, weekStartDay), [entries, weekStart, weekStartDay])
  const gcalSlots = useMemo(
    () => gcalOverlay ? buildGcalSlots(gcalEvents, weekStart, weekStartDay) : new Map(),
    [gcalEvents, weekStart, weekStartDay, gcalOverlay],
  )

  // gcal 오버레이 활성 시 주간 이동 때 자동 re-fetch
  useEffect(() => {
    if (gcalOverlay && gcalConnected) {
      void fetchGcalEvents(weekStart)
    }
  }, [weekStart, gcalOverlay, gcalConnected, fetchGcalEvents])

  const prevWeek = () => setAnchorDate((a) => addDays(a, -7))
  const nextWeek = () => setAnchorDate((a) => addDays(a, 7))

  return (
    <div className="flex flex-col h-full">
      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-600 transition-colors"
          >
            ◀
          </button>
        </div>
        <span className="text-xs font-semibold text-gray-700">{formatWeekLabel(weekStart)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={nextWeek}
            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-600 transition-colors"
          >
            ▶
          </button>
          <button
            onClick={toggleWeekStartDay}
            className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-brand-600 border border-gray-200 rounded transition-colors"
            title={weekStartDay === 1 ? '일요일 시작으로 변경' : '월요일 시작으로 변경'}
          >
            {weekStartDay === 1 ? '월~일' : '일~토'}
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-600 disabled:opacity-40 transition-colors"
            title="접수내역 새로고침"
          >
            {loading ? (
              <span className="block w-3 h-3 border-[1.5px] border-gray-300 border-t-brand-600 rounded-full animate-spin" />
            ) : (
              '↻'
            )}
          </button>
        </div>
      </div>

      {/* 범례 + 시뮬레이션 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        {/* 좌측: 캘린더 토글 + 시뮬레이션 컨트롤 */}
        <div className="flex items-center gap-1.5 h-7">
          {gcalConnected && (
            <button
              onClick={() => {
                toggleGcalOverlay()
                if (!gcalOverlay) void fetchGcalEvents(weekStart)
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                gcalOverlay
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
              title={gcalOverlay ? '구글 캘린더 오버레이 끄기' : '구글 캘린더 오버레이 켜기'}
            >
              {gcalLoading ? (
                <span className="block w-3.5 h-3.5 border-[1.5px] border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <img src={calendarIconUrl} alt="" className="w-3.5 h-3.5" />
              )}
              캘린더
            </button>
          )}
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
        <div className="flex items-center gap-2.5 text-[10px] text-gray-500 flex-wrap justify-end">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#B7DEB8]" /> 1개
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#FFCC99]" /> 2개 겹침
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#F7B3B6]" /> 3개 이상
          </span>
          {gcalOverlay && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-200" /> 캘린더
            </span>
          )}
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
                {dayLabels.map((label, i) => {
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
              {TIME_ROWS.map((min) => (
                <tr key={min} className="h-5">
                  {/* 시간 레이블: 정각만 표시 */}
                  <td className="w-10 sticky left-0 bg-white text-right pr-1 text-gray-400 align-top leading-none whitespace-nowrap">
                    {min % 60 === 0 ? formatHM(min) : ''}
                  </td>
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const key = `${dayIndex}-${min}`
                    const count = slots.get(key)?.length ?? 0
                    const gcalCount = gcalSlots.get(key)?.length ?? 0
                    const hasEntry = count > 0
                    const hasGcal = gcalCount > 0
                    const isClickable = hasEntry || hasGcal
                    const isPreview =
                      previewData !== null &&
                      weekStart.getTime() === previewData.weekStart.getTime() &&
                      dayIndex === previewData.dayIndex &&
                      min >= previewData.startMin &&
                      min < previewData.endMin

                    let cellColor: string
                    if (isPreview) {
                      // 시뮬레이션: 특강 수 + 캘린더 겹침을 합산
                      const totalOverlap = count + (hasGcal ? 1 : 0) + 1
                      cellColor = overlapColor(totalOverlap)
                    } else if (hasGcal && !hasEntry) {
                      cellColor = 'bg-blue-200'
                    } else {
                      // 특강이 있으면 캘린더 무시 → 특강 색상만
                      cellColor = overlapColor(count) || 'bg-gray-50'
                    }

                    return (
                      <td
                        key={dayIndex}
                        onClick={
                          isClickable && !isPreview
                            ? () =>
                                setPopover({
                                  dayIndex,
                                  min,
                                  entries: getSlotEntries(entries, weekStart, dayIndex, min, weekStartDay),
                                  gcalEvents: gcalOverlay && !hasEntry
                                    ? getSlotGcalEvents(gcalEvents, dayIndex, min, weekStartDay)
                                    : [],
                                })
                            : undefined
                        }
                        className={`border-l border-gray-100 ${
                          min % 60 === 0 ? 'border-t border-gray-200' : 'border-t border-gray-100'
                        } ${cellColor} ${isClickable && !isPreview ? 'cursor-pointer hover:opacity-70' : ''}`}
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
                    return `${day.getMonth() + 1}/${day.getDate()}(${getDayName(day.getDay())}) ${formatHM(popover.min)}`
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
                {/* 구글 캘린더 이벤트 */}
                {popover.gcalEvents.map((event, i) => (
                  <div key={event.id} className={`px-3 py-2 ${i > 0 || popover.entries.length > 0 ? 'border-t border-gray-100' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <img src={calendarIconUrl} alt="" className="w-3 h-3 shrink-0" />
                      <p className="text-xs font-medium text-blue-700 leading-snug line-clamp-2">
                        {event.summary}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 pl-[18px]">
                      {formatEventTime(event.start)}~{formatEventTime(event.end)}
                    </p>
                    {event.location && (
                      <p className="text-[10px] text-gray-400 pl-[18px]">{event.location}</p>
                    )}
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-500 hover:underline pl-[18px]"
                      >
                        캘린더에서 보기 →
                      </a>
                    )}
                  </div>
                ))}
                {/* 멘토링 항목 */}
                {popover.entries.map((entry, i) => (
                  <div key={entry.no} className={`px-3 py-2 ${i > 0 || popover.gcalEvents.length > 0 ? 'border-t border-gray-100' : ''}`}>
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-800 leading-snug mb-0.5 line-clamp-2">
                        {entry.title}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <NotionButton entry={entry} />
                        <GoogleCalendarButton entry={entry} tabOrigin={tabOrigin} />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      {entry.author} · {formatHM(entry.startMinutes)}~{formatHM(entry.endMinutes)}
                    </p>
                    {locationCache[entry.qustnrSn] !== undefined && locationCache[entry.qustnrSn] !== '' && (
                      <p className="text-[10px] text-gray-400">
                        {locationCache[entry.qustnrSn]}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <a
                        href={`${tabOrigin}${entry.detailUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-brand-600 hover:underline"
                      >
                        상세보기 →
                      </a>
                      {entry.status === '접수완료' && (
                        <button
                          onClick={() => openHistoryCancelPage(entry, entries, tabOrigin)}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-400 font-medium transition-colors"
                        >
                          접수 취소
                        </button>
                      )}
                    </div>
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

/** ISO dateTime → "HH:MM" */
function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
