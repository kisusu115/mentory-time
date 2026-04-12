# MentoryTime — 크롬 확장프로그램 설계 문서

> SW마에스트로 멘토링/특강 접수내역 개선 확장프로그램
> GitHub: `mentory-time` | 표시명: MentoryTime

---

## 1. 프로젝트 개요

### 1.1 목적

SW마에스트로(swmaestro.ai) 접수내역 페이지의 UX를 개선하여, 신청한 멘토링/특강을 날짜별로 정렬하고 주간 시간표 형태로 시각화하는 크롬 확장프로그램.

### 1.2 핵심 기능 요약

| #   | 기능                    | 설명                                                                        |
| --- | ----------------------- | --------------------------------------------------------------------------- |
| F1  | 날짜별 정렬 리스트      | 강의날짜/시간 기준 정렬, 제목·멘토·시간·접수상태·구분 표시                  |
| F2  | 접수상태 필터링         | 접수완료/접수취소 필터 토글                                                 |
| F3  | 상세 페이지 하이퍼링크  | 각 항목 클릭 시 상세 페이지로 이동                                          |
| F4  | 주간 시간표 뷰          | 달력에서 주간 선택 → 시간표 형태, 겹침 수에 따라 색상 구분 (연두/노랑/빨강) |
| F5  | 시간표 클릭 → 목록      | 시간표의 특정 시간 클릭 시 해당 시간대 특강 목록 표시                       |
| F6  | 상세 페이지 시간표 반영 | 특강 상세 페이지에서 해당 강좌를 시간표에 가상 추가하여 겹침 시뮬레이션     |
| F7  | Google Calendar 추가    | 접수 목록/시간표 팝오버의 강좌 항목에서 구글 캘린더 일정 생성 페이지로 이동 |

---

## 2. 기술 스택

### 2.1 확장프로그램 구조

```
Manifest V3 (Chrome Extension)
├── manifest.json
├── background/
│   └── service-worker.js        # 백그라운드 서비스 워커
├── sidepanel/
│   ├── index.html               # 사이드 패널 메인 HTML
│   ├── index.js                 # React 앱 엔트리
│   └── styles.css
├── content/
│   └── content-script.js        # 페이지 DOM 파싱 & 메시지 전달
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── lib/                         # 공통 유틸
    ├── parser.js                # DOM → 데이터 파싱 로직
    └── storage.js               # chrome.storage 래퍼
```

### 2.2 기술 선택

| 영역             | 기술                 | 이유                                                   |
| ---------------- | -------------------- | ------------------------------------------------------ |
| 확장프로그램 API | Manifest V3          | Chrome 최신 표준, Side Panel API 지원                  |
| UI 프레임워크    | React 18 + Vite      | 컴포넌트 기반 UI, 빠른 빌드                            |
| 스타일링         | Tailwind CSS         | 유틸리티 클래스로 빠른 UI 개발, 사이드패널 크기에 적합 |
| 상태 관리        | Zustand              | 경량, 보일러플레이트 최소                              |
| 빌드 도구        | Vite + CRXJS         | Vite 기반 크롬 확장프로그램 빌드 플러그인              |
| 데이터 저장      | chrome.storage.local | 파싱된 접수내역 캐싱                                   |
| 언어             | TypeScript           | 타입 안전성, 데이터 구조 명확화                        |

### 2.3 대안 고려사항

- **Vanilla JS**: 가능하지만, 시간표 UI 복잡도를 감안하면 React가 생산성 높음
- **Svelte**: 좋은 선택이지만 크롬 확장프로그램 생태계에서 React가 레퍼런스 풍부
- **Popup 방식**: 팝업은 닫히면 상태가 사라지므로 사이드 패널이 적합

---

## 3. 데이터 모델

### 3.1 파싱 대상 데이터 (접수내역 테이블)

```typescript
interface LectureEntry {
  // 접수내역 테이블에서 파싱
  no: number; // NO. (td:nth-child(1))
  category: string; // 구분 - "멘토특강" | "자유멘토링" (td:nth-child(2))
  title: string; // 제목 (td.tit a 텍스트)
  detailUrl: string; // 상세 페이지 URL (td.tit a[href])
  qustnrSn: string; // 상세 페이지 고유 ID (URL에서 추출)
  author: string; // 작성자/멘토 (td:nth-child(4))
  lectureDate: string; // 강의날짜 "2026-04-24(금)" (td:nth-child(5) 첫 텍스트)
  lectureStartTime: string; // 시작 시간 "14:00:00" (td:nth-child(5) 파싱)
  lectureEndTime: string; // 종료 시간 "16:00:00" (td:nth-child(5) 파싱)
  registDate: string; // 접수일 (td:nth-child(6))
  status: "접수완료" | "접수취소"; // 접수상태 (td:nth-child(7))
  approval: string; // 개설승인 (td:nth-child(8))
}
```

### 3.2 파싱된 날짜/시간 정규화

```typescript
interface NormalizedEntry extends LectureEntry {
  // 파싱 후 정규화
  lectureDateObj: Date; // 강의날짜 Date 객체
  startMinutes: number; // 하루 시작부터 분 단위 (예: 14:00 → 840)
  endMinutes: number; // 하루 시작부터 분 단위 (예: 16:00 → 960)
  dayOfWeek: number; // 0(일)~6(토)
  weekKey: string; // "2026-W15" 형태의 주간 키
}
```

### 3.3 저장 구조 (chrome.storage.local)

```typescript
interface StorageSchema {
  entries: NormalizedEntry[]; // 전체 접수내역 (전 페이지 통합)
  lastFetched: number; // 마지막 데이터 수집 timestamp
  totalPages: number; // 전체 페이지 수
  settings: {
    hideCancel: boolean; // 접수취소 숨기기 기본값
  };
}
```

---

## 4. DOM 파싱 상세 명세

### 4.1 접수내역 페이지 파싱

**대상 URL**: `swmaestro.ai/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=*`

```javascript
// 테이블 선택자
const table = document.querySelector(".boardlist .tbl-ovx table");
const rows = table.querySelectorAll("tbody tr");

// 각 행 파싱
rows.forEach((row) => {
  const cells = row.querySelectorAll("td");

  const entry = {
    no: parseInt(cells[0].textContent.trim()),
    category: cells[1].textContent.trim(), // "멘토특강"
    title: cells[2].querySelector("a").textContent.trim(),
    detailUrl: cells[2].querySelector("a").getAttribute("href"),
    // detailUrl 예: "/sw/mypage/mentoLec/view.do?qustnrSn=9240&menuNo=200046&pageIndex=1&history=y"
    author: cells[3].textContent.trim(),
    // 강의날짜 파싱 (cells[4] 내부 구조):
    //   "2026-04-24(금)\n\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t 14:00:00  ~ 16:00:00"
    status: cells[6].textContent.trim().includes("취소")
      ? "접수취소"
      : "접수완료",
    approval: cells[7].textContent.trim(),
  };
});
```

### 4.2 강의날짜/시간 파싱 로직

```javascript
function parseLectureDateTime(cell) {
  const text = cell.textContent.trim();
  // 정규식: "2026-04-24(금)" 패턴
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\(.\)/);
  // 정규식: "14:00:00  ~ 16:00:00" 패턴
  const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})\s*~\s*(\d{2}:\d{2}:\d{2})/);

  return {
    lectureDate: dateMatch ? dateMatch[1] : "",
    lectureStartTime: timeMatch ? timeMatch[1] : "",
    lectureEndTime: timeMatch ? timeMatch[2] : "",
  };
}
```

### 4.3 전체 페이지 수 파싱

```javascript
// 마지막 페이지 번호 추출
const endPageLink = document.querySelector(".paginationSet .end a");
const totalPages = parseInt(endPageLink.getAttribute("data-endpage"));
// 또는 Total 숫자에서 계산: Math.ceil(total / 10)
const totalText = document.querySelector(".bbs-total li strong").textContent;
const total = parseInt(totalText.match(/\d+/)[0]);
```

### 4.4 상세 페이지 파싱 (F6용)

**대상 URL**: `swmaestro.ai/sw/mypage/mentoLec/view.do?qustnrSn=*&menuNo=200046*`

```javascript
// 상세 페이지 구조: .bbs-view-new .top 내부
// 강의날짜 셀: <span class="eventDt">2026.04.07</span>
// 시간: " 19:00시  ~ 22:00시" (같은 .c div 내부 텍스트)
const eventDt = document.querySelector(".eventDt").textContent.trim();
// "2026.04.07" → "2026-04-07"

const timeDiv = document.querySelector(".eventDt").parentElement;
const timeText = timeDiv.textContent;
// 정규식으로 시간 추출: "19:00시  ~ 22:00시"
const timeMatch = timeText.match(/(\d{2}:\d{2})시\s*~\s*(\d{2}:\d{2})시/);

// 모집명
const lectureName = document.querySelector(".group .c").textContent.trim();
// 작성자
const authorDiv = document
  .querySelectorAll(".half_w")[3] // 4번째 half_w (실제 HTML 기준)
  .querySelector(".group .c");
```

### 4.5 상세 페이지 URL 생성 규칙

```javascript
// 접수내역에서 이미 href가 있음
// 예: /sw/mypage/mentoLec/view.do?qustnrSn=9240&menuNo=200046&pageIndex=1&history=y

// 전체 URL 생성
function getFullDetailUrl(relativeUrl) {
  return `https://swmaestro.ai${relativeUrl}`;
}

// qustnrSn만으로 URL 생성 (최소한의 파라미터)
function buildDetailUrl(qustnrSn) {
  return `https://swmaestro.ai/sw/mypage/mentoLec/view.do?qustnrSn=${qustnrSn}&menuNo=200046&pageIndex=1`;
}
```

---

## 5. 아키텍처 & 통신 흐름

### 5.1 전체 흐름도

```
┌─────────────────────────────────────────────────┐
│                Chrome Browser                    │
│                                                  │
│  ┌──────────────────┐    ┌───────────────────┐  │
│  │  Content Script   │    │   Side Panel      │  │
│  │  (content.js)     │───►│   (React App)     │  │
│  │                   │    │                   │  │
│  │  - 페이지 URL 감지│    │  - 정렬 리스트 탭  │  │
│  │  - 사이드 패널    │    │  - 시간표 탭       │  │
│  │    열기 요청      │    │  - fetch + 파싱    │  │
│  └────────┬─────────┘    └────────┬──────────┘  │
│           │                       │              │
│           ▼                       │              │
│  ┌──────────────────────────────┐ │              │
│  │  Service Worker (background) │ │              │
│  │  - Side Panel 라이프사이클   │ │              │
│  └──────────────────────────────┘ │              │
│                                   ▼              │
│  ┌──────────────────────────────────────────┐   │
│  │         chrome.storage.local              │   │
│  │         (파싱된 접수내역 캐시)              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 5.2 데이터 수집 전략

확장프로그램은 **현재 페이지의 DOM을 직접 파싱**하는 것이 아니라, **사이드 패널에서 모든 페이지를 fetch**하여 통합합니다.

> **구조 결정 이유**: MV3 Service Worker에 `DOMParser`가 없어 HTML 파싱 불가. 사이드 패널(브라우저 컨텍스트)에서 fetch + DOMParser를 직접 실행하는 구조로 확정.

```
1. 사용자가 접수내역 또는 상세 페이지 접속
2. Content Script가 URL을 감지하여 Background에 PAGE_DETECTED 전송
3. Background가 메시지 타입에 따라 Side Panel에 실시간 알림 전송
   - 접수내역 페이지: HISTORY_PAGE_DETECTED → Side Panel이 fetchAll() 자동 실행
   - 상세 페이지: DETAIL_PAGE_DETECTED → Side Panel이 시뮬레이션 버튼 활성화
   - 그 외 페이지: DETAIL_PAGE_CLEARED → 시뮬레이션 버튼 비활성화
4. Side Panel 초기화 시 GET_PENDING_DETAIL로 Background의 pending 상태 조회
5. Side Panel(store.ts) fetchAll():
   a. 1페이지 fetch → DOMParser로 HTML 파싱 → 총 페이지 수 확인
   b. 2~N페이지 순차 fetch → HTML 파싱
   c. 전체 데이터를 chrome.storage.local에 저장 및 렌더링

신청 완료 직후 자동 갱신 흐름:
1. 상세 페이지의 MAIN world content-script(xhr-hook)가 apply.json POST 성공 응답 감지
2. CustomEvent로 isolated world content-script에 전달
3. isolated content-script가 Background에 APPLY_COMPLETE 전송
4. Background가 chrome.tabs.onUpdated로 탭 reload 완료를 대기한 뒤
   HISTORY_PAGE_DETECTED broadcast → Side Panel의 fetchAll() 트리거
```

**fetch 방식의 장점**: 같은 도메인의 세션 쿠키가 자동으로 포함되므로 별도 인증 불필요.

### 5.3 메시지 프로토콜

```typescript
// Content Script → Background
{ type: "PAGE_DETECTED", payload: { pageType: "history" | "detail" | "other", url: string } }
{ type: "APPLY_COMPLETE" }  // 상세 페이지에서 신청 성공 감지

// Background → Side Panel (실시간 알림 — 사이드 패널이 이미 열려있을 때)
{ type: "DETAIL_PAGE_DETECTED", payload: { qustnrSn: string } }  // 상세 페이지 감지
{ type: "HISTORY_PAGE_DETECTED", payload: null }                  // 접수내역 페이지 감지 → fetchAll 트리거
{ type: "DETAIL_PAGE_CLEARED", payload: null }                    // 상세 페이지 벗어남

// Side Panel → Background (초기화 시 pending detail 조회)
{ type: "GET_PENDING_DETAIL" }
// Background → Side Panel (응답)
{ qustnrSn?: string } | null
```

> `APPLY_COMPLETE`는 MAIN world의 `xhr-hook.ts`가 `apply.json` 응답을 감지 → isolated content-script가 CustomEvent로 받아 background에 전달. Background는 탭 reload 완료를 기다린 뒤 `HISTORY_PAGE_DETECTED`를 broadcast한다.

---

## 6. UI 설계

### 6.1 사이드 패널 레이아웃

```
┌──────────────────────────────┐
│  [접수 목록]  [시간표]         │  ← 탭 전환 (크롬 네이티브 타이틀 바 위에 표시)
├──────────────────────────────┤
│                              │
│     (탭 내용 영역)            │
│                              │
└──────────────────────────────┘
```

> 커스텀 헤더 제거됨 — 크롬 네이티브 타이틀 바(MentoryTime + 고정/닫기)가 상단을 담당.  
> 헤더 새로고침 버튼 제거 — 접수내역 페이지 방문 시 자동 갱신(`HISTORY_PAGE_DETECTED`).  
> 단, 빈 상태(캐시 없음)에서는 "불러오기" 버튼, 에러 상태에서는 "다시 시도" 버튼으로 수동 `fetchAll()` 가능.

### 6.2 접수 목록 탭 (F1, F2, F3)

```
┌──────────────────────────────┐
│ 필터: [✅ 접수완료] [접수취소] │  ← F2: 상태 필터 토글
├──────────────────────────────┤
│                              │
│ 📅 2026-04-29 (화)           │  ← 날짜 그룹 헤더
│ ┌──────────────────────────┐ │
│ │ 🔗 그로스해킹의 원조...    │ │  ← F3: 클릭 시 상세 페이지 이동
│ │ 노수진 · 10:00~11:00     │ │
│ │ 멘토특강 · ✅ 접수완료     │ │
│ └──────────────────────────┘ │
│                              │
│ 📅 2026-04-19 (일)           │
│ ┌──────────────────────────┐ │
│ │ 🔗 요새 빅테크 개발자는...  │ │
│ │ 허소영 · 11:00~12:00     │ │
│ │ 멘토특강 · ✅ 접수완료     │ │
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

### 6.3 시간표 탭 (F4, F5, F6)

```
┌──────────────────────────────┐
│ ◀ 2026년 4월 2주차 (7~13) ▶  │  ← 주간 선택 네비게이션
├──────────────────────────────┤
│      월  화  수  목  금  토  일│
│ 09:00                        │
│ 10:00 ██       ██            │  ← 연두색: 1개
│ 11:00 ██       ██            │
│ 12:00                        │
│ 13:00          ██            │  ← 노란색: 2개 겹침
│ 14:00          ██            │
│ 15:00          ██  ██        │  ← 빨간색: 3개 이상
│ 16:00          ██  ██        │
│ ...                          │
├──────────────────────────────┤
│ ⚡ 미리보기: "AI 시대, 왜..." │  ← F6: 상세 페이지 감지 시
│ 4/30(수) 16:00~18:00         │     점선 테두리로 시간표에 표시
│ [반영 해제]                   │
└──────────────────────────────┘
```

### 6.4 시간표 색상 체계

| 겹침 수  | 색상                         | HEX                                   | 의미                 |
| -------- | ---------------------------- | ------------------------------------- | -------------------- |
| 0        | 투명                         | -                                     | 비어있음             |
| 1        | 연두색                       | `#B7DEB8`                             | 정상                 |
| 2        | 노란색                       | `#FFF59D`                             | 주의 (2개 겹침)      |
| 3+       | 빨간색                       | `#F7B3B6`                             | 경고 (3개 이상 겹침) |
| 미리보기 | 겹침 색상 + 좌측 회색 세로선 | `box-shadow: inset 3px 0 0 0 #4B5563` | F6 시뮬레이션        |

> 시간 범위: 09:00~22:30 (30분 단위, 고정 표시)

### 6.5 시간 슬롯 클릭 팝오버 (F5)

```
┌──────────────────────────────┐
│ 4/10(금) 13:00 ~ 15:30       │
│──────────────────────────────│
│ 1. SOMA 프로젝트를 위한 시스  │
│    템 아키텍처 특강           │
│    강상진 · 13:00~15:30      │
│    [상세보기 →]               │
│──────────────────────────────│
│ 2. 내 아이디어를 '진짜 비즈   │
│    니스'로 기획하고...        │
│    이세진 · 13:00~16:00      │
│    [상세보기 →]               │
└──────────────────────────────┘
```

---

## 7. manifest.json 명세

```json
{
  "manifest_version": 3,
  "name": "MentoryTime",
  "version": "1.0.0",
  "description": "SW마에스트로 멘토링/특강 접수내역 시간표 뷰어",
  "permissions": ["sidePanel", "storage", "scripting"],
  "host_permissions": ["https://swmaestro.ai/*", "https://www.swmaestro.ai/*"],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": [
        "https://swmaestro.ai/sw/mypage/*",
        "https://www.swmaestro.ai/sw/mypage/*"
      ],
      "js": ["src/content/content-script.ts"]
    },
    {
      "matches": [
        "https://swmaestro.ai/sw/mypage/mentoLec/view.do*",
        "https://www.swmaestro.ai/sw/mypage/mentoLec/view.do*"
      ],
      "js": ["src/content/xhr-hook.ts"],
      "world": "MAIN",
      "run_at": "document_start"
    }
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_title": "MentoryTime"
  }
}
```

---

## 8. URL 패턴 정리

| 페이지                    | URL 패턴                                                              | menuNo |
| ------------------------- | --------------------------------------------------------------------- | ------ |
| 접수내역                  | `/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex={n}`        | 200047 |
| 자유멘토링/멘토특강 목록  | `/sw/mypage/mentoLec/list.do?menuNo=200046`                           | 200046 |
| 행사 게시판               | `/sw/mypage/applicants/list.do?menuNo=200045`                         | 200045 |
| 특강 상세                 | `/sw/mypage/mentoLec/view.do?qustnrSn={id}&menuNo=200046&pageIndex=1` | 200046 |
| 특강 상세 (접수내역 경유) | `...&history=y` (추가 파라미터, 없어도 동작)                          | 200046 |

---

## 9. 핵심 알고리즘

### 9.1 주간 시간표 겹침 계산

```typescript
function calculateOverlaps(
  entries: NormalizedEntry[],
  weekStart: Date,
): TimeSlotMap {
  // 30분 단위 슬롯 생성 (7일 × 시간대)
  const slots: Map<string, NormalizedEntry[]> = new Map();

  const activeEntries = entries.filter((e) => e.status === "접수완료");

  for (const entry of activeEntries) {
    const entryDate = entry.lectureDateObj;
    if (entryDate < weekStart || entryDate >= addDays(weekStart, 7)) continue;

    const dayIndex = getDayOffset(weekStart, entryDate); // 0~6

    // 30분 슬롯 단위로 채우기
    for (let min = entry.startMinutes; min < entry.endMinutes; min += 30) {
      const key = `${dayIndex}-${min}`; // "0-840" = 월요일 14:00
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key)!.push(entry);
    }
  }

  return slots; // 각 슬롯의 entries 배열 length가 겹침 수
}
```

### 9.2 F6: 상세 페이지 시뮬레이션

```typescript
function simulateWithPreview(
  existingSlots: TimeSlotMap,
  previewEntry: { date: Date; startMin: number; endMin: number },
): TimeSlotMap {
  const simulated = new Map(existingSlots);
  const dayIndex = getDayOffset(weekStart, previewEntry.date);

  for (let min = previewEntry.startMin; min < previewEntry.endMin; min += 30) {
    const key = `${dayIndex}-${min}`;
    const existing = simulated.get(key) || [];
    // 미리보기 항목을 가상으로 추가 (isPreview 플래그)
    simulated.set(key, [...existing, { ...previewEntry, isPreview: true }]);
  }

  return simulated;
}
```

---

## 10. 배포

### 10.1 CRX 파일 배포 (1차)

1. `npm run build` → `dist/` 폴더 생성
2. Chrome에서 `chrome://extensions` → 개발자 모드 → "압축하지 않은 확장프로그램 로드" 또는 `.crx` 패키징
3. `.crx` 파일을 동기들에게 공유 (또는 zip으로 배포)

### 10.2 Chrome 웹스토어 (2차, 필요 시)

1. 개발자 등록비 $5
2. 스크린샷, 설명 준비
3. 심사 기간 1~3일

---

## 11. 개발 순서 (권장)

| Phase | 작업                                                                | 예상 시간 |
| ----- | ------------------------------------------------------------------- | --------- |
| P0    | 프로젝트 세팅 (Vite + CRXJS + React + TS + Tailwind)                | 1~2h      |
| P1    | Content Script: 접수내역 DOM 파싱 + Background fetch 오케스트레이션 | 2~3h      |
| P2    | Side Panel: 접수 목록 탭 (F1 + F2 + F3)                             | 2~3h      |
| P3    | Side Panel: 시간표 탭 기본 (F4)                                     | 3~4h      |
| P4    | 시간표 인터랙션 (F5: 슬롯 클릭 → 목록)                              | 1~2h      |
| P5    | 상세 페이지 감지 + 시뮬레이션 (F6)                                  | 2~3h      |
| P6    | 폴리싱, 에러 처리, 배포                                             | 1~2h      |

---

## 12. Claude Code 시작 시 전달할 정보 체크리스트

Claude Code에서 작업을 시작할 때, 이 설계 문서(DESIGN.md)와 함께 아래 파일들을 프로젝트 루트에 배치하세요:

### 12.1 필수 파일

1. **`DESIGN.md`** — 이 설계 문서 (전체 복사)
2. **`samples/history-page1.html`** — 접수내역 1페이지 HTML (Document 1)
3. **`samples/history-page2.html`** — 접수내역 2페이지 HTML (Document 2)
4. **`samples/detail-history.html`** — 상세 페이지 (접수내역 경유, Document 3)
5. **`samples/detail-list.html`** — 상세 페이지 (목록 경유, Document 4)

### 12.2 Claude Code 초기 프롬프트 예시

```
이 프로젝트는 "MentoryTime" — SW마에스트로 멘토링/특강 접수내역을 개선하는 크롬 확장프로그램이야.

DESIGN.md에 전체 설계가 있고, samples/ 폴더에 실제 HTML 파일 4개가 있어.

기술 스택: Manifest V3 + React 18 + Vite + CRXJS + TypeScript + Tailwind CSS + Zustand
UI: 사이드 패널 (Side Panel API)

Phase 0부터 시작해줘:
1. Vite + CRXJS 프로젝트 세팅
2. manifest.json 생성
3. 기본 사이드 패널 렌더링 확인

DESIGN.md의 섹션 4 "DOM 파싱 상세 명세"를 기반으로 파서를 구현해줘.
samples/ HTML 파일로 파싱 로직을 테스트할 수 있어.
```

### 12.3 핵심 전달 포인트

- **도메인**: `swmaestro.ai` (www 포함 양쪽)
- **인증**: 같은 도메인 쿠키 공유, fetch 시 별도 인증 불필요 (예상)
- **페이지네이션**: `pageIndex` 쿼리 파라미터, 페이지당 최대 10개
- **총 페이지 수**: `.paginationSet .end a[data-endpage]` 또는 Total 수에서 계산
- **강의 시간 형식**: 접수내역에서는 `HH:MM:SS ~ HH:MM:SS`, 상세에서는 `HH:MM시 ~ HH:MM시`
- **접수 취소 행**: `<span class="color-red">접수취소</span>`으로 식별
- **상세 페이지 URL**: `qustnrSn` 파라미터가 고유 식별자
