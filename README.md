# MentoryTime

SW마에스트로 멘토링/특강 접수내역을 주간 시간표로 시각화하는 크롬 확장프로그램입니다.

## 주요 기능

- **접수 목록** — 강의날짜/시간 기준 정렬, 접수 상태 필터링, 상세 페이지 이동
- **주간 시간표** — 30분 단위 슬롯, 겹침 수에 따라 색상 구분 (초록/주황/빨강)
- **슬롯 클릭** — 해당 시간대 강좌 목록 팝오버
- **캘린더 추가** — 접수 목록/시간표 팝오버에서 Google Calendar 일정 추가
- **시뮬레이션** — 특강 상세 페이지 방문 시 시간표에 가상 반영하여 겹침 확인
- **자동 갱신** — 접수내역 페이지 방문 시 데이터 자동 업데이트

## 설치 방법

1. [Releases](https://github.com/kisusu115/mentory-time/releases)에서 최신 zip 파일 다운로드
2. 압축 해제
3. Chrome에서 `chrome://extensions` 접속
4. 우측 상단 **개발자 모드** 활성화
5. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 압축 해제한 폴더 선택

## 기술 스택

Manifest V3 · React 18 · Vite · CRXJS · TypeScript · Tailwind CSS · Zustand

## 배포 자동화

- `main` 브랜치에 커밋/머지되면 GitHub Actions의 `release.yaml`이 자동 실행됩니다.
- 워크플로는 `pnpm build` 후 `dist/`를 zip(`mentory-time-main-<sha7>.zip`)으로 묶어 GitHub Release에 업로드합니다.
- Release 태그는 `main-latest`를 사용하며, 새 실행 시 기존 아티팩트를 교체합니다.

---

## 개인정보처리방침

MentoryTime은 사용자의 개인정보를 수집하거나 외부 서버로 전송하지 않습니다.

### 데이터 처리 방식

- 이 확장프로그램은 사용자가 SW마에스트로(swmaestro.ai)에 로그인된 상태에서 접수내역 페이지를 방문할 때 해당 데이터를 가져옵니다.
- 가져온 데이터는 사용자의 브라우저 로컬 저장소(`chrome.storage.local`)에만 저장되며, 외부 서버나 제3자에게 전송되지 않습니다.
- 확장프로그램을 제거하면 저장된 모든 데이터가 함께 삭제됩니다.

### 접근 권한

| 권한                     | 사용 목적             |
| ------------------------ | --------------------- |
| `sidePanel`              | 사이드 패널 UI 표시   |
| `storage`                | 접수내역 로컬 캐싱    |
| `activeTab`              | 현재 탭 URL 감지      |
| `https://swmaestro.ai/*` | 접수내역 데이터 fetch |

### 문의

문의사항은 [GitHub Issues](https://github.com/kisusu115/mentory-time/issues)를 통해 남겨주세요.
