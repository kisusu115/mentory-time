import { useStore } from './store'
import NotionSettingsView from './NotionSettingsView'

const notionIconUrl = chrome.runtime.getURL('icons/notion-icon.svg')
const calendarIconUrl = chrome.runtime.getURL('icons/google-calendar-icon.svg')

interface Props {
  onBack: () => void
}

export default function SettingsView({ onBack }: Props) {
  const { gcalConnected, gcalError, connectGcal, disconnectGcal, loadGcalState } = useStore()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
          title="뒤로 가기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-bold text-gray-700">설정</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Notion 연동 섹션 */}
        <div className="border-b border-gray-200">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <img src={notionIconUrl} alt="" className="w-4 h-4" />
              Notion 연동
            </h2>
          </div>
          <div className="px-4 pb-3">
            <NotionSettingsView />
          </div>
        </div>

        {/* 구글 캘린더 연동 섹션 */}
        <div className="px-4 pt-3 pb-3">
          <h2 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 mb-3">
            <img src={calendarIconUrl} alt="" className="w-4 h-4" />
            구글 캘린더 연동
          </h2>

          {gcalConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">연동됨</span>
              </div>
              <p className="text-[11px] text-gray-500">
                시간표 탭에서 구글 캘린더 버튼을 눌러 일정을 오버레이할 수 있습니다.
              </p>
              <button
                onClick={() => {
                  if (!confirm('구글 캘린더 연결을 해제하시겠습니까?')) return
                  void disconnectGcal()
                }}
                className="w-full py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
              >
                연결 해제
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                구글 캘린더를 연동하면 시간표에서 내 일정과 멘토링 시간을 함께 볼 수 있습니다.
              </p>
              <button
                onClick={() => void connectGcal().then(() => loadGcalState())}
                className="w-full py-2 text-xs font-bold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors"
              >
                구글 캘린더 연동하기
              </button>
            </div>
          )}

          {gcalError && (
            <p className="text-[11px] text-red-500 mt-2">{gcalError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
