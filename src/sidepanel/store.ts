import { create } from 'zustand'
import { parseHistoryPage, parseTotalPages, normalizeEntry, parseDetailPage, isLoginPage } from '../lib/parser'
import { saveEntries, loadStorage, updateSettings, loadSettings, loadNotionSettings, saveNotionSettings as persistNotionSettings, loadNotionAddedSet, markAsNotionAdded, clearNotionData as clearNotionStorage, loadGcalAddedSet, markAsGcalAdded as persistGcalAdded, loadGcalConnected, saveGcalConnected } from '../lib/storage'
import { createNotionPage, NotionApiError } from '../lib/notion'
import { getGcalToken, fetchGcalEvents as apiFetchGcalEvents, revokeGcalToken } from '../lib/gcal'
import type { NormalizedEntry, DetailInfo, NotionSettings, GcalEvent } from '../lib/types'
import type { WeekStartDay } from '../lib/week'

const HISTORY_PATH = '/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex='

interface StoreState {
  entries: NormalizedEntry[]
  loading: boolean
  progress: { current: number; total: number } | null
  error: string | null
  lastFetched: number | null
  hideCancel: boolean
  weekStartDay: WeekStartDay
  recentHours: number
  pendingQustnrSn: string | null
  previewEntry: DetailInfo | null
  tabOrigin: string
  locationCache: Record<string, string>
  toggleHideCancel: () => void
  toggleWeekStartDay: () => void
  setRecentHours: (hours: number) => void
  loadCache: () => Promise<void>
  fetchAll: () => Promise<void>
  setPendingDetail: (qustnrSn: string | null) => void
  clearPreview: () => void
  /** 시뮬레이션 활성화. 이미 접수완료면 true 반환, 아니면 fetch+파싱 후 previewEntry 설정 */
  activatePreview: (qustnrSn: string) => Promise<boolean>
  /** 상세 페이지에서 장소 정보를 fetch해 locationCache에 저장 (이미 있으면 skip) */
  fetchLocation: (qustnrSn: string) => Promise<void>
  gcalAddedSet: Set<string>
  markGcalAdded: (qustnrSn: string) => Promise<void>
  notionSettings: NotionSettings | null
  notionAddedSet: Set<string>
  notionBusy: string | null
  notionError: string | null
  loadNotionState: () => Promise<void>
  saveNotionSettings: (settings: NotionSettings) => Promise<void>
  clearNotionData: () => Promise<void>
  addToNotion: (entry: NormalizedEntry) => Promise<void>
  gcalConnected: boolean
  gcalEvents: GcalEvent[]
  gcalOverlay: boolean
  gcalLoading: boolean
  gcalError: string | null
  loadGcalState: () => Promise<void>
  connectGcal: () => Promise<void>
  disconnectGcal: () => Promise<void>
  toggleGcalOverlay: () => void
  fetchGcalEvents: (weekStart: Date) => Promise<void>
}

export const useStore = create<StoreState>((set, get) => ({
  entries: [],
  loading: false,
  progress: null,
  error: null,
  lastFetched: null,
  hideCancel: true,
  weekStartDay: 0,
  recentHours: 3,
  pendingQustnrSn: null,
  previewEntry: null,
  tabOrigin: 'https://www.swmaestro.ai',
  locationCache: {},
  gcalAddedSet: new Set<string>(),
  markGcalAdded: async (qustnrSn) => {
    await persistGcalAdded(qustnrSn)
    set((s) => {
      const next = new Set(s.gcalAddedSet)
      next.add(qustnrSn)
      return { gcalAddedSet: next }
    })
  },
  notionSettings: null,
  notionAddedSet: new Set<string>(),
  notionBusy: null,
  notionError: null,
  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),
  toggleWeekStartDay: () => {
    const next: WeekStartDay = get().weekStartDay === 1 ? 0 : 1
    set({ weekStartDay: next })
    void updateSettings({ weekStartDay: next })
  },
  setRecentHours: (hours: number) => {
    set({ recentHours: hours })
    void updateSettings({ recentHours: hours })
  },
  setPendingDetail: (qustnrSn) => set({ pendingQustnrSn: qustnrSn }),
  clearPreview: () => set({ previewEntry: null }),
  activatePreview: async (qustnrSn) => {
    if (get().entries.some((e) => e.qustnrSn === qustnrSn && e.status === '접수완료')) {
      return true
    }
    try {
      const origin = await getTabOrigin()
      const url = `${origin}/sw/mypage/mentoLec/view.do?qustnrSn=${qustnrSn}&menuNo=200046&pageIndex=1`
      const doc = await fetchDoc(url)
      const info = parseDetailPage(doc, qustnrSn)
      if (info) {
        set((s) => ({
          previewEntry: info,
          locationCache: { ...s.locationCache, [qustnrSn]: info.location },
        }))
      }
    } catch { /* 실패 시 무시 */ }
    return false
  },

  fetchLocation: async (qustnrSn) => {
    if (get().locationCache[qustnrSn] !== undefined) return
    try {
      const origin = await getTabOrigin()
      const url = `${origin}/sw/mypage/mentoLec/view.do?qustnrSn=${qustnrSn}&menuNo=200046&pageIndex=1`
      const doc = await fetchDoc(url)
      const info = parseDetailPage(doc, qustnrSn)
      set((s) => ({ locationCache: { ...s.locationCache, [qustnrSn]: info?.location ?? '' } }))
    } catch {
      set((s) => ({ locationCache: { ...s.locationCache, [qustnrSn]: '' } }))
    }
  },

  gcalConnected: false,
  gcalEvents: [],
  gcalOverlay: false,
  gcalLoading: false,
  gcalError: null,

  loadGcalState: async () => {
    const connected = await loadGcalConnected()
    set({ gcalConnected: connected })
  },

  connectGcal: async () => {
    set({ gcalError: null })
    try {
      await getGcalToken(true)
      await saveGcalConnected(true)
      set({ gcalConnected: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '구글 캘린더 연동에 실패했습니다.'
      set({ gcalError: msg })
    }
  },

  disconnectGcal: async () => {
    await revokeGcalToken()
    await saveGcalConnected(false)
    set({ gcalConnected: false, gcalEvents: [], gcalOverlay: false, gcalError: null })
  },

  toggleGcalOverlay: () => {
    set((s) => ({ gcalOverlay: !s.gcalOverlay }))
  },

  fetchGcalEvents: async (weekStart) => {
    if (!get().gcalConnected) return
    set({ gcalLoading: true, gcalError: null })
    try {
      let token: string
      try {
        token = await getGcalToken(false)
      } catch {
        set({ gcalLoading: false, gcalError: '구글 캘린더 인증이 만료되었습니다. 설정에서 다시 연동해주세요.', gcalConnected: false })
        await saveGcalConnected(false)
        return
      }
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      try {
        const events = await apiFetchGcalEvents(token, weekStart, weekEnd)
        set({ gcalEvents: events, gcalLoading: false })
      } catch (e) {
        if (e instanceof Error && e.message === 'TOKEN_EXPIRED') {
          // 토큰 만료 후 재시도
          const newToken = await getGcalToken(false)
          const events = await apiFetchGcalEvents(newToken, weekStart, weekEnd)
          set({ gcalEvents: events, gcalLoading: false })
        } else {
          throw e
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '구글 캘린더 이벤트를 불러오지 못했습니다.'
      set({ gcalLoading: false, gcalError: msg })
    }
  },

  loadNotionState: async () => {
    const [ns, addedSet] = await Promise.all([loadNotionSettings(), loadNotionAddedSet()])
    set({ notionSettings: ns, notionAddedSet: addedSet })
  },

  saveNotionSettings: async (settings) => {
    await persistNotionSettings(settings)
    set({ notionSettings: settings })
  },

  clearNotionData: async () => {
    await clearNotionStorage()
    set({ notionSettings: null, notionAddedSet: new Set<string>() })
  },

  addToNotion: async (entry) => {
    const { notionSettings, locationCache, fetchLocation, tabOrigin } = get()
    if (!notionSettings) return
    set({ notionBusy: entry.qustnrSn, notionError: null })
    try {
      if (locationCache[entry.qustnrSn] === undefined) {
        await fetchLocation(entry.qustnrSn)
      }
      const location = get().locationCache[entry.qustnrSn] ?? ''
      const pageUrl = await createNotionPage(entry, location, tabOrigin, notionSettings)
      await markAsNotionAdded(entry.qustnrSn)
      set((s) => {
        const next = new Set(s.notionAddedSet)
        next.add(entry.qustnrSn)
        return { notionAddedSet: next, notionBusy: null }
      })
      chrome.tabs.create({ url: pageUrl })
    } catch (e) {
      const msg = e instanceof NotionApiError ? e.toUserMessage() : 'Notion 추가에 실패했습니다.'
      set({ notionBusy: null, notionError: msg })
    }
  },

  loadCache: async () => {
    const [cached, settings, gcalAdded] = await Promise.all([loadStorage(), loadSettings(), loadGcalAddedSet()])
    set({ hideCancel: settings.hideCancel, weekStartDay: settings.weekStartDay, recentHours: settings.recentHours, gcalAddedSet: gcalAdded })
    if (cached) {
      const entries = cached.entries.map((e) => ({
        ...e,
        lectureDateObj: new Date(e.lectureDate),
      }))
      set({ entries, lastFetched: cached.lastFetched })
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null, progress: null })
    try {
      const origin = await getTabOrigin()
      set({ tabOrigin: origin })
      const page1Doc = await fetchDoc(origin + HISTORY_PATH + '1')
      if (isLoginPage(page1Doc)) {
        set({ loading: false, error: 'SW마에스트로에 로그인되어 있지 않아요. 로그인 후 다시 시도해주세요.' })
        return
      }
      const totalPages = parseTotalPages(page1Doc)
      const allEntries = parseHistoryPage(page1Doc).map(normalizeEntry)

      set({ progress: { current: 1, total: totalPages } })

      for (let page = 2; page <= totalPages; page++) {
        const doc = await fetchDoc(origin + HISTORY_PATH + page)
        allEntries.push(...parseHistoryPage(doc).map(normalizeEntry))
        set({ progress: { current: page, total: totalPages } })
      }

      allEntries.sort(
        (a, b) =>
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime() ||
          a.startMinutes - b.startMinutes,
      )

      await saveEntries(allEntries, totalPages)
      set({ entries: allEntries, loading: false, progress: null, lastFetched: Date.now() })
    } catch (e) {
      const msg =
        e instanceof Error && e.message === 'NO_TAB'
          ? 'SW마에스트로 페이지를 브라우저에서 열어주세요.'
          : e instanceof Error && e.message === 'TAB_NOT_READY'
            ? '페이지가 아직 로딩 중이에요. 잠시 후 다시 시도해주세요.'
            : '데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.'
      set({ loading: false, error: msg })
    }
  },
}))

async function fetchHtml(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

let cachedTab: { tabId: number; origin: string } | null = null

async function waitForTabComplete(tabId: number, timeoutMs = 5000): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  if (tab.status === 'complete') return

  return new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>
    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeoutId)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('TAB_NOT_READY'))
    }, timeoutMs)
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function findTab(): Promise<{ tabId: number; origin: string }> {
  if (cachedTab) {
    try {
      const tab = await chrome.tabs.get(cachedTab.tabId)
      if (tab.url?.startsWith(cachedTab.origin)) {
        if (tab.status !== 'complete') await waitForTabComplete(cachedTab.tabId)
        return cachedTab
      }
    } catch { /* 탭 닫힘 */ }
  }
  const tabs = await chrome.tabs.query({
    url: ['https://swmaestro.ai/*', 'https://www.swmaestro.ai/*'],
  })
  const tab = tabs[0]
  if (!tab?.id || !tab.url) throw new Error('NO_TAB')
  if (tab.status !== 'complete') await waitForTabComplete(tab.id)
  const origin = new URL(tab.url).origin
  cachedTab = { tabId: tab.id, origin }
  return cachedTab
}

async function getTabOrigin(): Promise<string> {
  return (await findTab()).origin
}

async function fetchDoc(url: string): Promise<Document> {
  const { tabId } = await findTab()

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: fetchHtml,
    args: [url],
  })

  const html = results[0]?.result
  if (typeof html !== 'string') throw new Error('FETCH_FAILED')
  return new DOMParser().parseFromString(html, 'text/html')
}
