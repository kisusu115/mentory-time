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

## 3. 확인

완료 후 아래를 확인하고 결과를 사용자에게 보고하라:
- `pnpm install` 성공 여부
- `.git/info/exclude`에 위 4개 항목이 모두 존재하는지
