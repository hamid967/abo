import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isVoiceIntakeMimeType, maxVoiceIntakeBytes, voiceIntakeExtension } from "../server/voice-intake-policy";

describe("voice transaction intake", () => {
  it("limits temporary voice input to approved audio formats and a bounded size", () => {
    expect(isVoiceIntakeMimeType("audio/m4a")).toBe(true);
    expect(isVoiceIntakeMimeType("audio/webm")).toBe(true);
    expect(isVoiceIntakeMimeType("application/pdf")).toBe(false);
    expect(voiceIntakeExtension("audio/m4a")).toBe("m4a");
    expect(maxVoiceIntakeBytes).toBe(5 * 1024 * 1024);
  });

  it("keeps transcription protected and writes only audit metadata", () => {
    const routers = readFileSync("server/routers.ts", "utf8");
    expect(routers).toContain("transcribeIntake: protectedProcedure");
    expect(routers).toContain("assistant.voice_transcribed");
    expect(routers).toContain("characterCount: result.text.length");
  });

  it("places voice transcription in the composer for user review before sending", () => {
    const screen = readFileSync("app/assistant/request-intake.tsx", "utf8");
    expect(screen).toContain("trpc.voice.transcribeIntake.useMutation");
    expect(screen).toContain("setInput(result.text)");
    expect(screen).toContain("requestRecordingPermissionsAsync");
    expect(screen).toContain("audioFile.delete()");
    expect(screen).toContain("formatRecordingDuration(recorderState.durationMillis)");
    expect(screen).toContain("مدة التسجيل الحالية");
    expect(screen).toContain("async function cancelVoiceInput()");
    expect(screen).toContain("إلغاء التسجيل");
    expect(screen).toContain("new ExpoFile(uri).delete()");
  });
});
