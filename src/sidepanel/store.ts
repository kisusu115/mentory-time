import { create } from 'zustand'
import { parseHistoryPage, parseTotalPages, normalizeEntry } from '../lib/parser'
import { saveEntries, loadStorage } from '../lib/storage'
import type { NormalizedEntry } from '../lib/types'

const HISTORY_URL =
  'https://swmaestro.ai/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex='

interface StoreState {
  entries: NormalizedEntry[]
  loading: boolean
  progress: { current: number; total: number } | null
  error: string | null
  lastFetched: number | null
  hideCancel: boolean
  toggleHideCancel: () => void
  loadCache: () => Promise<void>
  fetchAll: () => Promise<void>
}

export const useStore = create<StoreState>((set) => ({
  entries: [],
  loading: false,
  progress: null,
  error: null,
  lastFetched: null,
  hideCancel: true,
  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),

  loadCache: async () => {
    const cached = await loadStorage()
    if (cached) {
      set({ entries: cached.entries, lastFetched: cached.lastFetched })
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null, progress: null })
    try {
      const page1Doc = await fetchDoc(HISTORY_URL + '1')
      const totalPages = parseTotalPages(page1Doc)
      const allEntries = parseHistoryPage(page1Doc).map(normalizeEntry)

      set({ progress: { current: 1, total: totalPages } })

      for (let page = 2; page <= totalPages; page++) {
        const doc = await fetchDoc(HISTORY_URL + page)
        allEntries.push(...parseHistoryPage(doc).map(normalizeEntry))
        set({ progress: { current: page, total: totalPages } })
      }

      allEntries.sort((a, b) => a.lectureDateObj.getTime() - b.lectureDateObj.getTime())

      await saveEntries(allEntries, totalPages)
      set({ entries: allEntries, loading: false, progress: null, lastFetched: Date.now() })
    } catch {
      set({ loading: false, error: '데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.' })
    }
  },
}))

async function fetchDoc(url: string): Promise<Document> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return new DOMParser().parseFromString(html, 'text/html')
}
