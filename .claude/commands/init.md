# 프로젝트 초기 세팅

처음 이 프로젝트를 클론한 개발자를 위한 초기 환경 세팅을 수행한다.

## 1. 의존성 설치

`pnpm install`을 실행하라. 실패하면 원인을 분석하고 사용자에게 안내하라.

## 2. `.git/info/exclude` 세팅

아래 항목들을 `.git/info/exclude`에 추가하라. 이미 존재하는 항목은 건너뛴다.

```
/samples
/.claude/plans
/.claude/settings.local.json
/.claude/GC_REPORT.md
```

> **왜 `.gitignore`가 아닌가?**  
> `.gitignore`에 등록하면 Claude Code의 `@` 파일 검색에서 제외된다.  
> `.git/info/exclude`는 동일하게 git 추적에서 제외하되, `@` 검색은 가능하게 한다.

## 3. 샘플 HTML 준비 안내

`samples/` 폴더에 파서 검증용 HTML 파일 4개가 필요하다. 빈 파일이 있거나 파일이 없으면 아래 안내를 사용자에게 출력하라.

### 필요한 파일

| 파일 | 출처 페이지 | URL 패턴 |
|------|-------------|----------|
| `samples/history-page1.html` | 접수내역 1페이지 | `/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=1` |
| `samples/history-page2.html` | 접수내역 2페이지 | `/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=2` |
| `samples/detail-history.html` | 특강 상세 (접수내역에서 진입) | `/sw/mypage/mentoLec/view.do?qustnrSn=...&history=y` |
| `samples/detail-list.html` | 특강 상세 (목록에서 진입) | `/sw/mypage/mentoLec/view.do?qustnrSn=...` |

### 저장 방법

1. SW마에스트로(swmaestro.ai)에 로그인
2. 위 URL로 이동
3. **F12** → Elements 탭 → `<html>` 우클릭 → **Copy → Copy outerHTML**
4. 텍스트 에디터에 붙여넣고 `samples/` 폴더에 해당 파일명으로 저장

> 파일 저장 후 `/samples`를 실행하면 파서와의 호환성을 검증할 수 있다.

## 4. 확인

완료 후 아래를 확인하고 결과를 사용자에게 보고하라:
- `pnpm install` 성공 여부
- `.git/info/exclude`에 위 4개 항목이 모두 존재하는지
- `samples/` 폴더에 4개 파일이 존재하고 내용이 비어있지 않은지 (비어있으면 위 안내 출력)

## 5. 사용 가능한 커맨드 안내

세팅이 완료되면 아래 커맨드 목록을 사용자에게 안내하라:

| 커맨드 | 설명 |
|--------|------|
| `/init` | 프로젝트 초기 세팅 (의존성 설치, git exclude, 샘플 안내) |
| `/check` | 빌드·린트 검증 (`pnpm lint` + `pnpm build`) |
| `/impl <요청>` | 기능 구현 워크플로우 (조사 → 구현 → 리팩토링 3단계) |
| `/samples` | `samples/` HTML 파일 4개를 파서로 dry-run 검증 |
| `/gc` | GC 에이전트 — 코드·문서 일관성 점검 후 `GC_REPORT.md` 생성 |
