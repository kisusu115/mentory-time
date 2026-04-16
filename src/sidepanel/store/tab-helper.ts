async function fetchHtml(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

let cachedTab: { tabId: number; origin: string } | null = null;

export function setCachedTab(
  tab: {
    tabId: number;
    origin: string;
  } | null,
): void {
  cachedTab = tab;
}

export async function findTab(): Promise<{
  tabId: number;
  origin: string;
}> {
  if (cachedTab) {
    try {
      const tab = await chrome.tabs.get(cachedTab.tabId);
      if (tab.url?.startsWith(cachedTab.origin)) return cachedTab;
    } catch {
      /* 탭 닫힘 */
    }
  }
  const tabs = await chrome.tabs.query({
    url: ["https://swmaestro.ai/*", "https://www.swmaestro.ai/*"],
  });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) throw new Error("NO_TAB");
  const origin = new URL(tab.url).origin;
  cachedTab = { tabId: tab.id, origin };
  return cachedTab;
}

export async function getTabOrigin(): Promise<string> {
  return (await findTab()).origin;
}

export function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export async function fetchDoc(url: string): Promise<Document> {
  const { tabId } = await findTab();

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: fetchHtml,
    args: [url],
  });

  const html = results[0]?.result;
  if (typeof html !== "string") throw new Error("FETCH_FAILED");
  return new DOMParser().parseFromString(html, "text/html");
}
