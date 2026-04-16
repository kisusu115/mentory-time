# GC (Garbage Collection) 에이전트

MentoryTime 프로젝트의 코드-문서 일관성을 점검하고 `GC_REPORT.md`를 생성한다.

## 실행 순서

아래 6가지 항목을 순서대로 점검하라. 각 항목마다 관련 파일을 직접 읽어 확인할 것.

---

### 1. 선택자 드리프트
`DESIGN.md` 섹션 4와 `src/lib/parser.ts`를 읽어라.
- parser.ts의 모든 CSS 선택자(`querySelector`, `querySelectorAll` 인자)가 DESIGN.md 명세와 일치하는지 확인
- 불일치 항목은 파일명:줄번호와 함께 기록

### 2. 계층 위반
`src/content/content-script.ts`, `src/sidepanel/`, `src/background/service-worker.ts`를 읽어라.
- content-script에서 DOM 파싱(`querySelector` 등) 사용 여부
- sidepanel에서 `chrome.storage` 직접 접근 여부
- sidepanel과 content-script가 background를 경유하지 않고 직접 통신하는지 여부

### 3. 타입 드리프트
`src/lib/types.ts`와 `src/lib/parser.ts`를 읽어라.
- `parseHistoryPage` 반환 객체의 필드가 `LectureEntry` 인터페이스와 일치하는지
- `parseDetailPage` 반환 객체의 필드가 `DetailInfo` 인터페이스와 일치하는지
- `normalizeEntry`가 `NormalizedEntry`의 모든 필드를 채우는지

### 4. CLAUDE.md 드리프트
루트 `CLAUDE.md`와 각 `src/*/CLAUDE.md`를 읽고, 실제 파일 구조와 비교하라.
- CLAUDE.md에 언급된 파일/디렉토리가 실제로 존재하는지
- 실제로 생긴 새 파일/디렉토리가 CLAUDE.md에 반영되지 않은 것이 있는지

### 5. 데드 코드
`src/lib/` 전체를 읽어라.
- `export`된 함수/타입 중 `src/` 전체에서 단 한 번도 import되지 않는 것
- 선언됐지만 사용되지 않는 내부 함수

### 6. TODO 추적
`src/` 전체에서 `// TODO` 주석을 수집하라.
- 각 TODO가 `DESIGN.md` 어느 Phase에 해당하는지 매핑
- Phase가 명시되지 않거나 DESIGN.md에 없는 Phase를 참조하는 TODO 기록

---

## 출력 형식

점검이 끝나면 `.claude/GC_REPORT.md`를 아래 형식으로 작성하라.
문제가 없는 항목은 한 줄로 간략히 표시하고, 문제가 있는 항목만 상세히 기록한다.

```markdown
# GC Report — {날짜}

## 요약
| 항목 | 상태 |
|------|------|
| 선택자 드리프트 | 🟢 OK / 🔴 N건 |
| 계층 위반       | 🟢 OK / 🔴 N건 |
| 타입 드리프트   | 🟢 OK / 🔴 N건 |
| CLAUDE.md 드리프트 | 🟢 OK / 🟡 N건 |
| 데드 코드       | 🟢 OK / 🟡 N건 |
| TODO 추적       | 🟢 OK / 🟡 N건 |

## 상세

### 🔴 선택자 드리프트
- `src/lib/parser.ts:42` — `.boardlist .tbl-ovx table` → DESIGN.md에는 `.boardlist .tbl table`

### 🟡 데드 코드
- `src/lib/parser.ts` — `buildDetailUrl` 함수가 export되어 있으나 미사용

## 권장 조치
- [ ] parser.ts:42 선택자 수정 또는 DESIGN.md 업데이트
- [ ] buildDetailUrl 제거 또는 사용처 추가
```

🔴 Critical(즉시 수정) / 🟡 Warning(다음 세션 전 처리) / 🟢 OK
