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
  saveAllLectures,
  loadAllLectures,
} from "../lib/storage";
import type {
  NormalizedEntry,
  NormalizedListEntry,
  DetailInfo,
} from "../lib/types";

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
  pendingQustnrSn: string | null;
  previewEntry: DetailInfo | null;
  tabOrigin: string;
  locationCache: Record<string, string>;
  allLectures: NormalizedListEntry[];
  allLecturesLoading: boolean;
  allLecturesProgress: { current: number; total: number } | null;
  allLecturesError: string | null;
  allLecturesLastFetched: number | null;
  toggleHideCancel: () => void;
  loadCache: () => Promise<void>;
  fetchAll: () => Promise<void>;
  fetchAllLectures: () => Promise<void>;
  /** 특정 날짜의 강의만 실시간으로 다시 fetch하여 allLectures를 갱신 */
  refreshDayLectures: (date: string) => Promise<void>;
  setPendingDetail: (qustnrSn: string | null) => void;
  clearPreview: () => void;
  /** 시뮬레이션 활성화. 이미 접수완료면 true 반환, 아니면 fetch+파싱 후 previewEntry 설정 */
  activatePreview: (qustnrSn: string) => Promise<boolean>;
  /** 상세 페이지에서 장소 정보를 fetch해 locationCache에 저장 (이미 있으면 skip) */
  fetchLocation: (qustnrSn: string) => Promise<void>;
  /** 사이드패널 내에서 로그인 수행 */
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
  pendingQustnrSn: null,
  previewEntry: null,
  tabOrigin: "https://www.swmaestro.ai",
  locationCache: {},
  allLectures: [],
  allLecturesLoading: false,
  allLecturesProgress: null,
  allLecturesError: null,
  allLecturesLastFetched: null,
  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),
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

  loadCache: async () => {
    const cached = await loadStorage();
    if (cached) {
      const entries = cached.entries.map((e) => ({
        ...e,
        lectureDateObj: new Date(e.lectureDate),
      }));
      set({ entries, lastFetched: cached.lastFetched });
    }
    const cachedLectures = await loadAllLectures();
    if (cachedLectures) {
      const age = Date.now() - cachedLectures.allLecturesLastFetched;
      if (age > 24 * 60 * 60 * 1000) {
        // 24시간 경과 → 캐시 무효화
        await chrome.storage.local.remove([
          "allLectures",
          "allLecturesLastFetched",
          "allLecturesTotalPages",
        ]);
      } else {
        const allLectures = cachedLectures.allLectures.map((e) => ({
          ...e,
          lectureDateObj: new Date(e.lectureDate),
        }));
        set({
          allLectures,
          allLecturesLastFetched: cachedLectures.allLecturesLastFetched,
        });
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

      allEntries.sort((a, b) => {
        const dateDiff =
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
      });

      await saveEntries(allEntries, totalPages);
      set({
        entries: allEntries,
        loading: false,
        progress: null,
        lastFetched: Date.now(),
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "NO_TAB"
          ? "SW마에스트로 페이지를 브라우저에서 열어주세요."
          : "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
      set({ loading: false, error: msg });
    }
  },

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

      allEntries.sort((a, b) => {
        const dateDiff =
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
      });

      await saveAllLectures(allEntries, totalPages);
      set({
        allLectures: allEntries,
        allLecturesLoading: false,
        allLecturesProgress: null,
        allLecturesLastFetched: Date.now(),
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "NO_TAB"
          ? "SW마에스트로 페이지를 브라우저에서 열어주세요."
          : "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
      set({ allLecturesLoading: false, allLecturesError: msg });
    }
  },

  refreshDayLectures: async (date: string) => {
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

      dayEntries.sort((a, b) => {
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
      });

      // 기존 allLectures에서 해당 날짜를 교체
      const prev = get().allLectures.filter((e) => e.lectureDate !== date);
      const merged = [...prev, ...dayEntries].sort((a, b) => {
        const dateDiff =
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
      });

      await saveAllLectures(merged, merged.length);
      set({
        allLectures: merged,
        allLecturesLoading: false,
        allLecturesProgress: null,
        allLecturesLastFetched: Date.now(),
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "NO_TAB"
          ? "SW마에스트로 페이지를 브라우저에서 열어주세요."
          : "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
      set({ allLecturesLoading: false, allLecturesError: msg });
    }
  },

  login: async (username, password) => {
    try {
      // 기존 탭이 있으면 재사용, 없으면 백그라운드에 생성 (닫지 않음 — 세션 유지 필요)
      let tabId: number;
      let origin: string;
      let isNewTab = false;
      try {
        const existing = await findTab();
        tabId = existing.tabId;
        origin = existing.origin;
      } catch {
        const newTab = await chrome.tabs.create({
          url: "https://www.swmaestro.ai/sw/member/user/forLogin.do?menuNo=200025",
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

      // 1. 탭을 로그인 페이지로 이동 (백그라운드 유지)
      if (!isNewTab) {
        await chrome.tabs.update(tabId, {
          url: `${origin}/sw/member/user/forLogin.do?menuNo=200025`,
        });
        await waitForTabComplete(tabId);
      }

      // 2. 탭 MAIN world에서 로그인 폼에 값 채우고 submit
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

      // 3. 폼 submit → toLogin → login.do → 리다이렉트 완료 대기
      await waitForTabComplete(tabId);
      // toLogin 응답이 JS auto-submit이면 한 번 더 대기
      await waitForTabComplete(tabId);

      // 4. 로그인 성공 여부 확인
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
}));

async function fetchHtml(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

let cachedTab: { tabId: number; origin: string } | null = null;

async function findTab(): Promise<{ tabId: number; origin: string }> {
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

async function getTabOrigin(): Promise<string> {
  return (await findTab()).origin;
}

function waitForTabComplete(tabId: number): Promise<void> {
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
