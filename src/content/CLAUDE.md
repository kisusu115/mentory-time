# src/content — 콘텐츠 스크립트

## 파일 구성
- `content-script.ts` (isolated world) — URL 기반 페이지 타입 감지, background에 알림 전송, MAIN world가 dispatch하는 CustomEvent 수신 → `APPLY_COMPLETE` 전달, 접수내역 페이지에서 취소 버튼 하이라이트 (`highlightCancelButton`)
- `xhr-hook.ts` (MAIN world, manifest에서 `world: 'MAIN'` + `run_at: 'document_start'` 지정) — 상세 페이지 한정으로 `XMLHttpRequest.prototype.open` 패치, `apply.json` 성공 응답 감지 시 `window.dispatchEvent(new CustomEvent('__mentorytime_apply_complete__'))`

## 역할 (딱 이것만)
1. 현재 URL로 페이지 타입 감지 (`history` | `detail` | `other`)
2. `chrome.runtime.sendMessage`로 background에 알림
3. (상세 페이지) 신청 완료 이벤트 감지 및 background 전달
4. (접수내역 페이지) URL hash 또는 `sessionStorage`에 `mentorytime-highlight={qustnrSn}`이 있으면, 해당 행의 비고 열 취소 버튼을 시각적으로 강조 + 스크롤 (DOM 조작, 데이터 파싱 아님)

## 금지
- DOM 파싱 금지 — 파싱은 사이드패널 `store.ts`가 fetch 후 `lib/parser.ts`로 처리
- `chrome.storage` 직접 접근 금지
- Side Panel과 직접 통신 금지 (background 경유)
- MAIN world와 isolated world 간 통신은 `window` CustomEvent만 사용 (전역 변수 공유 불가)

## 메시지 타입
`DESIGN.md` 섹션 5.3 참조.  
새 메시지 추가 시 `src/lib/types.ts` 의 메시지 유니온 타입도 함께 수정.
