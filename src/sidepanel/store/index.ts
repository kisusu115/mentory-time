import { create } from "zustand";
import {
  loadStorage,
  loadAllLectures,
  saveAllLectures,
} from "../../lib/storage";
import { createHistorySlice, type HistorySlice } from "./slices/history";
import {
  createAllLecturesSlice,
  type AllLecturesSlice,
} from "./slices/all-lectures";
import { createAuthSlice, type AuthSlice } from "./slices/auth";

interface SharedSlice {
  tabOrigin: string;
  loadCache: () => Promise<void>;
}

export type StoreState = HistorySlice &
  AllLecturesSlice &
  AuthSlice &
  SharedSlice;

export const useStore = create<StoreState>()((...a) => ({
  tabOrigin: "https://www.swmaestro.ai",

  ...createHistorySlice(...a),
  ...createAllLecturesSlice(...a),
  ...createAuthSlice(...a),

  loadCache: async () => {
    const [set] = a;
    const cached = await loadStorage();
    if (cached) {
      // cancelId 필드가 없는 구버전 캐시면 무효화 (자동 re-fetch 유도)
      const needsMigration =
        cached.entries.length > 0 && !("cancelId" in cached.entries[0]);
      if (needsMigration) {
        await chrome.storage.local.remove([
          "entries",
          "lastFetched",
          "totalPages",
        ]);
      } else {
        const entries = cached.entries.map((e) => ({
          ...e,
          lectureDateObj: new Date(e.lectureDate),
          cancelId: e.cancelId ?? null,
        }));
        set({ entries, lastFetched: cached.lastFetched });
      }
    }
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
}));
