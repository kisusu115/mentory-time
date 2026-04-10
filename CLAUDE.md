# MentoryTime — AI 작업 가이드

> **불확실하면 즉시 물어봐라.** 추측하지 말고 사용자에게 바로 질문할 것.

## 프로젝트
SW마에스트로 접수내역 개선 크롬 확장프로그램.  
전체 설계: `DESIGN.md` | 실제 HTML 샘플: `samples/`

## 기술 스택
Manifest V3 · React 18 · Vite · CRXJS · TypeScript (strict) · Tailwind CSS · Zustand

## 디렉토리 라우팅

| 경로 | 역할 | 세부 가이드 |
|------|------|-------------|
| `src/lib/` | 파서·스토리지·타입 (순수 로직, DOM/chrome API 없음) | `src/lib/CLAUDE.md` |
| `src/content/` | 콘텐츠 스크립트: isolated world는 URL 감지·메시지 중계, MAIN world는 XHR 훅 (`xhr-hook.ts`) | `src/content/CLAUDE.md` |
| `src/background/` | 서비스 워커 (Side Panel 라이프사이클 + 메시지 중계) | `src/background/CLAUDE.md` |
| `src/sidepanel/` | React UI + fetch 오케스트레이션 (`store.ts`) | `src/sidepanel/CLAUDE.md` |
| `samples/` | 실제 HTML 파일 4개 — 파서 검증용, 수정 금지 | — |

## 불변 규칙
1. **타입**: `any` 사용 금지. 모든 타입은 `src/lib/types.ts` 에서 정의.
2. **계층**: content-script는 DOM 파싱하지 않음 — fetch와 파싱은 사이드패널 `store.ts` → `src/lib/parser.ts` 경로에서만.
3. **메시지 프로토콜**: `DESIGN.md` 섹션 5.3 참조. 새 메시지 타입 추가 시 타입 파일도 함께 수정.
4. **커밋**: Phase/기능 단위로 커밋. 빌드(`pnpm build`) + 린트(`pnpm lint`) 통과 후 커밋.

## 자동화 검사
```bash
pnpm lint      # ESLint (--max-warnings 0, pre-commit에서도 실행)
pnpm build     # TypeScript 타입체크 + Vite 빌드
```
pre-commit 훅이 `lint-staged`를 실행하므로, 훅을 절대 `--no-verify`로 우회하지 말 것.

## 참고 문서
| 문서 | 내용 |
|------|------|
| `fix-history.md` | §1~6 사이드패널 fetch 인증 (third-party cookie, `chrome.scripting.executeScript`) / §7~10 신청 완료 자동 갱신 (MAIN world XHR 훅, 탭 reload race) |
| `GC_REPORT.md` | 최근 GC 점검 결과 |

## GC 에이전트
피처 머지 전 또는 코드가 많이 쌓였을 때 `/gc` 실행 → `GC_REPORT.md` 생성.  
담당: 선택자 드리프트 · 계층 위반 · 타입 드리프트 · CLAUDE.md 드리프트 · 데드 코드 · TODO 추적.  
🔴 Critical은 즉시 수정, 🟡 Warning은 다음 세션 전 처리.
