export type KnownLoginDevice = {
  id: string;
  networkFingerprint: string;
};

export function classifyLoginSecurity(knownDevices: KnownLoginDevice[], deviceFingerprint: string, networkFingerprint: string) {
  const existing = knownDevices.find((device) => device.id === deviceFingerprint);
  return {
    existing,
    isNewDevice: !existing,
    isUnusualNetwork: knownDevices.length > 0 && !knownDevices.some((device) => device.networkFingerprint === networkFingerprint),
  };
}

export function loginSecurityReason(isNewDevice: boolean, isUnusualNetwork: boolean) {
  if (isNewDevice && isUnusualNetwork) return "جهاز وشبكة جديدان";
  if (isNewDevice) return "جهاز جديد";
  return "شبكة غير معتادة";
}

export function shouldAlertLogin(isNewDevice: boolean, isUnusualNetwork: boolean) {
  return isNewDevice || isUnusualNetwork;
}

export function formatLoginSecurityAlert(input: { isNewDevice: boolean; isUnusualNetwork: boolean; platform: string }) {
  const reason = loginSecurityReason(input.isNewDevice, input.isUnusualNetwork);
  return {
    title: "تنبيه أمني لتسجيل الدخول",
    body: `تم تسجيل الدخول من ${reason}. إذا لم تكن أنت، غيّر كلمة المرور وتواصل مع الدعم.`,
    type: "security_login",
    action: "auth.login_security_alert",
    data: { isNewDevice: input.isNewDevice, isUnusualNetwork: input.isUnusualNetwork, platform: input.platform },
  };
}

export function normalizeDeviceId(deviceId: string | null | undefined, platform: string | null | undefined, userAgent: string | null | undefined) {
  return deviceId || `${platform || "unknown"}:${userAgent || "unknown"}`;
}
