export interface LectureEntry {
  no: number;
  category: string;
  title: string;
  detailUrl: string;
  qustnrSn: string;
  author: string;
  lectureDate: string; // "2026-04-24"
  lectureStartTime: string; // "14:00:00"
  lectureEndTime: string; // "16:00:00"
  registDate: string; // "2026-04-07"
  status: "접수완료" | "접수취소";
  approval: string;
  cancelId: string | null; // delDate 첫 번째 인자, null이면 취소 불가
}

export interface NormalizedEntry extends LectureEntry {
  lectureDateObj: Date;
  startMinutes: number; // 14:00 → 840
  endMinutes: number; // 16:00 → 960
  dayOfWeek: number; // 0(일)~6(토)
  weekKey: string; // "2026-W15"
}

export interface DetailInfo {
  qustnrSn: string;
  title: string;
  lectureDate: string; // "2026-04-07"
  lectureStartTime: string; // "19:00"
  lectureEndTime: string; // "22:00"
  author: string;
  location: string; // "온라인(Webex)", "스페이스 M1" 등
}

export type LectureListStatus = "접수중" | "마감" | "대기";

export interface LectureListEntry {
  no: number;
  category: string; // "멘토특강" | "자유멘토링"
  title: string;
  detailUrl: string;
  qustnrSn: string;
  author: string;
  lectureDate: string; // "2026-05-04"
  lectureStartTime: string; // "15:00"
  lectureEndTime: string; // "17:00"
  registDate: string;
  enrollCurrent: number; // 현재 접수인원
  enrollMax: number; // 최대 모집인원
  status: LectureListStatus;
  approval: string;
}

export interface NormalizedListEntry extends LectureListEntry {
  lectureDateObj: Date;
  startMinutes: number;
  endMinutes: number;
  dayOfWeek: number;
  weekKey: string;
}

export interface StorageSchema {
  entries: NormalizedEntry[];
  lastFetched: number;
  totalPages: number;
  settings: {
    hideCancel: boolean;
  };
}

export interface AllLecturesStorageSchema {
  allLectures: NormalizedListEntry[];
  allLecturesFetchedPerDay: Record<string, number>;
  allLecturesTotalPages: number;
}
