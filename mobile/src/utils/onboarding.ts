import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "dlms.onboarding.done";
const SCAN_COACH_KEY = "dlms.onboarding.scanCoach";

export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
}

export async function clearOnboardingDone(): Promise<void> {
  try {
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
