import type { NormalizedEntry, NotionProperty, NotionPropertyMapping, NotionSettings } from './types'

const NOTION_VERSION = '2022-06-28'

function notionHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

export class NotionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }

  toUserMessage(): string {
    return this.message
  }
}

async function notionFetch(url: string, token: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { ...notionHeaders(token), ...init?.headers },
  })
  const body = await res.json() as { code?: string; message?: string }
  if (!res.ok) {
    throw new NotionApiError(res.status, body.code ?? 'unknown', body.message ?? res.statusText)
  }
  return body
}

/** DB 스키마 조회 — 속성 목록 반환 */
export async function fetchDatabaseSchema(
  token: string,
  databaseId: string,
): Promise<NotionProperty[]> {
  const body = await notionFetch(
    `https://api.notion.com/v1/databases/${databaseId}`,
    token,
  ) as { properties: Record<string, { id: string; type: string }> }

  return Object.entries(body.properties).map(([name, prop]) => ({
    id: prop.id,
    name,
    type: prop.type,
  }))
}

/** 특강 정보로 Notion 페이지 생성 — 생성된 페이지 URL 반환 */
export async function createNotionPage(
  entry: NormalizedEntry,
  location: string,
  tabOrigin: string,
  settings: NotionSettings,
): Promise<string> {
  const properties: Record<string, unknown> = {}
  const { mapping } = settings

  properties[mapping.title] = { title: [{ text: { content: entry.title } }] }

  if (mapping.author) {
    properties[mapping.author] = { rich_text: [{ text: { content: entry.author } }] }
  }
  if (mapping.date) {
    const start = `${entry.lectureDate}T${entry.lectureStartTime}+09:00`
    const end = `${entry.lectureDate}T${entry.lectureEndTime}+09:00`
    properties[mapping.date] = { date: { start, end } }
  }
  if (mapping.category) {
    properties[mapping.category] = { select: { name: entry.category } }
  }
  if (mapping.status) {
    properties[mapping.status] = { select: { name: entry.status } }
  }
  if (mapping.detailUrl) {
    properties[mapping.detailUrl] = { url: `${tabOrigin}${entry.detailUrl}` }
  }
  if (mapping.location && location) {
    properties[mapping.location] = { rich_text: [{ text: { content: location } }] }
  }

  const result = await notionFetch('https://api.notion.com/v1/pages', settings.token, {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: settings.databaseId },
      properties,
    }),
  }) as { url: string }

  return result.url
}

/** 매핑 필드별 기대 Notion 타입 */
export const EXPECTED_TYPES: Record<keyof NotionPropertyMapping, readonly string[]> = {
  title: ['title'],
  author: ['rich_text'],
  date: ['date'],
  category: ['select', 'multi_select'],
  status: ['select'],
  detailUrl: ['url'],
  location: ['rich_text'],
}

/** DB 스키마와 매핑 설정의 타입 호환 여부를 검증 */
export function validateMapping(
  schema: NotionProperty[],
  mapping: NotionPropertyMapping,
): { field: string; expected: string; actual: string }[] {
  const schemaMap = new Map(schema.map((p) => [p.name, p.type]))
  const errors: { field: string; expected: string; actual: string }[] = []

  for (const [field, propName] of Object.entries(mapping)) {
    if (!propName) continue
    const actual = schemaMap.get(propName)
    if (!actual) continue
    const expected = EXPECTED_TYPES[field as keyof NotionPropertyMapping]
    if (expected && !expected.includes(actual)) {
      errors.push({ field, expected: expected.join(' / '), actual })
    }
  }

  return errors
}
