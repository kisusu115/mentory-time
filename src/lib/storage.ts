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
  totalPages: number,
): Promise<void> {
  await chrome.storage.local.set({
    allLectures,
    allLecturesLastFetched: Date.now(),
    allLecturesTotalPages: totalPages,
  } satisfies AllLecturesStorageSchema);
}

export async function loadAllLectures(): Promise<AllLecturesStorageSchema | null> {
  const result = await chrome.storage.local.get([
    "allLectures",
    "allLecturesLastFetched",
    "allLecturesTotalPages",
  ]);
  if (!result["allLectures"]) return null;
  return result as unknown as AllLecturesStorageSchema;
}
