import { create } from "zustand";
import {
  parseHistoryPage,
  parseTotalPages,
  normalizeEntry,
  parseDetailPage,
  isLoginPage,
  parseLectureListPage,
  parseLectureListTotalPages,
  normalizeListEntry,
} from "../lib/parser";
import {
  saveEntries,
  loadStorage,
  loadAllLectures,
  saveAllLectures,
  updateSettings,
  loadSettings,
  loadNotionSettings,
  saveNotionSettings as persistNotionSettings,
  loadNotionAddedSet,
  markAsNotionAdded,
  clearNotionData as clearNotionStorage,
  loadGcalAddedSet,
  markAsGcalAdded as persistGcalAdded,
  loadGcalConnected,
  saveGcalConnected,
} from "../lib/storage";
import { createNotionPage, NotionApiError } from "../lib/notion";
import {
  getGcalToken,
  fetchGcalEvents as apiFetchGcalEvents,
  revokeGcalToken,
} from "../lib/gcal";
import { loadCredentials } from "../lib/crypto";
import {
  SWMAESTRO_LOGIN_URL,
  SWMAESTRO_URL_PATTERNS,
  compareByDateAndTime,
  compareByTime,
  mapHistoryFetchError,
  mapLectureFetchError,
  isErrorCode,
} from "../lib/swmaestro";
import type {
  NormalizedEntry,
  NormalizedListEntry,
  DetailInfo,
  NotionSettings,
  GcalEvent,
} from "../lib/types";
import type { WeekStartDay } from "../lib/week";

const HISTORY_PATH =
  "/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=";
const LECTURE_LIST_PATH =
  "/sw/mypage/mentoLec/list.do?menuNo=200046&pageIndex=";

interface StoreState {
  entries: NormalizedEntry[];
  loading: boolean;
  progress: { current: number; total: number } | null;
  error: string | null;
  lastFetched: number | null;
  hideCancel: boolean;
  weekStartDay: WeekStartDay;
  recentHours: number;
  pendingQustnrSn: string | null;
  previewEntry: DetailInfo | null;
  tabOrigin: string;
  locationCache: Record<string, string>;
  toggleHideCancel: () => void;
  toggleWeekStartDay: () => void;
  setRecentHours: (hours: number) => void;
  loadCache: () => Promise<void>;
  fetchAll: () => Promise<void>;
  setPendingDetail: (qustnrSn: string | null) => void;
  clearPreview: () => void;
  /** 시뮬레이션 활성화. 이미 접수완료면 true 반환, 아니면 fetch+파싱 후 previewEntry 설정 */
  activatePreview: (qustnrSn: string) => Promise<boolean>;
  /** 상세 페이지에서 장소 정보를 fetch해 locationCache에 저장 (이미 있으면 skip) */
  fetchLocation: (qustnrSn: string) => Promise<void>;
  gcalAddedSet: Set<string>;
  markGcalAdded: (qustnrSn: string) => Promise<void>;
  notionSettings: NotionSettings | null;
  notionAddedSet: Set<string>;
  notionBusy: string | null;
  notionError: string | null;
  loadNotionState: () => Promise<void>;
  saveNotionSettings: (settings: NotionSettings) => Promise<void>;
  clearNotionData: () => Promise<void>;
  addToNotion: (entry: NormalizedEntry) => Promise<void>;
  gcalConnected: boolean;
  gcalEvents: GcalEvent[];
  gcalOverlay: boolean;
  gcalLoading: boolean;
  gcalError: string | null;
  loadGcalState: () => Promise<void>;
  connectGcal: () => Promise<void>;
  disconnectGcal: () => Promise<void>;
  toggleGcalOverlay: () => void;
  fetchGcalEvents: (weekStart: Date) => Promise<void>;
  // allLectures (전체 강의)
  allLectures: NormalizedListEntry[];
  allLecturesLoading: boolean;
  allLecturesProgress: { current: number; total: number } | null;
  allLecturesError: string | null;
  allLecturesFetchedPerDay: Record<string, number>;
  fetchAllLectures: () => Promise<void>;
  refreshDayLectures: (date: string) => Promise<void>;
  retryFetchAll: () => Promise<void>;
  retryRefreshDayLectures: (date: string) => Promise<void>;
  // auth (로그인)
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error: string | null }>;
}

export const useStore = create<StoreState>((set, get) => ({
  entries: [],
  loading: false,
  progress: null,
  error: null,
  lastFetched: null,
  hideCancel: true,
  weekStartDay: 0,
  recentHours: 3,
  pendingQustnrSn: null,
  previewEntry: null,
  tabOrigin: "https://www.swmaestro.ai",
  locationCache: {},
  gcalAddedSet: new Set<string>(),
  markGcalAdded: async (qustnrSn) => {
    await persistGcalAdded(qustnrSn);
    set((s) => {
      const next = new Set(s.gcalAddedSet);
      next.add(qustnrSn);
      return { gcalAddedSet: next };
    });
  },
  notionSettings: null,
  notionAddedSet: new Set<string>(),
  notionBusy: null,
  notionError: null,
  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),
  toggleWeekStartDay: () => {
    const next: WeekStartDay = get().weekStartDay === 1 ? 0 : 1;
    set({ weekStartDay: next });
    void updateSettings({ weekStartDay: next });
  },
  setRecentHours: (hours: number) => {
    set({ recentHours: hours });
    void updateSettings({ recentHours: hours });
  },
  setPendingDetail: (qustnrSn) => set({ pendingQustnrSn: qustnrSn }),
  clearPreview: () => set({ previewEntry: null }),
  activatePreview: async (qustnrSn) => {
    if (
      get().entries.some(
        (e) => e.qustnrSn === qustnrSn && e.status === "접수완료",
      )
    ) {
      return true;
    }
    try {
      const origin = await getTabOrigin();
      const url = `${origin}/sw/mypage/mentoLec/view.do?qustnrSn=${qustnrSn}&menuNo=200046&pageIndex=1`;
      const doc = await fetchDoc(url);
      const info = parseDetailPage(doc, qustnrSn);
      if (info) {
        set((s) => ({
          previewEntry: info,
          locationCache: { ...s.locationCache, [qustnrSn]: info.location },
        }));
      }
    } catch {
      /* 실패 시 무시 */
    }
    return false;
  },

  fetchLocation: async (qustnrSn) => {
    if (get().locationCache[qustnrSn] !== undefined) return;
    try {
      const origin = await getTabOrigin();
      const url = `${origin}/sw/mypage/mentoLec/view.do?qustnrSn=${qustnrSn}&menuNo=200046&pageIndex=1`;
      const doc = await fetchDoc(url);
      const info = parseDetailPage(doc, qustnrSn);
      set((s) => ({
        locationCache: { ...s.locationCache, [qustnrSn]: info?.location ?? "" },
      }));
    } catch {
      set((s) => ({ locationCache: { ...s.locationCache, [qustnrSn]: "" } }));
    }
  },

  gcalConnected: false,
  gcalEvents: [],
  gcalOverlay: false,
  gcalLoading: false,
  gcalError: null,

  loadGcalState: async () => {
    const connected = await loadGcalConnected();
    set({ gcalConnected: connected });
  },

  connectGcal: async () => {
    set({ gcalError: null });
    try {
      await getGcalToken(true);
      await saveGcalConnected(true);
      set({ gcalConnected: true });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "구글 캘린더 연동에 실패했습니다.";
      set({ gcalError: msg });
    }
  },

  disconnectGcal: async () => {
    await revokeGcalToken();
    await saveGcalConnected(false);
    set({
      gcalConnected: false,
      gcalEvents: [],
      gcalOverlay: false,
      gcalError: null,
    });
  },

  toggleGcalOverlay: () => {
    set((s) => ({ gcalOverlay: !s.gcalOverlay }));
  },

  fetchGcalEvents: async (weekStart) => {
    if (!get().gcalConnected) return;
    set({ gcalLoading: true, gcalError: null });
    try {
      let token: string;
      try {
        token = await getGcalToken(false);
      } catch {
        set({
          gcalLoading: false,
          gcalError:
            "구글 캘린더 인증이 만료되었습니다. 설정에서 다시 연동해주세요.",
          gcalConnected: false,
        });
        await saveGcalConnected(false);
        return;
      }
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      try {
        const events = await apiFetchGcalEvents(token, weekStart, weekEnd);
        set({ gcalEvents: events, gcalLoading: false });
      } catch (e) {
        if (e instanceof Error && e.message === "TOKEN_EXPIRED") {
          // 토큰 만료 후 재시도
          const newToken = await getGcalToken(false);
          const events = await apiFetchGcalEvents(newToken, weekStart, weekEnd);
          set({ gcalEvents: events, gcalLoading: false });
        } else {
          throw e;
        }
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "구글 캘린더 이벤트를 불러오지 못했습니다.";
      set({ gcalLoading: false, gcalError: msg });
    }
  },

  loadNotionState: async () => {
    const [ns, addedSet] = await Promise.all([
      loadNotionSettings(),
      loadNotionAddedSet(),
    ]);
    set({ notionSettings: ns, notionAddedSet: addedSet });
  },

  saveNotionSettings: async (settings) => {
    await persistNotionSettings(settings);
    set({ notionSettings: settings });
  },

  clearNotionData: async () => {
    await clearNotionStorage();
    set({ notionSettings: null, notionAddedSet: new Set<string>() });
  },

  addToNotion: async (entry) => {
    const { notionSettings, locationCache, fetchLocation, tabOrigin } = get();
    if (!notionSettings) return;
    set({ notionBusy: entry.qustnrSn, notionError: null });
    try {
      if (locationCache[entry.qustnrSn] === undefined) {
        await fetchLocation(entry.qustnrSn);
      }
      const location = get().locationCache[entry.qustnrSn] ?? "";
      const pageUrl = await createNotionPage(
        entry,
        location,
        tabOrigin,
        notionSettings,
      );
      await markAsNotionAdded(entry.qustnrSn);
      set((s) => {
        const next = new Set(s.notionAddedSet);
        next.add(entry.qustnrSn);
        return { notionAddedSet: next, notionBusy: null };
      });
      chrome.tabs.create({ url: pageUrl });
    } catch (e) {
      const msg =
        e instanceof NotionApiError
          ? e.toUserMessage()
          : "Notion 추가에 실패했습니다.";
      set({ notionBusy: null, notionError: msg });
    }
  },

  // ── allLectures (전체 강의) ──────────────────────────
  allLectures: [],
  allLecturesLoading: false,
  allLecturesProgress: null,
  allLecturesError: null,
  allLecturesFetchedPerDay: {},

  fetchAllLectures: async () => {
    set({
      allLecturesLoading: true,
      allLecturesError: null,
      allLecturesProgress: null,
    });
    try {
      const origin = await getTabOrigin();
      set({ tabOrigin: origin });
      const page1Doc = await fetchDoc(origin + LECTURE_LIST_PATH + "1");
      if (isLoginPage(page1Doc)) {
        set({
          allLecturesLoading: false,
          allLecturesError:
            "SW마에스트로에 로그인되어 있지 않아요. 로그인 후 다시 시도해주세요.",
        });
        return;
      }
      const totalPages = parseLectureListTotalPages(page1Doc);
      const allEntries = parseLectureListPage(page1Doc).map(normalizeListEntry);
      set({ allLecturesProgress: { current: 1, total: totalPages } });

      for (let page = 2; page <= totalPages; page++) {
        const doc = await fetchDoc(origin + LECTURE_LIST_PATH + page);
        allEntries.push(...parseLectureListPage(doc).map(normalizeListEntry));
        set({ allLecturesProgress: { current: page, total: totalPages } });
      }

      allEntries.sort(compareByDateAndTime);

      const now = Date.now();
      const fetchedPerDay: Record<string, number> = {};
      for (const e of allEntries) {
        fetchedPerDay[e.lectureDate] = now;
      }
      await saveAllLectures(allEntries, fetchedPerDay, totalPages);
      set({
        allLectures: allEntries,
        allLecturesLoading: false,
        allLecturesProgress: null,
        allLecturesFetchedPerDay: fetchedPerDay,
      });
    } catch (e) {
      set({
        allLecturesLoading: false,
        allLecturesError: mapLectureFetchError(e),
      });
    }
  },

  refreshDayLectures: async (date) => {
    set({
      allLecturesLoading: true,
      allLecturesError: null,
      allLecturesProgress: null,
    });
    try {
      const origin = await getTabOrigin();
      set({ tabOrigin: origin });
      const dayPath = `/sw/mypage/mentoLec/list.do?menuNo=200046&scdate=${date}&ecdate=${date}&pageIndex=`;
      const page1Doc = await fetchDoc(origin + dayPath + "1");
      if (isLoginPage(page1Doc)) {
        set({
          allLecturesLoading: false,
          allLecturesError:
            "SW마에스트로에 로그인되어 있지 않아요. 로그인 후 다시 시도해주세요.",
        });
        return;
      }
      const totalPages = parseLectureListTotalPages(page1Doc);
      const dayEntries = parseLectureListPage(page1Doc).map(normalizeListEntry);
      set({ allLecturesProgress: { current: 1, total: totalPages } });

      for (let page = 2; page <= totalPages; page++) {
        const doc = await fetchDoc(origin + dayPath + page);
        dayEntries.push(...parseLectureListPage(doc).map(normalizeListEntry));
        set({ allLecturesProgress: { current: page, total: totalPages } });
      }

      dayEntries.sort(compareByTime);

      const prev = get().allLectures.filter((e) => e.lectureDate !== date);
      const merged = [...prev, ...dayEntries].sort(compareByDateAndTime);

      const updatedPerDay = {
        ...get().allLecturesFetchedPerDay,
        [date]: Date.now(),
      };
      await saveAllLectures(merged, updatedPerDay, merged.length);
      set({
        allLectures: merged,
        allLecturesLoading: false,
        allLecturesProgress: null,
        allLecturesFetchedPerDay: updatedPerDay,
      });
    } catch (e) {
      set({
        allLecturesLoading: false,
        allLecturesError: mapLectureFetchError(e),
      });
    }
  },

  retryFetchAll: async () => {
    try {
      await ensureSwmaestroTabAndTryAutoLogin(get);
      await get().fetchAll();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const error =
        raw.includes("이메일 또는 비밀번호") || raw.includes("로그인 폼")
          ? raw
          : mapHistoryFetchError(e);
      set({ loading: false, progress: null, error });
    }
  },

  retryRefreshDayLectures: async (date) => {
    try {
      await ensureSwmaestroTabAndTryAutoLogin(get);
      await get().refreshDayLectures(date);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const error =
        raw.includes("이메일 또는 비밀번호") || raw.includes("로그인 폼")
          ? raw
          : mapLectureFetchError(e);
      set({
        allLecturesLoading: false,
        allLecturesProgress: null,
        allLecturesError: error,
      });
    }
  },

  // ── auth (로그인) ──────────────────────────
  login: async (username, password) => {
    try {
      let tabId: number;
      let origin: string;
      let isNewTab = false;
      try {
        const existing = await findTab();
        tabId = existing.tabId;
        origin = existing.origin;
      } catch {
        const newTab = await chrome.tabs.create({
          url: SWMAESTRO_LOGIN_URL,
          active: false,
        });
        if (!newTab.id)
          return { success: false, error: "탭을 생성할 수 없습니다." };
        isNewTab = true;
        tabId = newTab.id;
        origin = "https://www.swmaestro.ai";
        cachedTab = { tabId, origin };
        await waitForTabComplete(tabId);
      }

      if (!isNewTab) {
        await chrome.tabs.update(tabId, {
          url: SWMAESTRO_LOGIN_URL,
        });
        await waitForTabComplete(tabId);
      }

      const submitResult = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (user: string, pass: string) => {
          const form =
            document.querySelector<HTMLFormElement>(
              'form[action*="toLogin"]',
            ) ?? document.querySelector<HTMLFormElement>("form");
          if (!form) return "NO_FORM";
          const usernameInput = form.querySelector<HTMLInputElement>(
            'input[name="username"]',
          );
          const passwordInput = form.querySelector<HTMLInputElement>(
            'input[name="password"]',
          );
          if (!usernameInput || !passwordInput) return "NO_INPUTS";
          usernameInput.value = user;
          passwordInput.value = pass;
          form.submit();
          return "SUBMITTED";
        },
        args: [username, password],
      });

      const status = submitResult[0]?.result;
      if (status !== "SUBMITTED") {
        return { success: false, error: "로그인 폼을 찾을 수 없습니다." };
      }

      await waitForTabComplete(tabId);
      await waitForTabComplete(tabId);

      const checkDoc = await fetchDoc(
        `${origin}/sw/mypage/mentoLec/list.do?menuNo=200046&pageIndex=1`,
      );
      const success = !isLoginPage(checkDoc);

      if (!success) {
        return {
          success: false,
          error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        };
      }

      set({ error: null, allLecturesError: null });
      return { success: true, error: null };
    } catch {
      return { success: false, error: "로그인 중 오류가 발생했습니다." };
    }
  },

  // ── loadCache ──────────────────────────
  loadCache: async () => {
    const [cached, settings, gcalAdded] = await Promise.all([
      loadStorage(),
      loadSettings(),
      loadGcalAddedSet(),
    ]);
    set({
      hideCancel: settings.hideCancel,
      weekStartDay: settings.weekStartDay,
      recentHours: settings.recentHours,
      gcalAddedSet: gcalAdded,
    });
    if (cached) {
      const entries = cached.entries.map((e) => ({
        ...e,
        lectureDateObj: new Date(e.lectureDate),
      }));
      set({ entries, lastFetched: cached.lastFetched });
    }
    // allLectures 캐시 복원
    const cachedLectures = await loadAllLectures();
    if (cachedLectures) {
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000;
      const fetchedPerDay = cachedLectures.allLecturesFetchedPerDay;
      const freshEntries = cachedLectures.allLectures
        .filter((e) => {
          const fetched = fetchedPerDay[e.lectureDate];
          return fetched !== undefined && now - fetched < TTL;
        })
        .map((e) => ({ ...e, lectureDateObj: new Date(e.lectureDate) }));
      const freshPerDay: Record<string, number> = {};
      for (const [date, ts] of Object.entries(fetchedPerDay)) {
        if (now - ts < TTL) freshPerDay[date] = ts;
      }
      if (freshEntries.length > 0) {
        set({
          allLectures: freshEntries,
          allLecturesFetchedPerDay: freshPerDay,
        });
      }
      if (freshEntries.length < cachedLectures.allLectures.length) {
        await saveAllLectures(freshEntries, freshPerDay, freshEntries.length);
      }
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null, progress: null });
    try {
      const origin = await getTabOrigin();
      set({ tabOrigin: origin });
      const page1Doc = await fetchDoc(origin + HISTORY_PATH + "1");
      if (isLoginPage(page1Doc)) {
        set({
          loading: false,
          error:
            "SW마에스트로에 로그인되어 있지 않아요. 로그인 후 다시 시도해주세요.",
        });
        return;
      }
      const totalPages = parseTotalPages(page1Doc);
      const allEntries = parseHistoryPage(page1Doc).map(normalizeEntry);

      set({ progress: { current: 1, total: totalPages } });

      for (let page = 2; page <= totalPages; page++) {
        const doc = await fetchDoc(origin + HISTORY_PATH + page);
        allEntries.push(...parseHistoryPage(doc).map(normalizeEntry));
        set({ progress: { current: page, total: totalPages } });
      }

      allEntries.sort(
        (a, b) =>
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime() ||
          a.startMinutes - b.startMinutes,
      );

      await saveEntries(allEntries, totalPages);
      set({
        entries: allEntries,
        loading: false,
        progress: null,
        lastFetched: Date.now(),
      });
    } catch (e) {
      set({ loading: false, error: mapHistoryFetchError(e) });
    }
  },
}));

async function fetchHtml(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

let cachedTab: { tabId: number; origin: string } | null = null;

async function waitForTabComplete(
  tabId: number,
  timeoutMs = 5000,
): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;

  return new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("TAB_NOT_READY"));
    }, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function findTab(): Promise<{ tabId: number; origin: string }> {
  if (cachedTab) {
    try {
      const tab = await chrome.tabs.get(cachedTab.tabId);
      if (tab.url?.startsWith(cachedTab.origin)) {
        if (tab.status !== "complete")
          await waitForTabComplete(cachedTab.tabId);
        return cachedTab;
      }
    } catch {
      /* 탭 닫힘 */
    }
  }
  const tabs = await chrome.tabs.query({
    url: [...SWMAESTRO_URL_PATTERNS],
  });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) throw new Error("NO_TAB");
  if (tab.status !== "complete") await waitForTabComplete(tab.id);
  const origin = new URL(tab.url).origin;
  cachedTab = { tabId: tab.id, origin };
  return cachedTab;
}

async function getTabOrigin(): Promise<string> {
  return (await findTab()).origin;
}

async function fetchDoc(url: string): Promise<Document> {
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

async function openSwmaestroTabFromBackground(): Promise<void> {
  const loginUrl = SWMAESTRO_LOGIN_URL;
  try {
    const res = await chrome.runtime.sendMessage({
      type: "OPEN_SWMAESTRO_TAB",
      payload: { url: loginUrl },
    });
    if (!res?.ok) {
      throw new Error("TAB_CREATE_FAILED");
    }
  } catch {
    await chrome.tabs.create({ url: loginUrl, active: false });
  }
}

async function ensureSwmaestroTabAndTryAutoLogin(
  get: () => StoreState,
): Promise<void> {
  try {
    await findTab();
  } catch (e) {
    if (!isErrorCode(e, "NO_TAB")) throw e;
    await openSwmaestroTabFromBackground();
    // 탭 생성 직후 query 결과 반영이 늦을 수 있어 짧은 재시도
    for (let i = 0; i < 5; i++) {
      try {
        await findTab();
        break;
      } catch {
        if (i === 4) throw new Error("NO_TAB");
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  const origin = await getTabOrigin();
  const checkDoc = await fetchDocWithRetry(`${origin}${LECTURE_LIST_PATH}1`);
  if (!isLoginPage(checkDoc)) return;

  const credentials = await loadCredentials();
  if (!credentials) return;

  const loginResult = await get().login(
    credentials.username,
    credentials.password,
  );
  if (!loginResult.success) {
    throw new Error(loginResult.error ?? "AUTO_LOGIN_FAILED");
  }
}

async function fetchDocWithRetry(
  url: string,
  maxAttempts = 4,
): Promise<Document> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchDoc(url);
    } catch (e) {
      lastError = e;
      if (!isErrorCode(e, "FETCH_FAILED") && !isErrorCode(e, "TAB_NOT_READY")) {
        throw e;
      }
      if (attempt === maxAttempts) break;
      await delay(200 * attempt);
    }
  }
  throw lastError ?? new Error("FETCH_FAILED");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
