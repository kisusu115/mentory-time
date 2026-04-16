import type { GcalEvent } from './types'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/** OAuth 토큰 발급 (interactive=true → 동의 팝업) */
export async function getGcalToken(interactive: boolean): Promise<string> {
  const result = await chrome.identity.getAuthToken({ interactive })
  if (!result.token) {
    throw new Error('OAuth 토큰 발급 실패')
  }
  return result.token
}

/** 주간 이벤트 조회 */
export async function fetchGcalEvents(
  token: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GcalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (res.status === 401) {
    // 토큰 만료 — 캐시에서 제거
    await removeCachedToken(token)
    throw new Error('TOKEN_EXPIRED')
  }
  if (!res.ok) throw new Error(`Google Calendar API 오류: ${res.status}`)

  const data: { items?: Array<{
    id: string
    summary?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
    location?: string
    htmlLink?: string
  }> } = await res.json()

  // 종일 이벤트(date만 있는 경우)는 시간표 오버레이에 맞지 않으므로 제외
  return (data.items ?? [])
    .filter((item) => item.start?.dateTime && item.end?.dateTime)
    .map((item) => ({
      id: item.id,
      summary: item.summary ?? '(제목 없음)',
      start: item.start!.dateTime!,
      end: item.end!.dateTime!,
      location: item.location,
      htmlLink: item.htmlLink ?? '',
    }))
}

/** 연결 해제: 캐시 토큰 제거 + Google revoke */
export async function revokeGcalToken(): Promise<void> {
  try {
    const token = await getGcalToken(false)
    await removeCachedToken(token)
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
  } catch {
    // 토큰이 없거나 이미 만료된 경우 무시
  }
}

function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}
