# src/lib — 순수 로직 레이어

## 원칙
- DOM API, `chrome.*`, React import **절대 금지** — Node/브라우저 어디서도 실행 가능해야 함
- 새 데이터 구조는 반드시 `types.ts` 에 먼저 정의 후 사용

## 파일
| 파일 | 역할 |
|------|------|
| `types.ts` | 모든 인터페이스/타입 단일 출처 |
| `parser.ts` | HTML `Document` → `LectureEntry[]` / `DetailInfo` 변환 |
| `storage.ts` | `chrome.storage.local` 래퍼 (추가 예정) |

## 파서 검증
`samples/*.html` 파일을 JSDOM으로 로드해 파서 결과 확인 가능.  
파서 변경 시 반드시 4개 샘플 파일 모두 대상으로 검증할 것.
