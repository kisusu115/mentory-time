# src/content — 콘텐츠 스크립트

## 역할 (딱 이것만)
1. 현재 URL로 페이지 타입 감지 (`history` | `detail`)
2. `chrome.runtime.sendMessage`로 background에 알림

## 금지
- DOM 파싱 금지 — 파싱은 background에서 `parser.ts` 가 처리
- `chrome.storage` 직접 접근 금지
- Side Panel과 직접 통신 금지 (background 경유)

## 메시지 타입
`DESIGN.md` 섹션 5.3 참조.  
새 메시지 추가 시 `src/lib/types.ts` 의 메시지 유니온 타입도 함께 수정.
