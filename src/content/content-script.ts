const url = location.href

if (url.includes('/sw/mypage/userAnswer/history.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'history', url } })
  highlightCancelButton()
} else if (url.includes('/sw/mypage/mentoLec/view.do')) {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'detail', url } })
  // MAIN world의 xhr-hook이 dispatch하는 CustomEvent 수신 → background로 전달
  window.addEventListener('__mentorytime_apply_complete__', () => {
    chrome.runtime.sendMessage({ type: 'APPLY_COMPLETE' }).catch(() => {})
  })
} else {
  chrome.runtime.sendMessage({ type: 'PAGE_DETECTED', payload: { pageType: 'other', url } })
}

function highlightCancelButton() {
  // hash 또는 sessionStorage에서 하이라이트 대상 qustnrSn 추출
  const hash = location.hash
  const hashMatch = hash.match(/mentorytime-highlight=(\d+)/)
  const storageKey = 'mentorytime-highlight'
  const targetQustnrSn = hashMatch?.[1] ?? sessionStorage.getItem(storageKey)

  if (!targetQustnrSn) return

  // 사용 후 정리: hash 제거 + sessionStorage 삭제
  if (hashMatch) {
    history.replaceState(null, '', location.href.replace(hash, ''))
  }
  sessionStorage.removeItem(storageKey)

  const applyHighlight = (row: Element, cancelBtn: HTMLElement | null) => {
    // 행 전체: 노란 배경
    ;(row as HTMLElement).style.backgroundColor = '#fef9c3'

    if (cancelBtn) {
      // 취소 버튼: 인라인 스타일로 강제 적용 (사이트 인라인 스타일보다 높은 우선순위)
      cancelBtn.style.cssText = `
        display: inline-block !important;
        padding: 5px 12px !important;
        border: 2px solid #ef4444 !important;
        border-radius: 6px !important;
        background-color: #fecaca !important;
        color: #dc2626 !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        line-height: 1.4 !important;
        text-align: center !important;
        text-decoration: none !important;
        box-sizing: border-box !important;
        cursor: pointer !important;
        animation: mentorytime-pulse 1s ease-in-out infinite !important;
      `
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // 펄스 애니메이션 keyframes는 <style>로 주입 (인라인으로 표현 불가)
  const style = document.createElement('style')
  style.textContent = `
    @keyframes mentorytime-pulse {
      0%, 100% { box-shadow: 0 0 0 2px #ef4444, 0 0 8px rgba(239,68,68,0.4); }
      50% { box-shadow: 0 0 0 4px #ef4444, 0 0 16px rgba(239,68,68,0.6); }
    }
  `
  document.head.appendChild(style)

  // DOM에서 대상 행 탐색
  const tryHighlight = (): boolean => {
    const rows = document.querySelectorAll('.boardlist tbody tr')
    for (const row of rows) {
      // 제목 셀의 링크에서 qustnrSn 매칭
      const link = row.querySelector('td.tit a, td.popuser a, td a[href*="qustnrSn"]') as HTMLAnchorElement | null
      if (!link) continue
      const href = link.getAttribute('href') ?? ''
      if (!href.includes(`qustnrSn=${targetQustnrSn}`)) continue

      // 비고 열의 취소 버튼 찾기: delDate를 호출하는 <a> 태그
      const cancelBtn = row.querySelector('a[href*="delDate"]') as HTMLElement | null
      applyHighlight(row, cancelBtn)
      return true
    }
    return false
  }

  // 재시도 로직: 즉시 → 300ms → 1000ms → 2000ms (최대 4회)
  const RETRY_DELAYS = [0, 300, 1000, 2000]
  let attempt = 0
  const scheduleRetry = () => {
    if (attempt >= RETRY_DELAYS.length) return
    const delay = RETRY_DELAYS[attempt++]
    if (delay === 0) {
      if (!tryHighlight()) scheduleRetry()
    } else {
      setTimeout(() => {
        if (!tryHighlight()) scheduleRetry()
      }, delay)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRetry)
  } else {
    scheduleRetry()
  }
}
