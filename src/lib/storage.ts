import type {
  NormalizedEntry,
  StorageSchema,
  NormalizedListEntry,
  AllLecturesStorageSchema,
} from "./types";

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
