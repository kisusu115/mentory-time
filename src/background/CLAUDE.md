# src/background — 서비스 워커

## 역할
- Side Panel 라이프사이클 관리 (`chrome.sidePanel`)
- content-script가 보낸 메시지를 Side Panel로 중계 (`PAGE_DETECTED` → `HISTORY/DETAIL_PAGE_*`)
- `APPLY_COMPLETE` 수신 시 탭 reload 완료 대기 → `HISTORY_PAGE_DETECTED` broadcast (`fix-history.md` §9 참조)
- fetch/파싱/storage는 sidepanel/store.ts가 직접 처리 (MV3 SW에 DOMParser 없음)

## 주의
- 서비스 워커는 언제든 종료될 수 있음 — 장기 상태는 메모리에 두지 말 것 (`pendingDetail`처럼 소실 허용되는 일시 상태만 예외)
- 기능을 추가할 때 fetch 오케스트레이션을 이 파일에 넣지 말 것

## fetch 대상 URL 패턴
`DESIGN.md` 섹션 8 참조.
