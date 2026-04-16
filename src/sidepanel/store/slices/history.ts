import type { StateCreator } from "zustand";
import {
  parseHistoryPage,
  parseTotalPages,
  normalizeEntry,
  parseDetailPage,
  isLoginPage,
} from "../../../lib/parser";
import { saveEntries } from "../../../lib/storage";
import type { NormalizedEntry, DetailInfo } from "../../../lib/types";
import { getTabOrigin, fetchDoc, findTab } from "../tab-helper";
import type { StoreState } from "../index";

const HISTORY_PATH =
  "/sw/mypage/userAnswer/history.do?menuNo=200047&pageIndex=";

export interface HistorySlice {
  entries: NormalizedEntry[];
  loading: boolean;
  progress: { current: number; total: number } | null;
  error: string | null;
  lastFetched: number | null;
  hideCancel: boolean;
  pendingQustnrSn: string | null;
  previewEntry: DetailInfo | null;
  locationCache: Record<string, string>;
  toggleHideCancel: () => void;
  fetchAll: () => Promise<void>;
  cancelRegistration: (
    cancelId: string,
    qustnrSn: string,
  ) => Promise<{ success: boolean; message: string }>;
  setPendingDetail: (qustnrSn: string | null) => void;
  clearPreview: () => void;
  activatePreview: (qustnrSn: string) => Promise<boolean>;
  fetchLocation: (qustnrSn: string) => Promise<void>;
}

export const createHistorySlice: StateCreator<
  StoreState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  entries: [],
  loading: false,
  progress: null,
  error: null,
  lastFetched: null,
  hideCancel: true,
  pendingQustnrSn: null,
  previewEntry: null,
  locationCache: {},

  toggleHideCancel: () => set((s) => ({ hideCancel: !s.hideCancel })),

  cancelRegistration: async (cancelId, qustnrSn) => {
    try {
      const { tabId } = await findTab();
      const origin = await getTabOrigin();
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async (url: string, body: string) => {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
            body,
          });
          return res.json();
        },
        args: [
          `${origin}/sw/mypage/userAnswer/cancel.json`,
          `id=${cancelId}&qustnrSn=${qustnrSn}&gubun=mentoLec`,
        ],
      });
      const data = result[0]?.result as
        | { resultCode?: string; cancelAt?: string }
        | undefined;
      if (data?.resultCode === "success") {
        if (data.cancelAt === "Y") {
          // 목록 자동 갱신
          await get().fetchAll();
          return { success: true, message: "접수를 취소했습니다." };
        }
        return {
          success: false,
          message: "강의날짜 하루 전날부터는 취소가 불가능합니다.",
        };
      }
      return { success: false, message: "취소에 실패했습니다." };
    } catch {
      return { success: false, message: "취소 중 오류가 발생했습니다." };
    }
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
        locationCache: {
          ...s.locationCache,
          [qustnrSn]: info?.location ?? "",
        },
      }));
    } catch {
      set((s) => ({ locationCache: { ...s.locationCache, [qustnrSn]: "" } }));
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
});
