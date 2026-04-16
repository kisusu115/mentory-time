chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// 최근 감지된 상세 페이지 qustnrSn (일시적 상태, SW 재시작 시 소실은 허용)
let pendingDetail: { qustnrSn: string } | null = null

const DETAIL_URL_PATTERN = '/sw/mypage/mentoLec/view.do'

// 탭 전환 시 활성 탭의 URL을 확인하여 pendingDetail을 갱신
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((tab) => {
    const url = tab.url ?? ''
    if (url.includes(DETAIL_URL_PATTERN)) {
      const qustnrSn = new URL(url).searchParams.get('qustnrSn') ?? ''
      const newPending = qustnrSn ? { qustnrSn } : null
      pendingDetail = newPending
      if (newPending) {
        chrome.runtime.sendMessage({ type: 'DETAIL_PAGE_DETECTED', payload: newPending }).catch(() => {})
      } else {
        chrome.runtime.sendMessage({ type: 'DETAIL_PAGE_CLEARED', payload: null }).catch(() => {})
      }
    } else if (pendingDetail) {
      pendingDetail = null
      chrome.runtime.sendMessage({ type: 'DETAIL_PAGE_CLEARED', payload: null }).catch(() => {})
    }
  }).catch(() => {})
})

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: Record<string, string> }, sender, sendResponse) => {
    // 신청 완료 → 페이지가 location.reload() 중이므로 탭 reload 완료를 기다린 후
    // HISTORY_PAGE_DETECTED를 broadcast해 사이드패널의 fetchAll이 안정된 탭에서 실행되도록 한다.
    if (message.type === 'APPLY_COMPLETE' && sender.tab?.id) {
      const tabId = sender.tab.id
      const broadcast = () => {
        chrome.runtime.sendMessage({ type: 'HISTORY_PAGE_DETECTED', payload: null }).catch(() => {})
      }
      let timeoutId: ReturnType<typeof setTimeout>
      const waitForReload = (updatedTabId: number, changeInfo: { status?: string }) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId)
          chrome.tabs.onUpdated.removeListener(waitForReload)
          broadcast()
        }
      }
      timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(waitForReload)
        broadcast()
      }, 5000)
      chrome.tabs.onUpdated.addListener(waitForReload)
      return
    }

    if (message.type === 'PAGE_DETECTED' && sender.tab?.id) {
      const isDetail = message.payload?.pageType === 'detail'
      if (isDetail) {
        const qustnrSn = new URL(message.payload!.url).searchParams.get('qustnrSn') ?? ''
        pendingDetail = qustnrSn ? { qustnrSn } : null
      } else {
        pendingDetail = null
      }
      // 사이드 패널이 이미 열려있으면 실시간 알림 (실패는 무시)
      const msgType = isDetail
        ? 'DETAIL_PAGE_DETECTED'
        : message.payload?.pageType === 'history'
          ? 'HISTORY_PAGE_DETECTED'
          : 'DETAIL_PAGE_CLEARED'
      chrome.runtime.sendMessage({
        type: msgType,
        payload: pendingDetail,
      }).catch(() => {})
    }

    if (message.type === 'GET_PENDING_DETAIL') {
      sendResponse(pendingDetail)
      return true
    }
  },
)
