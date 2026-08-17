export const voiceIntakeMimeTypes = ["audio/webm", "audio/mp4", "audio/m4a", "audio/mpeg", "audio/wav"] as const;
export const maxVoiceIntakeBytes = 5 * 1024 * 1024;

export function isVoiceIntakeMimeType(value: string): value is (typeof voiceIntakeMimeTypes)[number] {
  return (voiceIntakeMimeTypes as readonly string[]).includes(value);
}

export function voiceIntakeExtension(mimeType: string) {
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  return "m4a";
}
