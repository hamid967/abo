type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function checkAssistantRateLimit(input: { userId: number; action: "start" | "message" | "document_summary"; now?: number }) {
  const now = input.now ?? Date.now();
  const windowMs = input.action === "message" ? 15 * 60_000 : 60 * 60_000;
  const limit = input.action === "message" ? 30 : input.action === "document_summary" ? 8 : 12;
  const key = `${input.userId}:${input.action}`;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs);
  if (bucket.hits.length >= limit) return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) } as const;
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 } as const;
}

export function resetAssistantRateLimits() {
  buckets.clear();
}
