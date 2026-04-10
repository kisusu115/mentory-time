chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// 최근 감지된 상세 페이지 qustnrSn (일시적 상태, SW 재시작 시 소실은 허용)
let pendingDetail: { qustnrSn: string } | null = null

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: Record<string, string> }, sender, sendResponse) => {
    if (message.type === 'APPLY_COMPLETE') {
      // 신청 완료: pendingDetail 유지, fetchAll만 트리거
      chrome.runtime.sendMessage({ type: 'HISTORY_PAGE_DETECTED', payload: null }).catch(() => {})
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
