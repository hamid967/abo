import * as Keychain from "react-native-keychain";

const SESSION_SERVICE = "com.app.governmenttransactionstracker.session";

export async function saveSessionToken(token: string) {
  await Keychain.setGenericPassword("session", token, {
    service: SESSION_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function readSessionToken() {
  const stored = await Keychain.getGenericPassword({ service: SESSION_SERVICE });
  return stored ? stored.password : null;
}

export async function clearSessionToken() {
  await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
}
