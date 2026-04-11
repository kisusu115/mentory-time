import { create } from 'zustand'
import { parseHistoryPage, parseTotalPages, normalizeEntry, parseDetailPage, isLoginPage } from '../lib/parser'
import { saveEntries, loadStorage } from '../lib/storage'
import type { NormalizedEntry, DetailInfo } from '../lib/types'

const HISTORY_PATH = '/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex='

interface StoreState {
  entries: NormalizedEntry[]
  loading: boolean
  progress: { current: number; total: number } | null
  error: string | null
  lastFetched: number | null
  hideCancel: boolean
  pendingQustnrSn: string | null
  previewEntry: DetailInfo | null
  tabOrigin: string
  locationCache: Record<string, string>
  toggleHideCancel: () => void
  loadCache: () => Promise<void>
  fetchAll: () => Promise<void>
  setPendingDetail: (qustnrSn: string | null) => void
  clearPreview: () => void
  /** 시뮬레이션 활성화. 이미 접수완료면 true 반환, 아니면 fetch+파싱 후 previewEntry 설정 */
  activatePreview: (qustnrSn: string) => Promise<boolean>
  /** 상세 페이지에서 장소 정보를 fetch해 locationCache에 저장 (이미 있으면 skip) */
  fetchLocation: (qustnrSn: string) => Promise<void>
}

export const useStore = create<StoreState>((set, get) => ({
  entries: [],
  loading: false,
  progress: null,
  error: null,
  lastFetched: null,
  hideCancel: true,
  pendingQustnrSn: null,
  previewEntry: null,
  tabOrigin: 'https://www.swmaestro.ai',
  locationCache: {},
  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),
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

  loadCache: async () => {
    const cached = await loadStorage()
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

      allEntries.sort((a, b) => {
        const dateDiff = a.lectureDateObj.getTime() - b.lectureDateObj.getTime()
        if (dateDiff !== 0) return dateDiff
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes
        return a.endMinutes - b.endMinutes
      })

      await saveEntries(allEntries, totalPages)
      set({ entries: allEntries, loading: false, progress: null, lastFetched: Date.now() })
    } catch (e) {
      const msg =
        e instanceof Error && e.message === 'NO_TAB'
          ? 'SW마에스트로 페이지를 브라우저에서 열어주세요.'
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

async function findTab(): Promise<{ tabId: number; origin: string }> {
  if (cachedTab) {
    try {
      const tab = await chrome.tabs.get(cachedTab.tabId)
      if (tab.url?.startsWith(cachedTab.origin)) return cachedTab
    } catch { /* 탭 닫힘 */ }
  }
  const tabs = await chrome.tabs.query({
    url: ['https://swmaestro.ai/*', 'https://www.swmaestro.ai/*'],
  })
  const tab = tabs[0]
  if (!tab?.id || !tab.url) throw new Error('NO_TAB')
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
