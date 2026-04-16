# 샘플 HTML 파서 검증

`samples/` 폴더의 HTML 파일 4개를 `src/lib/parser.ts`로 파싱해 결과를 검증한다.

## 대상 파일
| 파일 | 검증 함수 |
|------|-----------|
| `samples/history-page1.html` | `parseHistoryPage` + `parseTotalPages` |
| `samples/history-page2.html` | `parseHistoryPage` + `parseTotalPages` |
| `samples/detail-history.html` | `parseDetailPage` |
| `samples/detail-list.html` | `parseDetailPage` |

## 실행 방법

각 샘플 파일을 읽고, parser.ts의 로직을 머릿속으로 실행(dry-run)하여 아래를 확인하라:

1. **접수내역 페이지** (`history-page*.html`)
   - `parseHistoryPage`: 각 행이 `LectureEntry` 필드에 올바르게 매핑되는지
   - `parseTotalPages`: 전체 페이지 수가 정확한지
   - `isLoginPage`: false를 반환하는지
   - 날짜/시간 정규식이 샘플 텍스트에 정상 매칭되는지

2. **상세 페이지** (`detail-*.html`)
   - `parseDetailPage`: `DetailInfo` 필드(qustnrSn, title, lectureDate, lectureStartTime, lectureEndTime, author, location)가 올바르게 추출되는지
   - 날짜 포맷 변환: `2026.04.08` → `2026-04-08`
   - 시간 정규식: `19:00시  ~ 22:00시` 패턴 매칭

3. **선택자 매칭**: 샘플 HTML의 DOM 구조가 parser.ts의 CSS 선택자와 일치하는지

## 출력

검증 결과를 아래 형식으로 요약:

```
## 파서 검증 결과

| 파일 | 함수 | 결과 | 비고 |
|------|------|------|------|
| history-page1.html | parseHistoryPage | ✅ 10건 파싱 | — |
| history-page1.html | parseTotalPages | ✅ 2 | — |
| ... | ... | ... | ... |
```

불일치가 있으면 샘플 HTML과 parser.ts 중 어느 쪽을 수정해야 하는지 제안.
