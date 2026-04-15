import { useCallback, useEffect, useState } from 'react'
import { useStore } from './store'
import AllLecturesView from './AllLecturesView'
import ListView from './ListView'
import TimetableView from './TimetableView'

type Tab = 'allLectures' | 'list' | 'timetable'
const VALID_TABS: Tab[] = ['allLectures', 'list', 'timetable']
const TAB_STORAGE_KEY = 'activeTab'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const { loadCache, fetchAll, setPendingDetail } = useStore()

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
  }, [loadCache, fetchAll, setPendingDetail])


  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 text-sm">
      {/* 탭바 */}
      <nav className="flex border-b border-brand-100">
        <button
          onClick={() => switchTab('allLectures')}
          className={`flex-1 py-2 text-xs transition-colors ${activeTab === 'allLectures'
            ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
            : 'text-gray-400 font-semibold hover:text-gray-600'
            }`}
        >
          전체 강의
        </button>
        <button
          onClick={() => switchTab('list')}
          className={`flex-1 py-2 text-xs transition-colors ${activeTab === 'list'
            ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
            : 'text-gray-400 font-semibold hover:text-gray-600'
            }`}
        >
          접수 목록
        </button>
        <button
          onClick={() => switchTab('timetable')}
          className={`flex-1 py-2 text-xs transition-colors ${activeTab === 'timetable'
            ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
            : 'text-gray-400 font-semibold hover:text-gray-600'
            }`}
        >
          시간표
        </button>
      </nav>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'allLectures' && <AllLecturesView />}
        {activeTab === 'list' && <ListView />}
        {activeTab === 'timetable' && <TimetableView />}
      </main>
    </div>
  )
}

