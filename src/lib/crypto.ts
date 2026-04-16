const SALT = "mentory-time-v1";
const STORAGE_KEY = "encryptedCredentials";

async function deriveKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(chrome.runtime.id + SALT),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function saveCredentials(
  username: string,
  password: string,
): Promise<void> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ username, password }));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  const payload = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: payload });
}

export async function loadCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const payload = result[STORAGE_KEY] as
    | { iv: number[]; data: number[] }
    | undefined;
  if (!payload) return null;
  try {
    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
      key,
      new Uint8Array(payload.data),
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
