import { useState, useEffect } from 'react'
import { useStore } from './store'
import { fetchDatabaseSchema, validateMapping, EXPECTED_TYPES } from '../lib/notion'
import type { NotionProperty, NotionPropertyMapping } from '../lib/types'

/** Notion 타입 → 사용자용 한국어 라벨 */
const TYPE_LABELS: Record<string, string> = {
  title: '제목 속성',
  rich_text: '텍스트 속성',
  date: '날짜 속성',
  select: '선택 속성',
  multi_select: '다중 선택 속성',
  url: 'URL 속성',
}

function typePlaceholder(types: readonly string[]): string {
  const labels = types.map((t) => TYPE_LABELS[t] ?? t)
  return `매핑 안 함 — ${labels.join(' 또는 ')} 선택`
}

/** 매핑 필드 정의: label, key, 호환 타입은 EXPECTED_TYPES에서 참조 */
const MAPPING_FIELDS: { label: string; key: keyof NotionPropertyMapping; required?: boolean }[] = [
  { label: '특강 제목', key: 'title', required: true },
  { label: '멘토 이름', key: 'author' },
  { label: '특강 일시', key: 'date' },
  { label: '특강 구분', key: 'category' },
  { label: '접수 상태', key: 'status' },
  { label: '상세 링크', key: 'detailUrl' },
  { label: '장소', key: 'location' },
]

interface Props {
  onBack: () => void
}

export default function NotionSettingsView({ onBack }: Props) {
  const { notionSettings, saveNotionSettings, clearNotionData } = useStore()

  const [token, setToken] = useState(notionSettings?.token ?? '')
  const [databaseId, setDatabaseId] = useState(notionSettings?.databaseId ?? '')
  const [schema, setSchema] = useState<NotionProperty[]>([])
  const [mapping, setMapping] = useState<NotionPropertyMapping>(
    notionSettings?.mapping ?? { title: '' },
  )
  const [fetchingSchema, setFetchingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // 설정이 있으면 자동으로 스키마 불러오기
  useEffect(() => {
    if (notionSettings?.token && notionSettings?.databaseId) {
      void handleFetchSchema(notionSettings.token, notionSettings.databaseId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFetchSchema(t?: string, dbId?: string) {
    const useToken = t ?? token
    const useDbId = dbId ?? databaseId
    if (!useToken || !useDbId) {
      setSchemaError('토큰과 데이터베이스 ID를 입력하세요.')
      return
    }
    setFetchingSchema(true)
    setSchemaError(null)
    try {
      const props = await fetchDatabaseSchema(useToken, useDbId)
      setSchema(props)
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : 'DB 속성 불러오기 실패')
    } finally {
      setFetchingSchema(false)
    }
  }

  /** Notion URL에서 데이터베이스 ID를 추출. URL이 아니면 원본 반환 */
  function extractDatabaseId(input: string): string {
    const trimmed = input.trim()
    // notion.so/{workspace}/{id}?v=... 또는 notion.so/{id}?v=... 패턴
    const match = trimmed.match(/notion\.so\/(?:[^/]+\/)?([a-f0-9]{32})(?:\?|$)/)
    if (match) return match[1]
    // 하이픈 포함 UUID 형식: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)
    if (uuidMatch) return uuidMatch[1].replace(/-/g, '')
    return trimmed
  }

  function updateMapping(key: keyof NotionPropertyMapping, value: string) {
    setMapping((prev) => {
      if (key === 'title') return { ...prev, title: value }
      if (!value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  function handleSave() {
    if (!token || !databaseId) {
      setSaveMsg('토큰과 데이터베이스 ID를 입력하세요.')
      return
    }
    if (!mapping.title) {
      setSaveMsg('제목 매핑은 필수입니다.')
      return
    }
    if (schema.length > 0) {
      const errors = validateMapping(schema, mapping)
      if (errors.length > 0) {
        setSaveMsg(`매핑 타입 불일치: ${errors.map((e) => `${e.field}(기대: ${e.expected}, 실제: ${e.actual})`).join(', ')}`)
        return
      }
    }
    void saveNotionSettings({ token, databaseId, mapping })
    setSaveMsg('저장되었습니다.')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  /** 호환되는 속성만 필터 */
  function compatibleProps(types: readonly string[]): NotionProperty[] {
    return schema.filter((p) => types.includes(p.type))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
          title="뒤로 가기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-bold text-gray-700">Notion 연동 설정</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 연동 가이드 — 설정 저장 전에만 표시 */}
        {!notionSettings && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-bold text-blue-700">Notion DB 연동 방법</p>
            <ol className="text-[11px] text-blue-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Notion에서 새 데이터베이스(표)를 만드세요.</li>
              <li><a href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 font-semibold">notion.so/profile/integrations</a>에서 내부 통합을 생성하고 API 토큰을 복사하세요. (반드시 DB 워크스페이스 주인 계정으로 진행)</li>
              <li>데이터베이스 페이지에서 <strong>&middot;&middot;&middot;</strong> → <strong>연결</strong> → 생성한 통합을 추가하세요.</li>
              <li>데이터베이스 URL 또는 ID를 아래에 붙여넣으세요.<br />
                <span className="text-[10px] text-blue-400">notion.so/<strong>데이터베이스ID</strong>?v=...</span>
              </li>
              <li>아래에 토큰과 ID를 입력 후 &quot;DB 속성 불러오기&quot;를 눌러 연결하세요.</li>
            </ol>
          </div>
        )}

        {/* 토큰 */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">API 토큰</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ntn_..."
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* DB ID */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">데이터베이스 ID</label>
          <input
            type="text"
            value={databaseId}
            onChange={(e) => setDatabaseId(extractDatabaseId(e.target.value))}
            placeholder="URL 또는 ID 붙여넣기"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* DB 속성 불러오기 */}
        <button
          onClick={() => handleFetchSchema()}
          disabled={fetchingSchema}
          className="w-full py-1.5 text-xs font-semibold text-brand-600 border border-brand-300 rounded-md hover:bg-brand-50 disabled:opacity-40 transition-colors"
        >
          {fetchingSchema ? 'DB 속성 불러오는 중...' : 'DB 속성 불러오기'}
        </button>

        {schemaError && <p className="text-[11px] text-red-500">{schemaError}</p>}

        {/* 속성 매핑 */}
        {schema.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-gray-600 border-t border-gray-100 pt-3">속성 매핑</div>
            {MAPPING_FIELDS.map(({ label, key, required }) => {
              const options = compatibleProps(EXPECTED_TYPES[key])
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 w-20 shrink-0">
                    {label}{required && <span className="text-red-400">*</span>}
                  </span>
                  <select
                    value={(mapping[key] as string) ?? ''}
                    onChange={(e) => updateMapping(key, e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-brand-500 bg-white"
                  >
                    <option value="">({typePlaceholder(EXPECTED_TYPES[key])})</option>
                    {options.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {/* 저장 */}
        <button
          onClick={handleSave}
          className="w-full py-2 text-xs font-bold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors"
        >
          저장
        </button>

        {saveMsg && (
          <p className={`text-[11px] text-center ${saveMsg === '저장되었습니다.' ? 'text-green-600' : 'text-red-500'}`}>
            {saveMsg}
          </p>
        )}

        {/* 연결 초기화 */}
        {notionSettings && (
          <button
            onClick={() => {
              if (!confirm('노션 연결 설정과 추가 기록이 모두 삭제됩니다. 초기화하시겠습니까?')) return
              void clearNotionData()
              setToken('')
              setDatabaseId('')
              setSchema([])
              setMapping({ title: '' })
              setSaveMsg(null)
            }}
            className="w-full py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
          >
            연결 초기화
          </button>
        )}
      </div>
    </div>
  )
}
