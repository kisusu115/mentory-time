import type { StateCreator } from "zustand";
import {
  isLoginPage,
  parseLectureListPage,
  parseLectureListTotalPages,
  normalizeListEntry,
} from "../../../lib/parser";
import { saveAllLectures } from "../../../lib/storage";
import type { NormalizedListEntry } from "../../../lib/types";
import { getTabOrigin, fetchDoc } from "../tab-helper";
import type { StoreState } from "../index";

const LECTURE_LIST_PATH =
  "/sw/mypage/mentoLec/list.do?menuNo=200046&pageIndex=";

export interface AllLecturesSlice {
  allLectures: NormalizedListEntry[];
  allLecturesLoading: boolean;
  allLecturesProgress: { current: number; total: number } | null;
  allLecturesError: string | null;
  allLecturesFetchedPerDay: Record<string, number>;
  fetchAllLectures: () => Promise<void>;
  refreshDayLectures: (date: string) => Promise<void>;
}

export const createAllLecturesSlice: StateCreator<
  StoreState,
  [],
  [],
  AllLecturesSlice
> = (set, get) => ({
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

      allEntries.sort((a, b) => {
        const dateDiff =
          a.lectureDateObj.getTime() - b.lectureDateObj.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
      });

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
      const msg =
        e instanceof Error && e.message === "NO_TAB"
          ? "SW마에스트로 페이지를 브라우저에서 열어주세요."
          : "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
      set({ allLecturesLoading: false, allLecturesError: msg });
    }
  },
});
