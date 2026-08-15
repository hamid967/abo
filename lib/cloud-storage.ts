export function getAccountStorageKey(baseKey: string, userId?: number | null) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}
