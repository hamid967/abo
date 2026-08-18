import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { claimExpoGoOAuthAttempt, createExpoGoOAuthAttempt, failExpoGoOAuthAttempt, getUserByOpenId, markExpoGoOAuthAttemptReady, recordLoginSecurityEvent, removeExpoGoOAuthAttempt, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

const EXPO_GO_ATTEMPT_TTL_MS = 10 * 60 * 1000;

function hashProof(proof: string) {
  return createHash("sha256").update(proof).digest("hex");
}

function isTrustedManusHost(host: string) {
  const normalized = host.toLowerCase().replace(/:\d+$/, "");
  return normalized.endsWith(".manus.computer") || normalized.endsWith(".manus.space");
}

function getExpoGoCallbackUrl(req: Request, attemptId: string) {
  const host = req.get("host") ?? "";
  if (!isTrustedManusHost(host)) throw new Error("Untrusted OAuth callback host");
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" ? "https" : req.protocol;
  if (protocol !== "https") throw new Error("Expo Go OAuth requires an HTTPS callback");
  return `${protocol}://${host}/api/oauth/expo-go/callback?attempt=${encodeURIComponent(attemptId)}`;
}

function getNativeCallbackUrl(req: Request, attemptId: string) {
  const host = req.get("host") ?? "";
  if (!isTrustedManusHost(host)) throw new Error("Untrusted OAuth callback host");
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" ? "https" : req.protocol;
  if (protocol !== "https") throw new Error("Native OAuth requires an HTTPS callback");
  return `${protocol}://${host}/api/oauth/native/callback?attempt=${encodeURIComponent(attemptId)}`;
}

function encodeOAuthState(redirectUri: string) {
  return Buffer.from(redirectUri, "utf-8").toString("base64");
}

export function decodeExpoGoCallbackState(state: string) {
  try {
    const redirectUri = Buffer.from(state, "base64").toString("utf-8");
    const url = new URL(redirectUri);
    if (!isTrustedManusHost(url.host) || url.protocol !== "https:" || url.pathname !== "/api/oauth/expo-go/callback") return undefined;
    const attemptId = url.searchParams.get("attempt");
    if (!attemptId || !/^[a-f0-9-]{36}$/i.test(attemptId)) return undefined;
    return { attemptId, redirectUri };
  } catch {
    return undefined;
  }
}

function decodeNativeCallbackState(state: string) {
  try {
    const redirectUri = Buffer.from(state, "base64").toString("utf-8");
    const url = new URL(redirectUri);
    if (!isTrustedManusHost(url.host) || url.protocol !== "https:" || url.pathname !== "/api/oauth/native/callback") return undefined;
    const attemptId = url.searchParams.get("attempt");
    if (!attemptId || !/^[a-f0-9-]{36}$/i.test(attemptId)) return undefined;
    return { attemptId, redirectUri };
  } catch {
    return undefined;
  }
}

function getNativeLoginUrl(redirectUri: string) {
  if (!ENV.oAuthPortalUrl || !ENV.appId) throw new Error("Native OAuth configuration is unavailable");
  const url = new URL(`${ENV.oAuthPortalUrl.replace(/\/$/, "")}/app-auth`);
  url.searchParams.set("appId", ENV.appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", encodeOAuthState(redirectUri));
  url.searchParams.set("type", "signIn");
  return url.toString();
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/oauth/native/attempt", async (req: Request, res: Response) => {
    try {
      const id = randomUUID();
      const proof = randomBytes(32).toString("base64url");
      const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId.slice(0, 128) : undefined;
      const platform = typeof req.body?.platform === "string" ? req.body.platform.slice(0, 32) : "native";
      const redirectUri = getNativeCallbackUrl(req, id);
      const callbackState = encodeOAuthState(redirectUri);
      await createExpoGoOAuthAttempt({ id, proofHash: hashProof(proof), callbackState, expiresAt: new Date(Date.now() + EXPO_GO_ATTEMPT_TTL_MS), deviceId, platform });
      res.status(201).json({ attemptId: id, proof, loginUrl: getNativeLoginUrl(redirectUri) });
    } catch (error) {
      console.error("[OAuth] Failed to create native attempt", error);
      res.status(500).json({ error: "Unable to start mobile sign-in" });
    }
  });

  app.get("/api/oauth/native/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).type("html").send("<main><h1>تعذر إكمال تسجيل الدخول</h1><p>أعد المحاولة من تطبيق أبو مشعل.</p></main>");
      return;
    }
    const callback = decodeNativeCallbackState(state);
    if (!callback) {
      res.status(400).type("html").send("<main><h1>رابط عودة غير صالح</h1></main>");
      return;
    }
    try {
      const stored = await markExpoGoOAuthAttemptReady({ id: callback.attemptId, callbackState: state, authorizationCode: code });
      if (!stored) {
        res.status(410).type("html").send("<main><h1>انتهت جلسة تسجيل الدخول</h1><p>ارجع إلى التطبيق وابدأ المحاولة مرة أخرى.</p></main>");
        return;
      }
      res.redirect(302, `abumishaal://oauth/callback?attempt=${encodeURIComponent(callback.attemptId)}`);
    } catch (error) {
      console.error("[OAuth] Native callback failed", error);
      res.status(500).type("html").send("<main><h1>تعذر حفظ نتيجة تسجيل الدخول</h1><p>ارجع إلى التطبيق وأعد المحاولة.</p></main>");
    }
  });

  app.get("/api/oauth/native/complete", async (req: Request, res: Response) => {
    const attemptId = getQueryParam(req, "attemptId");
    const proof = getQueryParam(req, "proof");
    if (!attemptId || !proof) {
      res.status(400).json({ error: "attemptId and proof are required" });
      return;
    }
    try {
      const attempt = await claimExpoGoOAuthAttempt({ id: attemptId, proofHash: hashProof(proof) });
      if (!attempt) {
        res.status(202).json({ status: "pending" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(attempt.authorizationCode!, attempt.callbackState);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, { name: userInfo.name || "", expiresInMs: ONE_YEAR_MS });
      const userId = (user as { id?: number }).id;
      if (typeof userId === "number") await recordLoginSecurityEvent({ userId, deviceId: attempt.deviceId, platform: attempt.platform, req });
      await removeExpoGoOAuthAttempt(attemptId);
      res.json({ status: "completed", app_session_id: sessionToken, user: buildUserResponse(user) });
    } catch (error) {
      if (attemptId) await failExpoGoOAuthAttempt(attemptId).catch(() => undefined);
      console.error("[OAuth] Native completion failed", error);
      res.status(500).json({ error: "Unable to complete mobile sign-in" });
    }
  });

  app.post("/api/oauth/expo-go/attempt", async (req: Request, res: Response) => {
    try {
      const id = randomUUID();
      const proof = randomBytes(32).toString("base64url");
      const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId.slice(0, 128) : undefined;
      const platform = typeof req.body?.platform === "string" ? req.body.platform.slice(0, 32) : undefined;
      const redirectUri = getExpoGoCallbackUrl(req, id);
      const callbackState = encodeOAuthState(redirectUri);
      await createExpoGoOAuthAttempt({ id, proofHash: hashProof(proof), callbackState, expiresAt: new Date(Date.now() + EXPO_GO_ATTEMPT_TTL_MS), deviceId, platform });
      res.status(201).json({ attemptId: id, proof, redirectUri });
    } catch (error) {
      console.error("[OAuth] Failed to create Expo Go attempt", error);
      res.status(500).json({ error: "Unable to start mobile sign-in" });
    }
  });

  app.get("/api/oauth/expo-go/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).type("html").send("<main><h1>تعذر إكمال تسجيل الدخول</h1><p>أعد المحاولة من تطبيق أبو مشعل.</p></main>");
      return;
    }
    const callback = decodeExpoGoCallbackState(state);
    if (!callback) {
      res.status(400).type("html").send("<main><h1>رابط عودة غير صالح</h1></main>");
      return;
    }
    try {
      const stored = await markExpoGoOAuthAttemptReady({ id: callback.attemptId, callbackState: state, authorizationCode: code });
      if (!stored) {
        res.status(410).type("html").send("<main><h1>انتهت جلسة تسجيل الدخول</h1><p>ارجع إلى التطبيق وابدأ المحاولة مرة أخرى.</p></main>");
        return;
      }
      res.status(200).type("html").send("<main dir=\"rtl\" style=\"font-family:system-ui;text-align:center;padding:48px;color:#17382F\"><h1>تم التحقق من الحساب</h1><p>ارجع الآن إلى Expo Go؛ سيكمل أبو مشعل تسجيل الدخول تلقائياً.</p></main>");
    } catch (error) {
      console.error("[OAuth] Expo Go callback failed", error);
      res.status(500).type("html").send("<main><h1>تعذر حفظ نتيجة تسجيل الدخول</h1><p>ارجع إلى التطبيق وأعد المحاولة.</p></main>");
    }
  });

  app.post("/api/oauth/expo-go/complete", async (req: Request, res: Response) => {
    const attemptId = typeof req.body?.attemptId === "string" ? req.body.attemptId : undefined;
    const proof = typeof req.body?.proof === "string" ? req.body.proof : undefined;
    if (
      !attemptId ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(attemptId) ||
      !proof ||
      !/^[A-Za-z0-9_-]{43}$/.test(proof)
    ) {
      res.status(400).json({ error: "A valid attemptId and proof are required" });
      return;
    }
    try {
      const attempt = await claimExpoGoOAuthAttempt({ id: attemptId, proofHash: hashProof(proof) });
      if (!attempt) {
        res.status(202).json({ status: "pending" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(attempt.authorizationCode!, attempt.callbackState);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, { name: userInfo.name || "", expiresInMs: ONE_YEAR_MS });
      const userId = (user as { id?: number }).id;
      if (typeof userId === "number") await recordLoginSecurityEvent({ userId, deviceId: attempt.deviceId, platform: attempt.platform, req });
      await removeExpoGoOAuthAttempt(attemptId);
      res.json({ status: "completed", app_session_id: sessionToken, user: buildUserResponse(user) });
    } catch (error) {
      if (attemptId) await failExpoGoOAuthAttempt(attemptId).catch(() => undefined);
      console.error("[OAuth] Expo Go completion failed", error);
      res.status(500).json({ error: "Unable to complete mobile sign-in" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const userId = (user as { id?: number }).id;
      if (typeof userId === "number") await recordLoginSecurityEvent({ userId, platform: "web", req });
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const userId = (user as { id?: number }).id;
      if (typeof userId === "number") await recordLoginSecurityEvent({ userId, platform: "mobile", req });

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
