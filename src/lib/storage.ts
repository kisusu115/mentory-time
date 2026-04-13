import type { NormalizedEntry, NotionSettings, StorageSchema } from './types'

export async function saveEntries(
  entries: NormalizedEntry[],
  totalPages: number,
): Promise<void> {
  await chrome.storage.local.set({
    entries,
    lastFetched: Date.now(),
    totalPages,
  } satisfies Omit<StorageSchema, 'settings'>)
}

export async function loadStorage(): Promise<Omit<StorageSchema, 'settings'> | null> {
  const result = await chrome.storage.local.get(['entries', 'lastFetched', 'totalPages'])
  if (!result['entries']) return null
  return result as Omit<StorageSchema, 'settings'>
}

export async function loadSettings(): Promise<StorageSchema['settings']> {
  const result = await chrome.storage.local.get('settings')
  const saved = result['settings'] as Partial<StorageSchema['settings']> | undefined
  return { hideCancel: true, weekStartDay: 0, ...saved }
}

export async function updateSettings(
  patch: Partial<StorageSchema['settings']>,
): Promise<void> {
  const current = await loadSettings()
  await chrome.storage.local.set({ settings: { ...current, ...patch } })
}

export async function loadNotionSettings(): Promise<NotionSettings | null> {
  const result = await chrome.storage.local.get('notionSettings')
  return (result['notionSettings'] as NotionSettings) ?? null
}

export async function saveNotionSettings(settings: NotionSettings): Promise<void> {
  await chrome.storage.local.set({ notionSettings: settings })
}

export async function loadNotionAddedSet(): Promise<Set<string>> {
  const result = await chrome.storage.local.get('notionAddedSet')
  const arr = (result['notionAddedSet'] as string[] | undefined) ?? []
  return new Set(arr)
}

export async function clearNotionData(): Promise<void> {
  await chrome.storage.local.remove(['notionSettings', 'notionAddedSet'])
}

export async function markAsNotionAdded(qustnrSn: string): Promise<void> {
  const set = await loadNotionAddedSet()
  set.add(qustnrSn)
  await chrome.storage.local.set({ notionAddedSet: [...set] })
}
