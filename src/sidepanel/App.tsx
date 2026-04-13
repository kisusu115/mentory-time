import { useEffect, useState } from 'react'
import { useStore } from './store'
import ListView from './ListView'
import TimetableView from './TimetableView'
import NotionSettingsView from './NotionSettingsView'

const notionIconUrl = chrome.runtime.getURL('icons/notion-icon.svg')

type Tab = 'list' | 'timetable' | 'settings'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const { loadCache, loadNotionState, fetchAll, setPendingDetail } = useStore()

  useEffect(() => {
    loadCache()
    loadNotionState()

    // 사이드 패널이 새로 열렸을 때 background에서 pending detail 조회
    chrome.runtime.sendMessage({ type: 'GET_PENDING_DETAIL' })
      .then((res: { qustnrSn?: string } | null) => {
        if (res?.qustnrSn) setPendingDetail(res.qustnrSn)
      })
      .catch(() => {})

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
  }, [loadCache, loadNotionState, fetchAll, setPendingDetail])


  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 text-sm">
      {activeTab === 'settings' ? (
        <NotionSettingsView onBack={() => setActiveTab('list')} />
      ) : (
        <>
          {/* 탭바 */}
          <nav className="flex items-center border-b border-brand-100">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === 'list'
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-gray-400 font-semibold hover:text-gray-600'
              }`}
            >
              접수 목록
            </button>
            <button
              onClick={() => setActiveTab('timetable')}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === 'timetable'
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-gray-400 font-semibold hover:text-gray-600'
              }`}
            >
              시간표
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="px-2 py-1.5 opacity-60 hover:opacity-100 transition-opacity"
              title="Notion 연동 설정"
            >
              <img src={notionIconUrl} alt="Notion 설정" className="w-5 h-5" />
            </button>
          </nav>

          {/* 콘텐츠 */}
          <main className="flex-1 overflow-hidden">
            {activeTab === 'list' ? <ListView /> : <TimetableView />}
          </main>
        </>
      )}
    </div>
  )
}

