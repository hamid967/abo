import { ENV } from "./_core/env";
import { isVoiceIntakeMimeType, maxVoiceIntakeBytes, voiceIntakeExtension } from "./voice-intake-policy";

type VoiceIntakeResult = { text: string; language: string; duration: number };

export async function transcribeVoiceIntake(input: { audioBase64: string; mimeType: string; language: "ar" | "en" }): Promise<VoiceIntakeResult> {
  if (!isVoiceIntakeMimeType(input.mimeType)) throw new Error("VOICE_FORMAT_NOT_ALLOWED");
  const audio = Buffer.from(input.audioBase64, "base64");
  if (!audio.length || audio.length > maxVoiceIntakeBytes) throw new Error("VOICE_FILE_TOO_LARGE");
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("VOICE_SERVICE_UNAVAILABLE");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(audio)], { type: input.mimeType }), `intake.${voiceIntakeExtension(input.mimeType)}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("prompt", input.language === "ar" ? "حوّل كلام المستخدم إلى نص عربي واضح. لا تضف أو تستنتج أي بيانات غير مسموعة." : "Transcribe the user's spoken words accurately. Do not add or infer information.");
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const response = await fetch(new URL("v1/audio/transcriptions", baseUrl), { method: "POST", headers: { authorization: `Bearer ${ENV.forgeApiKey}`, "Accept-Encoding": "identity" }, body: formData });
  if (!response.ok) throw new Error("VOICE_TRANSCRIPTION_FAILED");
  const payload = await response.json() as { text?: unknown; language?: unknown; duration?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 4000) : "";
  if (!text) throw new Error("VOICE_TRANSCRIPTION_EMPTY");
  return { text, language: typeof payload.language === "string" ? payload.language : input.language, duration: typeof payload.duration === "number" ? payload.duration : 0 };
}
