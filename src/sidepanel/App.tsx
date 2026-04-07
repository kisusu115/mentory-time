export default function App() {
  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-bold text-base">MentoryTime</span>
        <button
          className="text-gray-500 hover:text-gray-800 text-sm"
          title="새로고침"
        >
          ↺
        </button>
      </header>

      {/* 탭 */}
      <nav className="flex border-b border-gray-200">
        <button className="flex-1 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600">
          접수 목록
        </button>
        <button className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          시간표
        </button>
      </nav>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-gray-400 text-center mt-8">
          SW마에스트로 접수내역 페이지를 방문하면<br />
          데이터가 자동으로 불러와집니다.
        </p>
      </main>
    </div>
  )
}
