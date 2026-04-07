import { useEffect, useState } from 'react'
import { useStore } from './store'
import ListView from './ListView'
import TimetableView from './TimetableView'

type Tab = 'list' | 'timetable'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const { loadCache, fetchAll } = useStore()

  useEffect(() => {
    loadCache()
  }, [loadCache])

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 text-sm">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
        <span className="font-bold text-brand-700 tracking-tight">MentoryTime</span>
        <button
          onClick={fetchAll}
          className="text-brand-600 hover:text-brand-700 text-base leading-none"
          title="새로고침"
        >
          ↺
        </button>
      </header>

      {/* 탭바 */}
      <nav className="flex border-b border-brand-100">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'list'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          접수 목록
        </button>
        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'timetable'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          시간표
        </button>
      </nav>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'list' ? <ListView /> : <TimetableView />}
      </main>
    </div>
  )
}

