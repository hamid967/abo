import { describe, expect, it } from "vitest";
import { decodeExpoGoCallbackState } from "../server/_core/oauth";

describe("Expo Go OAuth callback state", () => {
  it("accepts a signed-in callback on a Manus HTTPS domain", () => {
    const id = "f0b99d4e-2d23-4c97-90e9-8d0d71165a17";
    const callback = `https://3000-example.us3.manus.computer/api/oauth/expo-go/callback?attempt=${id}`;
    const state = Buffer.from(callback, "utf8").toString("base64");
    expect(decodeExpoGoCallbackState(state)).toEqual({ attemptId: id, redirectUri: callback });
  });

  it("rejects a callback outside trusted Manus HTTPS domains", () => {
    const callback = "https://example.com/api/oauth/expo-go/callback?attempt=f0b99d4e-2d23-4c97-90e9-8d0d71165a17";
    expect(decodeExpoGoCallbackState(Buffer.from(callback, "utf8").toString("base64"))).toBeUndefined();
  });
});
