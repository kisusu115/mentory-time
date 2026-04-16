import type { NormalizedEntry } from '../lib/types'

export function openHistoryCancelPage(entry: NormalizedEntry, entries: NormalizedEntry[], tabOrigin: string) {
  const maxNo = Math.max(...entries.map((e) => e.no))
  const pageIndex = Math.ceil((maxNo - entry.no + 1) / 10)
  const url = `${tabOrigin}/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=${pageIndex}#mentorytime-highlight=${entry.qustnrSn}`
  chrome.tabs.create({ url }).then((tab) => {
    // hash가 리다이렉트로 소실될 수 있으므로 sessionStorage에도 백업
    if (tab.id) {
      const setStorage = (qustnrSn: string) => {
        sessionStorage.setItem('mentorytime-highlight', qustnrSn)
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: setStorage,
        args: [entry.qustnrSn],
      }).catch(() => {})
    }
  })
}
