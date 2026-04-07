# src/sidepanel — React UI

## 구조
```
App.tsx          ← 탭 전환 (접수목록 | 시간표)
ListView.tsx     ← F1(날짜 정렬) + F2(필터) + F3(링크)  [추가 예정]
TimetableView.tsx ← F4(주간 시간표) + F5(클릭 팝오버) + F6(미리보기) [추가 예정]
```

## 상태 관리
Zustand store는 `src/sidepanel/store.ts` 에 정의.  
`chrome.storage`를 직접 읽지 말고 background 메시지 응답으로만 데이터 수신.

## 스타일
- Tailwind CSS 유틸리티 클래스만 사용
- 색상 시스템: `DESIGN.md` 섹션 6.4 참조 (연두/노랑/빨강 겹침 체계)
- 사이드 패널 너비: 고정 320~400px 가정
