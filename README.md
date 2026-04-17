# MentoryTime

> [!IMPORTANT]
> [Chrome Web Store에서 설치](https://chromewebstore.google.com/detail/lomigmnchnpcchbilnnnedcjacigcdcj)

> [!TIP]
> [AI·SW마에스트로](https://www.swmaestro.ai) 멘토링/특강 일정을 사이드패널에서 한눈에 관리하는 크롬 확장프로그램입니다.

![MentoryTime 스크린샷](https://github.com/kisusu115/mentory-time/blob/main/screenshots/screenshot-combined.png?raw=1)

## 주요 기능

### 전체 강의

- 날짜별 전체 멘토링/특강 목록 조회
- 상태(접수중/마감), 카테고리(멘토특강/자유멘토링), 시간대별 필터링
- 제목 및 멘토 이름 검색
- 내가 접수완료한 강의 초록색 하이라이트
- 날짜별 24시간 독립 캐시 (새로고침 전까지 유지)

### 접수 목록

- 내 접수내역을 강의날짜/시간 기준 정렬
- 접수완료/접수취소 필터 토글, 과거 기록 포함 토글
- 사이드패널에서 직접 접수 취소
- Google Calendar·Notion DB 원클릭 일정 추가
- 사이드패널 내 로그인 지원
- SW마에스트로 탭이 없거나 로그인 세션이 만료된 경우, `다시 시도`로 탭 자동 생성 + 저장 계정 자동 로그인 재시도

### 주간 시간표

- 30분 단위 슬롯, 겹침 수에 따라 색상 구분 (초록/주황/빨강)
- 슬롯 클릭 시 해당 시간대 강좌 목록 팝오버 (장소 정보 포함)
- 특강 상세 페이지 방문 시 시간표에 가상 반영하여 겹침 확인 (시뮬레이션)
- 구글 캘린더 오버레이로 기존 일정과 함께 확인

## 업데이트 내역

버전별 상세 변경 사항은 [CHANGELOG](docs/CHANGELOG.md)를 참고하세요.

## 설치 방법

### Chrome Web Store (권장)

[Chrome Web Store에서 설치](https://chromewebstore.google.com/detail/lomigmnchnpcchbilnnnedcjacigcdcj)

### 수동 설치

1. [Releases](https://github.com/kisusu115/mentory-time/releases)에서 최신 zip 파일 다운로드
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
>
> - `pnpm install` — 의존성 설치
> - `.git/info/exclude` 세팅 — Claude 전용 파일(`/samples`, `/.claude/plans` 등) 등록 (`.gitignore` 대신 사용하여 `@` 파일 검색 가능하게 유지)
> - `samples/` HTML 파일 준비 안내 — 파서 검증용 HTML 4개 파일이 필요하며, 없으면 저장 방법을 안내

---

## 기술 스택

Manifest V3 · React 18 · Vite · CRXJS · TypeScript · Tailwind CSS · Zustand

## 배포 자동화

- `main` 브랜치에 머지되면 GitHub Actions가 자동 실행됩니다.
- patch 버전 자동 증가 → 빌드 → Chrome Web Store 드래프트 업로드 → GitHub Release 생성

---

## 개인정보처리방침

MentoryTime은 사용자의 개인정보를 수집하지 않습니다.

### 데이터 처리 방식

- swmaestro.ai에 로그인된 상태에서 접수내역/강의 목록 데이터를 가져옵니다.
- 모든 데이터는 브라우저 로컬 저장소(`chrome.storage.local`)에만 저장되며, 기본적으로 외부 서버나 제3자에게 전송되지 않습니다.
- 사용자가 Notion 연동을 설정한 경우, 특강 정보(제목·날짜·시간·장소 등)가 사용자의 Notion 데이터베이스에 추가하기 위해 Notion API(`https://api.notion.com`)로 전송됩니다. 이 기능은 사용자가 직접 설정하지 않는 한 동작하지 않습니다.
- 로그인 정보 저장 시 AES-256-GCM 암호화를 적용합니다.
- 확장프로그램을 제거하면 저장된 모든 데이터가 함께 삭제됩니다.

### 접근 권한

| 권한                       | 사용 목적                                        |
| -------------------------- | ------------------------------------------------ |
| `sidePanel`                | 사이드 패널 UI 표시                              |
| `storage`                  | 접수내역/강의 목록/설정 로컬 캐싱                |
| `scripting`                | swmaestro.ai 탭에서 인증된 세션으로 데이터 fetch |
| `identity`                 | 구글 캘린더 OAuth 인증                           |
| `https://swmaestro.ai/*`   | 접수내역/강의 목록 데이터 fetch                  |
| `https://api.notion.com/*` | Notion 데이터베이스 연동                         |

### 문의

문의사항은 [GitHub Issues](https://github.com/kisusu115/mentory-time/issues)를 통해 남겨주세요.

## Contributors

<!-- CONTRIBUTORS:START -->

<p>
  <a href="https://github.com/kisusu115" title="kisusu115"><img src="https://avatars.githubusercontent.com/u/119473141?v=4" alt="kisusu115" width="72" height="72" style="width: 72px; height: 72px; border-radius: 9999px; object-fit: cover; display: inline-block;" /></a>
  <a href="https://github.com/leegwichan" title="leegwichan"><img src="https://avatars.githubusercontent.com/u/44027393?v=4" alt="leegwichan" width="72" height="72" style="width: 72px; height: 72px; border-radius: 9999px; object-fit: cover; display: inline-block;" /></a>
  <a href="https://github.com/Turtle-Hwan" title="Turtle-Hwan"><img src="https://avatars.githubusercontent.com/u/67897841?v=4" alt="Turtle-Hwan" width="72" height="72" style="width: 72px; height: 72px; border-radius: 9999px; object-fit: cover; display: inline-block;" /></a>
</p>

<!-- CONTRIBUTORS:END -->

## Star History

<a href="https://www.star-history.com/?repos=kisusu115%2Fmentory-time&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=kisusu115/mentory-time&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=kisusu115/mentory-time&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=kisusu115/mentory-time&type=date&legend=top-left" />
 </picture>
</a>
