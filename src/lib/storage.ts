import type { NormalizedEntry, NormalizedListEntry, NotionSettings, StorageSchema, AllLecturesStorageSchema } from './types'

export async function saveEntries(
  entries: NormalizedEntry[],
  totalPages: number,
): Promise<void> {
  await chrome.storage.local.set({
    entries,
    lastFetched: Date.now(),
    totalPages,
  } satisfies Omit<StorageSchema, "settings">);
}

export async function loadStorage(): Promise<Omit<
  StorageSchema,
  "settings"
> | null> {
  const result = await chrome.storage.local.get([
    "entries",
    "lastFetched",
    "totalPages",
  ]);
  if (!result["entries"]) return null;
  return result as Omit<StorageSchema, "settings">;
}

export async function saveAllLectures(
  allLectures: NormalizedListEntry[],
  fetchedPerDay: Record<string, number>,
  totalPages: number,
): Promise<void> {
  await chrome.storage.local.set({
    allLectures,
    allLecturesFetchedPerDay: fetchedPerDay,
    allLecturesTotalPages: totalPages,
  } satisfies AllLecturesStorageSchema);
}

export async function loadAllLectures(): Promise<AllLecturesStorageSchema | null> {
  const result = await chrome.storage.local.get([
    "allLectures",
    "allLecturesFetchedPerDay",
    "allLecturesTotalPages",
  ]);
  if (!result["allLectures"]) return null;
  // 마이그레이션: 기존 allLecturesLastFetched → allLecturesFetchedPerDay
  if (!result["allLecturesFetchedPerDay"]) {
    return null;
  }
  return result as unknown as AllLecturesStorageSchema;
}

export async function loadSettings(): Promise<StorageSchema['settings']> {
  const result = await chrome.storage.local.get('settings')
  const saved = result['settings'] as Partial<StorageSchema['settings']> | undefined
  return { hideCancel: true, weekStartDay: 0, recentHours: 3, ...saved }
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

export async function loadGcalAddedSet(): Promise<Set<string>> {
  const result = await chrome.storage.local.get('gcalAddedSet')
  const arr = (result['gcalAddedSet'] as string[] | undefined) ?? []
  return new Set(arr)
}

export async function markAsGcalAdded(qustnrSn: string): Promise<void> {
  const set = await loadGcalAddedSet()
  set.add(qustnrSn)
  await chrome.storage.local.set({ gcalAddedSet: [...set] })
}

export async function loadGcalConnected(): Promise<boolean> {
  const result = await chrome.storage.local.get('gcalConnected')
  return (result['gcalConnected'] as boolean) ?? false
}

export async function saveGcalConnected(connected: boolean): Promise<void> {
  await chrome.storage.local.set({ gcalConnected: connected })
}
