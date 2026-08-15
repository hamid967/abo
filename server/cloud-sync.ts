export const cloudRecordTypes = ["transactions", "workspace", "inquiries"] as const;
export type CloudRecordType = (typeof cloudRecordTypes)[number];

export function isCloudPayloadWithinLimit(payload: unknown, maxCharacters = 512_000) {
  try {
    const serialized = JSON.stringify(payload);
    return Boolean(serialized) && serialized.length <= maxCharacters;
  } catch {
    return false;
  }
}
