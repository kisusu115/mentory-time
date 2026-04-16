import type {
  LectureEntry,
  NormalizedEntry,
  DetailInfo,
  LectureListEntry,
  NormalizedListEntry,
  LectureListStatus,
} from "./types";

// ── 접수내역 페이지 파싱 ──────────────────────────────────────────────────

export function parseHistoryPage(doc: Document): LectureEntry[] {
  const rows = doc.querySelectorAll(".boardlist .tbl-ovx table tbody tr");
  const entries: LectureEntry[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return;

    const anchor = cells[2].querySelector("a");
    if (!anchor) return;

    const detailUrl = anchor.getAttribute("href") ?? "";
    const qustnrSn = extractQustnrSn(detailUrl);
    const { lectureDate, lectureStartTime, lectureEndTime } =
      parseLectureDateTime(cells[4]);
    const registDate = cells[5].textContent?.trim().split("\n")[0].trim() ?? "";
    const statusText = cells[6].textContent?.trim() ?? "";

    // 비고 열에서 cancelId 추출: delDate('41777','9954','mentoLec')
    const cancelCell = cells[9];
    const cancelLink = cancelCell?.querySelector('a[href*="delDate"]');
    const cancelMatch = cancelLink
      ?.getAttribute("href")
      ?.match(/delDate\('(\d+)'/);
    const cancelId = cancelMatch ? cancelMatch[1] : null;

    entries.push({
      no: parseInt(cells[0].textContent?.trim() ?? "0", 10),
      category: cells[1].textContent?.trim() ?? "",
      title: anchor.textContent?.trim() ?? "",
      detailUrl,
      qustnrSn,
      author: cells[3].textContent?.trim() ?? "",
      lectureDate,
      lectureStartTime,
      lectureEndTime,
      registDate,
      status: statusText.includes("취소") ? "접수취소" : "접수완료",
      approval: cells[7].textContent?.trim() ?? "",
      cancelId,
    });
  });

  return entries;
}

export function isLoginPage(doc: Document): boolean {
  // 비로그인 시 SW마에스트로는 로그인 페이지로 리디렉트 (HTTP 200)
  // 로그인 페이지에는 password 입력창이 있고, 접수내역 컨테이너가 없음
  return (
    doc.querySelector('input[type="password"]') !== null ||
    doc.querySelector(".boardlist") === null
  );
}

export function parseTotalPages(doc: Document): number {
  const endPageLink = doc.querySelector(".paginationSet .end a");
  if (endPageLink) {
    const endPage = parseInt(
      endPageLink.getAttribute("data-endpage") ?? "1",
      10,
    );
    if (!isNaN(endPage)) return endPage;
  }

  // 폴백: Total 수에서 계산
  const totalText =
    doc
      .querySelector(".bbs-total li strong")
      ?.nextSibling?.textContent?.trim() ??
    doc.querySelector(".bbs-total li")?.textContent?.trim() ??
    "";
  const totalMatch = totalText.match(/\d+/);
  if (totalMatch) return Math.ceil(parseInt(totalMatch[0], 10) / 10);

  return 1;
}

// ── 강의날짜/시간 파싱 ────────────────────────────────────────────────────

function parseLectureDateTime(cell: Element): {
  lectureDate: string;
  lectureStartTime: string;
  lectureEndTime: string;
} {
  const text = cell.textContent ?? "";
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\(.\)/);
  const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})\s*~\s*(\d{2}:\d{2}:\d{2})/);

  return {
    lectureDate: dateMatch ? dateMatch[1] : "",
    lectureStartTime: timeMatch ? timeMatch[1] : "",
    lectureEndTime: timeMatch ? timeMatch[2] : "",
  };
}

function extractQustnrSn(url: string): string {
  const match = url.match(/qustnrSn=(\d+)/);
  return match ? match[1] : "";
}

// ── 상세 페이지 파싱 (F6) ─────────────────────────────────────────────────

export function parseDetailPage(
  doc: Document,
  qustnrSn: string,
): DetailInfo | null {
  const eventDtEl = doc.querySelector(".eventDt");
  if (!eventDtEl) return null;

  const rawDate = eventDtEl.textContent?.trim() ?? "";
  const lectureDate = rawDate.replace(/\./g, "-").replace(/-$/, ""); // "2026.04.07" → "2026-04-07"

  const timeDiv = eventDtEl.parentElement;
  const timeText = timeDiv?.textContent ?? "";
  const timeMatch = timeText.match(/(\d{2}:\d{2})시\s*~\s*(\d{2}:\d{2})시/);

  const titleEl = doc.querySelector(".bbs-view-new .top > .group .c");
  const halfWs = doc.querySelectorAll(".bbs-view-new .top .half_w");
  const authorEl = halfWs[3]?.querySelector(".group .c");

  let location = "";
  const allGroups = doc.querySelectorAll(".bbs-view-new .top .group");
  for (const group of allGroups) {
    if (group.querySelector(".t")?.textContent?.trim() === "장소") {
      location = group.querySelector(".c")?.textContent?.trim() ?? "";
      break;
    }
  }

  return {
    qustnrSn,
    title: titleEl?.textContent?.trim() ?? "",
    lectureDate,
    lectureStartTime: timeMatch ? timeMatch[1] : "",
    lectureEndTime: timeMatch ? timeMatch[2] : "",
    author: authorEl?.textContent?.trim() ?? "",
    location,
  };
}

// ── 강의 목록 페이지 파싱 ─────────────────────────────────────────────────

export function parseLectureListPage(doc: Document): LectureListEntry[] {
  const rows = doc.querySelectorAll(".boardlist table tbody tr");
  const entries: LectureListEntry[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 9) return;

    const titleCell = cells[1];
    const anchor = titleCell.querySelector("a");
    if (!anchor) return;

    const detailUrl = anchor.getAttribute("href") ?? "";
    const qustnrSn = extractQustnrSn(detailUrl);
    const rawTitle = anchor.textContent?.trim() ?? "";

    // 카테고리 추출: [멘토 특강] 또는 [자유 멘토링]
    const categoryMatch = rawTitle.match(/\[(멘토\s*특강|자유\s*멘토링)\]\s*/);
    const category = categoryMatch ? categoryMatch[1].replace(/\s+/g, "") : "";
    const title = categoryMatch
      ? rawTitle.slice(categoryMatch[0].length)
      : rawTitle;

    // 진행날짜 (cells[3]): "2026-05-04(월)\n 15:00  ~ 17:00"
    const { lectureDate, lectureStartTime, lectureEndTime } =
      parseLectureListDateTime(cells[3]);

    // 모집인원 (cells[4]): "1 /8"
    const enrollText = cells[4].textContent?.trim() ?? "";
    const enrollMatch = enrollText.match(/(\d+)\s*\/\s*(\d+)/);
    const enrollCurrent = enrollMatch ? parseInt(enrollMatch[1], 10) : 0;
    const enrollMax = enrollMatch ? parseInt(enrollMatch[2], 10) : 0;

    // 상태 (cells[6])
    const statusText = cells[6].textContent?.trim() ?? "";
    const status = parseListStatus(statusText);

    entries.push({
      no: parseInt(cells[0].textContent?.trim() ?? "0", 10),
      category,
      title,
      detailUrl,
      qustnrSn,
      author: cells[7].textContent?.trim() ?? "",
      lectureDate,
      lectureStartTime,
      lectureEndTime,
      registDate: cells[8].textContent?.trim() ?? "",
      enrollCurrent,
      enrollMax,
      status,
      approval: cells[5].textContent?.trim() ?? "",
    });
  });

  return entries;
}

function parseLectureListDateTime(cell: Element): {
  lectureDate: string;
  lectureStartTime: string;
  lectureEndTime: string;
} {
  const text = cell.textContent ?? "";
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\(.\)/);
  const timeMatch = text.match(/(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/);

  return {
    lectureDate: dateMatch ? dateMatch[1] : "",
    lectureStartTime: timeMatch ? timeMatch[1] : "",
    lectureEndTime: timeMatch ? timeMatch[2] : "",
  };
}

function parseListStatus(text: string): LectureListStatus {
  if (text.includes("접수중")) return "접수중";
  if (text.includes("대기")) return "대기";
  return "마감";
}

export function parseLectureListTotalPages(doc: Document): number {
  const endPageLink = doc.querySelector(".paginationSet .end a");
  if (endPageLink) {
    const href = endPageLink.getAttribute("href") ?? "";
    const match = href.match(/pageIndex=(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  // 폴백: Total 수에서 계산
  const totalEl = doc.querySelector(".bbs-total li");
  const totalText = totalEl?.textContent ?? "";
  const totalMatch = totalText.match(/\d+/);
  if (totalMatch) return Math.ceil(parseInt(totalMatch[0], 10) / 10);

  return 1;
}

export function normalizeListEntry(
  entry: LectureListEntry,
): NormalizedListEntry {
  const d = new Date(entry.lectureDate);
  const [sh, sm] = entry.lectureStartTime.split(":").map(Number);
  const [eh, em] = entry.lectureEndTime.split(":").map(Number);

  const dayOfWeek = d.getDay();

  // ISO week key
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = Math.floor((d.getTime() - startOfWeek.getTime()) / 86400000);
  const weekNum = Math.floor(diff / 7) + 1;
  const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  return {
    ...entry,
    lectureDateObj: d,
    startMinutes: (sh || 0) * 60 + (sm || 0),
    endMinutes: (eh || 0) * 60 + (em || 0),
    dayOfWeek,
    weekKey,
  };
}

// ── 정규화 ────────────────────────────────────────────────────────────────

export function normalizeEntry(entry: LectureEntry): NormalizedEntry {
  const lectureDateObj = new Date(entry.lectureDate);
  const startMinutes = timeToMinutes(entry.lectureStartTime);
  const endMinutes = timeToMinutes(entry.lectureEndTime);
  const dayOfWeek = lectureDateObj.getDay();
  const weekKey = toWeekKey(lectureDateObj);

  return {
    ...entry,
    lectureDateObj,
    startMinutes,
    endMinutes,
    dayOfWeek,
    weekKey,
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
