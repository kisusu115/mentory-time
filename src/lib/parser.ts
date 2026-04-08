import type { LectureEntry, NormalizedEntry, DetailInfo } from './types'

// ── 접수내역 페이지 파싱 ──────────────────────────────────────────────────

export function parseHistoryPage(doc: Document): LectureEntry[] {
  const rows = doc.querySelectorAll('.boardlist .tbl-ovx table tbody tr')
  const entries: LectureEntry[] = []

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td')
    if (cells.length < 8) return

    const anchor = cells[2].querySelector('a')
    if (!anchor) return

    const detailUrl = anchor.getAttribute('href') ?? ''
    const qustnrSn = extractQustnrSn(detailUrl)
    const { lectureDate, lectureStartTime, lectureEndTime } = parseLectureDateTime(cells[4])
    const registDate = cells[5].textContent?.trim().split('\n')[0].trim() ?? ''
    const statusText = cells[6].textContent?.trim() ?? ''

    entries.push({
      no: parseInt(cells[0].textContent?.trim() ?? '0', 10),
      category: cells[1].textContent?.trim() ?? '',
      title: anchor.textContent?.trim() ?? '',
      detailUrl,
      qustnrSn,
      author: cells[3].textContent?.trim() ?? '',
      lectureDate,
      lectureStartTime,
      lectureEndTime,
      registDate,
      status: statusText.includes('취소') ? '접수취소' : '접수완료',
      approval: cells[7].textContent?.trim() ?? '',
    })
  })

  return entries
}

export function isLoginPage(doc: Document): boolean {
  // 비로그인 시 SW마에스트로는 로그인 페이지로 리디렉트 (HTTP 200)
  // 로그인 페이지에는 password 입력창이 있고, 접수내역 컨테이너가 없음
  return (
    doc.querySelector('input[type="password"]') !== null ||
    doc.querySelector('.boardlist') === null
  )
}

export function parseTotalPages(doc: Document): number {
  const endPageLink = doc.querySelector('.paginationSet .end a')
  if (endPageLink) {
    const endPage = parseInt(endPageLink.getAttribute('data-endpage') ?? '1', 10)
    if (!isNaN(endPage)) return endPage
  }

  // 폴백: Total 수에서 계산
  const totalText = doc.querySelector('.bbs-total li strong')?.nextSibling?.textContent?.trim()
    ?? doc.querySelector('.bbs-total li')?.textContent?.trim()
    ?? ''
  const totalMatch = totalText.match(/\d+/)
  if (totalMatch) return Math.ceil(parseInt(totalMatch[0], 10) / 10)

  return 1
}

// ── 강의날짜/시간 파싱 ────────────────────────────────────────────────────

function parseLectureDateTime(cell: Element): {
  lectureDate: string
  lectureStartTime: string
  lectureEndTime: string
} {
  const text = cell.textContent ?? ''
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\(.\)/)
  const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})\s*~\s*(\d{2}:\d{2}:\d{2})/)

  return {
    lectureDate: dateMatch ? dateMatch[1] : '',
    lectureStartTime: timeMatch ? timeMatch[1] : '',
    lectureEndTime: timeMatch ? timeMatch[2] : '',
  }
}

function extractQustnrSn(url: string): string {
  const match = url.match(/qustnrSn=(\d+)/)
  return match ? match[1] : ''
}

// ── 상세 페이지 파싱 (F6) ─────────────────────────────────────────────────

export function parseDetailPage(doc: Document, qustnrSn: string): DetailInfo | null {
  const eventDtEl = doc.querySelector('.eventDt')
  if (!eventDtEl) return null

  const rawDate = eventDtEl.textContent?.trim() ?? ''
  const lectureDate = rawDate.replace(/\./g, '-').replace(/-$/, '') // "2026.04.07" → "2026-04-07"

  const timeDiv = eventDtEl.parentElement
  const timeText = timeDiv?.textContent ?? ''
  const timeMatch = timeText.match(/(\d{2}:\d{2})시\s*~\s*(\d{2}:\d{2})시/)

  const titleEl = doc.querySelector('.bbs-view-new .top > .group .c')
  const halfWs = doc.querySelectorAll('.bbs-view-new .top .half_w')
  const authorEl = halfWs[3]?.querySelector('.group .c')

  return {
    qustnrSn,
    title: titleEl?.textContent?.trim() ?? '',
    lectureDate,
    lectureStartTime: timeMatch ? timeMatch[1] : '',
    lectureEndTime: timeMatch ? timeMatch[2] : '',
    author: authorEl?.textContent?.trim() ?? '',
  }
}

// ── 정규화 ────────────────────────────────────────────────────────────────

export function normalizeEntry(entry: LectureEntry): NormalizedEntry {
  const lectureDateObj = new Date(entry.lectureDate)
  const startMinutes = timeToMinutes(entry.lectureStartTime)
  const endMinutes = timeToMinutes(entry.lectureEndTime)
  const dayOfWeek = lectureDateObj.getDay()
  const weekKey = toWeekKey(lectureDateObj)

  return { ...entry, lectureDateObj, startMinutes, endMinutes, dayOfWeek, weekKey }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function toWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
