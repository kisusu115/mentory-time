# Fix History — 인증 불가 문제 해결 과정

> 2026-04-08 · 사이드패널 fetch 시 로그인 상태가 인식되지 않는 문제

---

## 1. 증상

로그인 상태임에도 사이드패널에서 "데이터를 불러오지 못했어요" 에러 발생.  
동일한 dist를 4개 환경에 배포했을 때 2개는 정상, 2개는 실패.

콘솔 에러:
```
Access to fetch at 'http://swmaestro.ai/sw/member/user/loginForward.do'
(redirected from 'https://swmaestro.ai/sw/mypage/userAnswer/history.do?...')
from origin 'chrome-extension://ddjoldlpldfpcajohfdppjphieflbdfp'
has been blocked by CORS policy
```

---

## 2. 원인 분석

### 2.1 요청 흐름 (변경 전)

```
사이드패널 (chrome-extension://xxx)
  → fetch('https://swmaestro.ai/...', { credentials: 'include' })
  → 서버가 세션 쿠키를 인식하지 못함
  → 302 → http://swmaestro.ai/sw/member/user/loginForward.do
  → CORS 에러 (chrome-extension origin에 Access-Control-Allow-Origin 없음)
```

### 2.2 왜 쿠키가 안 갔는가

사이드패널의 origin은 `chrome-extension://ddjoldlpldf...`이다.  
여기서 `swmaestro.ai`로 fetch하면 **cross-origin 요청**이다.

`credentials: 'include'`를 써도 서버 세션 쿠키는 **third-party cookie**로 분류된다.  
Chrome은 third-party cookie를 점진적으로 차단하고 있으며, 이 정책은 Chrome 버전·설정·실험 그룹에 따라 환경별로 다르게 적용된다.

- 2/4 환경: third-party cookie 허용 → 쿠키 전송 → 정상
- 2/4 환경: third-party cookie 차단 → 쿠키 미전송 → 로그인 리다이렉트 → CORS 에러

### 2.3 www vs non-www도 실제 문제였다

`swmaestro.ai` 접속 시 `www.swmaestro.ai`로 리다이렉트되지 **않는다**. 두 도메인이 독립적으로 존재한다.

따라서 `chrome.scripting.executeScript` 방식으로 전환한 후에도, 하드코딩된 `https://swmaestro.ai/...` URL로 fetch하면:
- 탭이 `www.swmaestro.ai`인 경우 → MAIN world의 origin은 `www.swmaestro.ai` → `swmaestro.ai`로 fetch는 **cross-origin** → 쿠키 미전송
- 탭이 `swmaestro.ai`인 경우 → same-origin → 정상

이 때문에 origin 동적 감지(탭 URL에서 origin 추출)는 안전장치가 아니라 **필수 수정**이다.

**정리하면 원인은 두 가지가 겹쳐 있었다:**
1. **chrome-extension:// third-party cookie 차단** → `executeScript` + `world: 'MAIN'`으로 해결
2. **www vs non-www origin 불일치** → 탭 origin 동적 감지로 해결

---

## 3. 해결: chrome.scripting.executeScript + world: 'MAIN'

### 3.1 핵심 아이디어

사이드패널에서 직접 fetch하지 않고, **열려있는 swmaestro.ai 탭의 페이지 컨텍스트에서 fetch를 실행**한다.

```
사이드패널
  → chrome.scripting.executeScript({
      target: { tabId },    // swmaestro.ai 탭
      world: 'MAIN',        // 페이지의 JS 컨텍스트
      func: fetchHtml,      // 이 함수가 탭 안에서 실행됨
      args: [url]
    })
  → 탭 내부에서 fetch 실행 (origin: https://www.swmaestro.ai)
  → same-origin 요청 → 쿠키 정상 전송
  → HTML 문자열을 사이드패널로 반환
  → 사이드패널에서 DOMParser로 파싱
```

### 3.2 왜 이게 가능한가

`chrome.scripting.executeScript`의 `world: 'MAIN'` 옵션은 함수를 **탭 페이지의 메인 JavaScript 실행 컨텍스트**에서 실행한다. 이 컨텍스트의 origin은 탭의 URL origin(`https://www.swmaestro.ai`)이므로, 여기서 같은 도메인으로 fetch하면 **first-party same-origin 요청**이 된다.

- `credentials: 'same-origin'` (기본값)으로 충분
- third-party cookie 정책과 무관하게 동작
- CORS 제약 없음

### 3.3 필요한 권한

- `manifest.json`에 `"scripting"` 권한 추가
- `host_permissions`에 `https://swmaestro.ai/*`, `https://www.swmaestro.ai/*` (기존에 있었음)

### 3.4 origin 동적 감지 (부가 조치)

fetch URL의 origin을 하드코딩하지 않고, 탭의 실제 URL에서 추출하도록 변경:

```typescript
const tabs = await chrome.tabs.query({
  url: ['https://swmaestro.ai/*', 'https://www.swmaestro.ai/*'],
})
const origin = new URL(tabs[0].url).origin  // https://www.swmaestro.ai
const url = origin + '/sw/mypage/userAnswer/history.do?...'
```

이렇게 하면 탭의 origin과 fetch URL의 origin이 항상 일치하여 same-origin이 보장된다.

---

## 4. www vs non-www 쿠키 — 참고 지식

원래 문제의 근본 원인은 아니었지만, origin 동적화를 한 이유이기도 하므로 정리한다.

### 4.1 쿠키 Domain 속성의 동작

| 서버가 Set-Cookie한 방식 | 쿠키가 전송되는 대상 |
|---|---|
| `Domain=swmaestro.ai` | `swmaestro.ai` + `www.swmaestro.ai` + 모든 서브도메인 |
| `Domain=www.swmaestro.ai` | `www.swmaestro.ai`만 (상위 도메인 제외) |
| Domain 속성 생략 (host-only) | Set-Cookie를 내린 **정확한 호스트**만 |

### 4.2 "상위 도메인으로 설정하면 해결됐던 문제 아닌가?"

**아니다.** 두 가지 이유:

1. **서버를 제어할 수 없다.** swmaestro.ai의 Set-Cookie Domain 설정은 서버 측 구성이며, 확장프로그램에서 변경할 수 없다.

2. **근본 원인이 다르다.** www 일치 여부와 무관하게, `chrome-extension://` origin에서 `swmaestro.ai`로의 fetch 자체가 third-party이므로 쿠키 차단 대상이다. 쿠키 Domain을 아무리 넓게 잡아도 third-party 컨텍스트에서는 차단된다.

---

## 5. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `manifest.json` | `scripting` 권한 추가 |
| `src/sidepanel/store.ts` | `fetchDoc`: 직접 fetch → `chrome.scripting.executeScript` 방식으로 변경 |
| `src/sidepanel/store.ts` | `HISTORY_URL` (전체 URL) → `HISTORY_PATH` (경로만) + 동적 origin |
| `src/sidepanel/store.ts` | `findTab()` + `getTabOrigin()` 헬퍼 추가, 탭 캐싱 |
| `src/sidepanel/store.ts` | 에러 메시지 분기: `NO_TAB` → "페이지를 열어주세요" |

---

## 6. 하드코딩 수정 완료

`ListView.tsx`, `TimetableView.tsx`의 상세보기 하이퍼링크를 `https://swmaestro.ai` 고정에서 `tabOrigin` 동적 사용으로 수정했다.

- `store.ts`에 `tabOrigin` state 추가 (초기값 `https://www.swmaestro.ai`)
- `fetchAll()` 실행 시 탭 실제 origin으로 업데이트
- www/non-www 불문하고 탭과 동일한 origin으로 링크 생성 → 세션 쿠키 정상 전달

---

# Fix History — 신청 완료 직후 자동 갱신 실패 해결

> 2026-04-10 · Feature "신청 완료 직후 시간표 자동 갱신" 구현 과정에서 발견한 두 가지 문제

---

## 7. 증상

특강 상세 페이지에서 신청 버튼 클릭 → `alert` 확인 → `location.reload()` 후 사이드패널이 자동 갱신되어야 하는데 아무 반응 없음. 초기 구현은 content-script의 isolated world에서 `XMLHttpRequest.prototype.open`을 패치해 `apply.json` 응답을 감지하려 했다.

---

## 8. 원인 1: isolated world에서 페이지 XHR에 접근 불가

### 8.1 문제
크롬 확장의 content script는 기본적으로 **isolated world**에서 실행된다. 이 world는 페이지의 DOM은 공유하지만 **JavaScript 실행 컨텍스트(객체·프로토타입)는 별도**이다. 따라서 isolated world에서 `XMLHttpRequest.prototype`을 패치해도 페이지가 사용하는 `XMLHttpRequest`는 전혀 영향받지 않는다.

페이지의 `$.post('/sw/mypage/mentoLec/apply.json', ...)`는 페이지 컨텍스트의 XHR을 쓰기 때문에 이벤트 리스너가 한 번도 발화하지 않았다.

### 8.2 해결: MAIN world content script + CustomEvent 브릿지

별도 파일(`src/content/xhr-hook.ts`)을 만들고 manifest에서 `world: 'MAIN'`으로 지정해 **페이지의 실제 XHR 프로토타입**을 패치한다. MAIN world는 `chrome.runtime`에 직접 접근할 수 없으므로, 감지 결과를 `window.dispatchEvent(new CustomEvent(...))`로 쏘고, 기존 content-script(isolated)가 이를 `window.addEventListener`로 수신해 background에 `APPLY_COMPLETE`를 보낸다.

```
MAIN world (xhr-hook.ts)      isolated world (content-script.ts)      background (service-worker.ts)
  apply.json load
  → dispatchEvent         →    addEventListener
                                chrome.runtime.sendMessage          →  APPLY_COMPLETE 수신
```

`manifest.json`의 content_scripts에 MAIN world 엔트리 추가, `run_at: 'document_start'`로 페이지 스크립트보다 먼저 실행되도록 한다.

---

## 9. 원인 2: `location.reload()`와 `fetchAll`의 타이밍 race

### 9.1 문제
`APPLY_COMPLETE` 수신 직후 바로 `HISTORY_PAGE_DETECTED`를 broadcast해서 사이드패널 `fetchAll()`을 트리거했는데 `FETCH_FAILED`가 떴다. 로그상 origin은 정상(`https://www.swmaestro.ai`)이었다.

원인: `apply.json` 성공 콜백에서 페이지가 `location.reload()`를 호출하므로, `fetchAll()`의 첫 `chrome.scripting.executeScript({ world: 'MAIN', ... })`는 **네비게이션 중인 탭**에 주입을 시도한다. 이 경우 주입이 실패하고 `results[0].result`가 `undefined`가 되어 `fetchDoc`이 `FETCH_FAILED`를 던진다.

### 9.2 해결: background에서 탭 reload 완료 대기 후 broadcast

`APPLY_COMPLETE` 수신 시 즉시 broadcast하지 않고 `chrome.tabs.onUpdated`로 해당 탭의 `status === 'complete'`를 기다렸다가 broadcast한다. 안전망으로 5초 타임아웃을 걸어두어 어떤 이유로든 reload 이벤트가 오지 않아도 결국 broadcast가 실행되도록 한다.

```typescript
if (message.type === 'APPLY_COMPLETE' && sender.tab?.id) {
  const tabId = sender.tab.id
  const broadcast = () => { chrome.runtime.sendMessage({ type: 'HISTORY_PAGE_DETECTED', payload: null }).catch(() => {}) }
  let timeoutId: ReturnType<typeof setTimeout>
  const waitForReload = (updatedTabId: number, changeInfo: { status?: string }) => {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      clearTimeout(timeoutId)
      chrome.tabs.onUpdated.removeListener(waitForReload)
      broadcast()
    }
  }
  timeoutId = setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(waitForReload)
    broadcast()
  }, 5000)
  chrome.tabs.onUpdated.addListener(waitForReload)
  return
}
```

---

## 10. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `manifest.json` | MAIN world content_script 엔트리 추가 (`xhr-hook.ts`) |
| `src/content/xhr-hook.ts` | 신규 — 페이지 XHR 패치 + CustomEvent dispatch |
| `src/content/content-script.ts` | 상세 페이지에서 `__mentorytime_apply_complete__` 이벤트 수신 → `APPLY_COMPLETE` 전송 |
| `src/background/service-worker.ts` | `APPLY_COMPLETE` 핸들러: 탭 reload 대기 후 `HISTORY_PAGE_DETECTED` broadcast |
