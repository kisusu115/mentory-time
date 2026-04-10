export interface LectureEntry {
  no: number
  category: string
  title: string
  detailUrl: string
  qustnrSn: string
  author: string
  lectureDate: string        // "2026-04-24"
  lectureStartTime: string   // "14:00:00"
  lectureEndTime: string     // "16:00:00"
  registDate: string         // "2026-04-07"
  status: '접수완료' | '접수취소'
  approval: string
}

export interface NormalizedEntry extends LectureEntry {
  lectureDateObj: Date
  startMinutes: number       // 14:00 → 840
  endMinutes: number         // 16:00 → 960
  dayOfWeek: number          // 0(일)~6(토)
  weekKey: string            // "2026-W15"
}

export interface DetailInfo {
  qustnrSn: string
  title: string
  lectureDate: string        // "2026-04-07"
  lectureStartTime: string   // "19:00"
  lectureEndTime: string     // "22:00"
  author: string
  location: string           // "온라인(Webex)", "스페이스 M1" 등
}

export interface StorageSchema {
  entries: NormalizedEntry[]
  lastFetched: number
  totalPages: number
  settings: {
    hideCancel: boolean
  }
}
