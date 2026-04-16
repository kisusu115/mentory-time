# src/sidepanel — React UI

## 구조
```
App.tsx                  ← 탭 전환 (접수목록 | 시간표)
store.ts                 ← Zustand 상태 + fetch 오케스트레이션 + chrome.storage 접근
ListView.tsx             ← 날짜 정렬 + 필터 + 상세 링크
TimetableView.tsx        ← 주간 시간표 + 슬롯 클릭 팝오버 + 미리보기
GoogleCalendarButton.tsx ← 구글 캘린더 일정 추가 버튼
NotionButton.tsx         ← Notion 페이지 추가 버튼
NotionSettingsView.tsx   ← Notion 연동 설정 섹션 (토큰·DB·매핑)
SettingsView.tsx         ← 통합 설정 탭 (Notion + 구글 캘린더 설정 래퍼)
cancel.ts                ← 접수 취소 페이지 열기 유틸 (pageIndex 계산 + 하이라이트 hash/sessionStorage 설정)
main.tsx                 ← React 엔트리포인트
styles.css               ← Tailwind CSS 진입점
index.html               ← 사이드 패널 HTML
```

## 상태 관리
Zustand store(`store.ts`)가 fetch 오케스트레이션과 `chrome.storage` 접근을 직접 담당.  
MV3 service worker에 `DOMParser`가 없어 사이드 패널에서 직접 fetch+파싱하는 구조로 확정.

## 스타일
- Tailwind CSS 유틸리티 클래스만 사용
- 색상 시스템: `DESIGN.md` 섹션 6.4 참조 (연두/노랑/빨강 겹침 체계)
- 사이드 패널 너비: 고정 320~400px 가정
