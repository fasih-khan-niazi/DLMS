import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "dlms.onboarding.done";
const SCAN_COACH_KEY = "dlms.onboarding.scanCoach";

export async function isOnboardingDone(uid?: string): Promise<boolean> {
  try {
    if (!uid) {
      return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
    }
    const val = await AsyncStorage.getItem(`${ONBOARDING_KEY}.${uid}`);
    return val === "1";
  } catch {
    return false;
  }
}

export async function setOnboardingDone(uid?: string): Promise<void> {
  try {
    if (uid) {
      await AsyncStorage.setItem(`${ONBOARDING_KEY}.${uid}`, "1");
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    }
  } catch {
    // ignore
  }
}

export async function clearOnboardingDone(uid?: string): Promise<void> {
  try {
    if (uid) {
      await AsyncStorage.removeItem(`${ONBOARDING_KEY}.${uid}`);
    }
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
}

export async function isScanCoachDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SCAN_COACH_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function dismissScanCoach(): Promise<void> {
  try {
    await AsyncStorage.setItem(SCAN_COACH_KEY, "1");
  } catch {
    // ignore
  }
}
