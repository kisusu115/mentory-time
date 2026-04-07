chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onMessage.addListener((message: { type: string }, _sender, sendResponse) => {
  if (message.type === 'PAGE_DETECTED') {
    // TODO P1: fetch 오케스트레이션
    sendResponse({ ok: true })
  }
  return true
})
