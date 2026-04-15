# MentoryTime

SW마에스트로 멘토링/특강 접수내역을 주간 시간표로 시각화하는 크롬 확장프로그램입니다.

## 주요 기능

- **접수 목록** — 날짜/시간 기준 자동 정렬, 상태 필터링, 상세 페이지 바로가기
- **주간 시간표** — 30분 슬롯 캘린더 뷰, 겹침 색상 구분, 주 단위 탐색
- **시뮬레이션** — 특강 상세 페이지 방문 시 기존 일정과의 겹침 미리 확인
- **캘린더 연동** — 구글 캘린더·Notion DB에 원클릭 일정 추가
- **편의 기능** — 시간표 시작 요일 선택, 수동 새로고침, 자동 갱신, 로그인 감지

## 업데이트 내역

버전별 상세 변경 사항은 [CHANGELOG](docs/CHANGELOG.md)를 참고하세요.

---

## 설치 방법

1. [Releases](https://github.com/leegwichan/mentory-time/releases)에서 최신 zip 파일 다운로드
2. 압축 해제
3. Chrome에서 `chrome://extensions` 접속
4. 우측 상단 **개발자 모드** 활성화
5. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 압축 해제한 폴더 선택

---

## 개발 환경 세팅

이 프로젝트는 [Claude Code](https://claude.ai/claude-code)를 기반으로 개발이 진행됩니다.  
프로젝트 루트의 `CLAUDE.md`와 각 디렉토리의 `CLAUDE.md`에 AI 작업 가이드가 정의되어 있으며, `.claude/commands/`에 자주 쓰는 커맨드(`/check`, `/gc`, `/samples` 등)가 준비되어 있습니다.

### 시작하기

1. 레포지토리 클론
2. Claude Code에서 `/init` 실행 — 의존성 설치 및 로컬 환경 설정이 자동으로 수행됩니다
3. `pnpm dev` 실행 — Vite 개발 서버가 시작되고 `dist/` 폴더에 빌드 결과물이 생성됩니다
4. Chrome에서 `chrome://extensions` 접속 → 우측 상단 **개발자 모드** 활성화
5. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 `dist/` 폴더 선택

> `/init`이 수행하는 작업:
> - `pnpm install` — 의존성 설치
> - `.git/info/exclude` 세팅 — Claude 전용 파일(`/samples`, `/.claude/plans` 등) 등록 (`.gitignore` 대신 사용하여 `@` 파일 검색 가능하게 유지)
> - `samples/` HTML 파일 준비 안내 — 파서 검증용 HTML 4개 파일이 필요하며, 없으면 저장 방법을 안내

---

## 기술 스택

Manifest V3 · React 18 · Vite · CRXJS · TypeScript · Tailwind CSS · Zustand

## 개인정보처리방침

MentoryTime은 사용자의 개인정보를 수집하지 않습니다.

### 데이터 처리 방식

- 이 확장프로그램은 사용자가 SW마에스트로(swmaestro.ai)에 로그인된 상태에서 접수내역 페이지를 방문할 때 해당 데이터를 가져옵니다.
- 가져온 데이터는 사용자의 브라우저 로컬 저장소(`chrome.storage.local`)에만 저장되며, 기본적으로 외부 서버나 제3자에게 전송되지 않습니다.
- 사용자가 Notion 연동을 설정한 경우, 특강 정보(제목·날짜·시간·장소 등)가 사용자의 Notion 데이터베이스에 추가하기 위해 Notion API(`https://api.notion.com`)로 전송됩니다. 이 기능은 사용자가 직접 설정하지 않는 한 동작하지 않습니다.
- 확장프로그램을 제거하면 저장된 모든 데이터가 함께 삭제됩니다.

### 접근 권한

| 권한 | 사용 목적 |
|------|----------|
| `sidePanel` | 사이드 패널 UI 표시 |
| `storage` | 접수내역 로컬 캐싱 |
| `activeTab` | 현재 탭 URL 감지 |
| `https://swmaestro.ai/*` | 접수내역 데이터 fetch |
| `https://api.notion.com/*` | Notion 데이터베이스 연동 |

### 문의

문의사항은 [GitHub Issues](https://github.com/leegwichan/mentory-time/issues)를 통해 남겨주세요.
