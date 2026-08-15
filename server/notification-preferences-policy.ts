export function validateQuietHours(input: { enabled: boolean; start?: number | null; end?: number | null }) {
  if (!input.enabled) return { valid: true, start: null, end: null } as const;
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end) || input.start! < 0 || input.start! > 23 || input.end! < 0 || input.end! > 23 || input.start === input.end) return { valid: false, start: null, end: null } as const;
  return { valid: true, start: input.start!, end: input.end! } as const;
}
