import { useCallback, useEffect, useState } from 'react'
import { useStore } from './store'
import AllLecturesView from './AllLecturesView'
import ListView from './ListView'
import TimetableView from './TimetableView'
import SettingsView from './SettingsView'

const notionIconUrl = chrome.runtime.getURL('icons/notion-icon.svg')
const calendarIconUrl = chrome.runtime.getURL('icons/google-calendar-icon.svg')

type Tab = 'allLectures' | 'list' | 'timetable' | 'settings'
const VALID_TABS: Tab[] = ['allLectures', 'list', 'timetable']
const TAB_STORAGE_KEY = 'activeTab'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const { loadCache, loadNotionState, loadGcalState, fetchAll, setPendingDetail } = useStore()
  const notionSettings = useStore((s) => s.notionSettings)

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab)
    chrome.storage.local.set({ [TAB_STORAGE_KEY]: tab })
  }, [])

  useEffect(() => {
    // 저장된 탭 복원
    chrome.storage.local.get(TAB_STORAGE_KEY).then((result) => {
      const saved = result[TAB_STORAGE_KEY] as string | undefined
      if (saved && VALID_TABS.includes(saved as Tab)) {
        setActiveTab(saved as Tab)
      }
    })

    loadCache()
    loadNotionState()
    loadGcalState()

    // 사이드 패널이 새로 열렸을 때 background에서 pending detail 조회
    chrome.runtime.sendMessage({ type: 'GET_PENDING_DETAIL' })
      .then((res: { qustnrSn?: string } | null) => {
        if (res?.qustnrSn) setPendingDetail(res.qustnrSn)
      })
      .catch(() => { })

    // 사이드 패널이 이미 열려있을 때 실시간 메시지 수신
    const handler = (message: { type: string; payload?: { qustnrSn?: string } | null }) => {
      if (message.type === 'DETAIL_PAGE_DETECTED' && message.payload?.qustnrSn) {
        setPendingDetail(message.payload.qustnrSn)
      } else if (message.type === 'DETAIL_PAGE_CLEARED') {
        setPendingDetail(null)
      } else if (message.type === 'HISTORY_PAGE_DETECTED') {
        fetchAll()
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [loadCache, loadNotionState, loadGcalState, fetchAll, setPendingDetail])


  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 text-sm">
      {activeTab === 'settings' ? (
        <SettingsView onBack={() => switchTab('list')} />
      ) : (
        <>
          {/* 탭바 */}
          <nav className="flex items-center border-b border-brand-100">
            <button
              onClick={() => switchTab('allLectures')}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === 'allLectures'
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-gray-400 font-semibold hover:text-gray-600'
              }`}
            >
              전체 강의
            </button>
            <button
              onClick={() => switchTab('list')}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === 'list'
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-gray-400 font-semibold hover:text-gray-600'
              }`}
            >
              접수 목록
            </button>
            <button
              onClick={() => switchTab('timetable')}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === 'timetable'
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-gray-400 font-semibold hover:text-gray-600'
              }`}
            >
              시간표
            </button>

            {/* 외부 링크 버튼 영역 */}
            <div className="flex items-center gap-0.5 ml-auto pr-0.5">
              {/* 노션 DB 링크 — 설정 완료 시에만 표시 */}
              {notionSettings && (
                <a
                  href={`https://www.notion.so/${notionSettings.databaseId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative p-1.5 opacity-70 hover:opacity-100 transition-opacity"
                  title="Notion DB 열기"
                >
                  <img src={notionIconUrl} alt="Notion DB" className="w-5 h-5" />
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute -bottom-0.5 -right-0.5 z-10 w-3 h-3 text-gray-600 bg-white rounded-full p-px" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.182a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0V6.56l-5.22 5.22a.75.75 0 11-1.06-1.06l5.22-5.22h-2.94a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                  </svg>
                </a>
              )}

              {/* 구글 캘린더 링크 */}
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="relative p-1.5 opacity-70 hover:opacity-100 transition-opacity"
                title="Google Calendar 열기"
              >
                <img src={calendarIconUrl} alt="Google Calendar" className="w-5 h-5" />
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute -bottom-0.5 -right-0.5 z-10 w-3 h-3 text-gray-600 bg-white rounded-full p-px" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.182a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0V6.56l-5.22 5.22a.75.75 0 11-1.06-1.06l5.22-5.22h-2.94a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
              </a>

              {/* 설정 버튼 */}
              <button
                onClick={() => setActiveTab('settings')}
                className="p-1.5 text-gray-600 hover:text-gray-800 transition-colors"
                title="설정"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </nav>

          {/* 콘텐츠 */}
          <main className="flex-1 overflow-hidden">
            {activeTab === 'allLectures' && <AllLecturesView />}
            {activeTab === 'list' && <ListView />}
            {activeTab === 'timetable' && <TimetableView />}
          </main>
        </>
      )}
    </div>
  )
}

