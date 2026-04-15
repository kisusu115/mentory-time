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

import type { WeekStartDay } from './week'

/** Notion DB 속성 정보 (스키마 조회 결과) */
export interface NotionProperty {
  id: string
  name: string
  type: string  // "title" | "rich_text" | "date" | "select" | "url" | ...
}

/** 사용자의 Notion DB 속성 이름과 NormalizedEntry 필드의 매핑 */
export interface NotionPropertyMapping {
  title: string          // entry.title       → Notion title 속성명 (필수)
  author?: string        // entry.author      → Notion rich_text 속성명
  date?: string          // lectureDate+times → Notion date 속성명
  category?: string      // entry.category    → Notion select 속성명
  status?: string        // entry.status      → Notion select 속성명
  detailUrl?: string     // 상세 링크         → Notion url 속성명
  location?: string      // 장소 정보         → Notion rich_text 속성명
}

export interface NotionSettings {
  token: string
  databaseId: string
  mapping: NotionPropertyMapping
}

export interface StorageSchema {
  entries: NormalizedEntry[]
  lastFetched: number
  totalPages: number
  settings: {
    hideCancel: boolean
    weekStartDay: WeekStartDay
    recentHours: number  // 0.5 ~ 12, 기본값 3
  }
  notionSettings?: NotionSettings
  notionAddedSet?: string[]
  gcalAddedSet?: string[]
}
