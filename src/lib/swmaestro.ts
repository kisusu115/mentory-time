export const SWMAESTRO_LOGIN_URL =
  "https://www.swmaestro.ai/sw/member/user/forLogin.do?menuNo=200025";

export const SWMAESTRO_URL_PATTERNS = [
  "https://swmaestro.ai/*",
  "https://www.swmaestro.ai/*",
] as const;

export interface LectureTimeComparable {
  lectureDateObj: Date;
  startMinutes: number;
  endMinutes: number;
}

export interface TimeComparable {
  startMinutes: number;
  endMinutes: number;
}

export function compareByDateAndTime<T extends LectureTimeComparable>(
  a: T,
  b: T,
): number {
  const dateDiff = a.lectureDateObj.getTime() - b.lectureDateObj.getTime();
  if (dateDiff !== 0) return dateDiff;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.endMinutes - b.endMinutes;
}

export function compareByTime<T extends TimeComparable>(a: T, b: T): number {
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.endMinutes - b.endMinutes;
}

export function isErrorCode(e: unknown, code: string): boolean {
  return e instanceof Error && e.message === code;
}

export function mapHistoryFetchError(e: unknown): string {
  if (isErrorCode(e, "NO_TAB")) {
    return "SW마에스트로 페이지를 브라우저에서 열어주세요.";
  }
  if (isErrorCode(e, "TAB_NOT_READY") || isErrorCode(e, "FETCH_FAILED")) {
    return "페이지가 아직 로딩 중이에요. 잠시 후 다시 시도해주세요.";
  }
  return "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
}

export function mapLectureFetchError(e: unknown): string {
  if (isErrorCode(e, "NO_TAB")) {
    return "SW마에스트로 페이지를 브라우저에서 열어주세요.";
  }
  if (isErrorCode(e, "TAB_NOT_READY") || isErrorCode(e, "FETCH_FAILED")) {
    return "페이지가 아직 로딩 중이에요. 잠시 후 다시 시도해주세요.";
  }
  return "데이터를 불러오지 못했어요. SW마에스트로에 로그인되어 있는지 확인해주세요.";
}