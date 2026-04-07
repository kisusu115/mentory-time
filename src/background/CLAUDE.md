# src/background — 서비스 워커

## 역할
- `FETCH_ALL_ENTRIES`: 전체 페이지 순차 fetch → `parser.ts` 로 파싱 → `chrome.storage` 저장 → Side Panel에 전달
- Side Panel 라이프사이클 관리 (`chrome.sidePanel`)

## 주의
- 서비스 워커는 언제든 종료될 수 있음 — 상태를 메모리에 유지하지 말고 `chrome.storage`에 저장
- fetch 시 쿠키 자동 포함 (`credentials: 'include'` 불필요, same-origin fetch)
- 동시 fetch 지양 — 순차 처리로 서버 부하 최소화

## fetch 대상 URL 패턴
`DESIGN.md` 섹션 8 참조.
