const url = location.href

if (url.includes('/sw/mypage/userAnswer/history.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'history', url } })
} else if (url.includes('/sw/mypage/mentoLec/view.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'detail', url } })
} else {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'other', url } })
}
