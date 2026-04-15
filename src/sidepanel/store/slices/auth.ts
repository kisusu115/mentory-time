import type { StateCreator } from "zustand";
import { isLoginPage } from "../../../lib/parser";
import {
  findTab,
  setCachedTab,
  waitForTabComplete,
  fetchDoc,
} from "../tab-helper";
import type { StoreState } from "../index";

export interface AuthSlice {
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error: string | null }>;
}

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (
  set,
) => ({
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
          url: "https://www.swmaestro.ai/sw/member/user/forLogin.do?menuNo=200025",
          active: false,
        });
        if (!newTab.id)
          return { success: false, error: "탭을 생성할 수 없습니다." };
        isNewTab = true;
        tabId = newTab.id;
        origin = "https://www.swmaestro.ai";
        setCachedTab({ tabId, origin });
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
});
