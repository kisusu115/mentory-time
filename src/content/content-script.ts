const url = location.href

if (url.includes('/sw/mypage/userAnswer/history.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'history', url } })
} else if (url.includes('/sw/mypage/mentoLec/view.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'detail', url } })
  // 신청 완료 감지: apply.json POST 성공 시 APPLY_COMPLETE 전송
  const _open = XMLHttpRequest.prototype.open
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  XMLHttpRequest.prototype.open = function (method: string, applyUrl: string, ...rest: any[]) {
    if (method.toUpperCase() === 'POST' && applyUrl.includes('/mentoLec/apply.json')) {
      this.addEventListener('load', () => {
        try {
          const data = JSON.parse(this.responseText) as { resultCode?: string }
          if (data.resultCode === 'success') {
            chrome.runtime.sendMessage({ type: 'APPLY_COMPLETE' }).catch(() => {})
          }
        } catch { /* ignore */ }
      })
    }
    return (_open as (method: string, url: string, ...a: unknown[]) => void).call(this, method, applyUrl, ...rest)
  }
} else {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'other', url } })
}
