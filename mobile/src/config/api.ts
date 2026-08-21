import axios from "axios";
import { firebaseAuth } from "./firebase";

/**
 * How your phone reaches the Express API.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL (EAS / release builds, Render URL)
 * 2. Mode below for local Expo Go
 */
type ApiMode = "lan" | "usb" | "emulator";

const API_MODE: ApiMode = "lan";

const API_URLS: Record<ApiMode, string> = {
  lan: "http://192.168.100.7:5000",
  usb: "http://127.0.0.1:5000",
  emulator: "http://10.0.2.2:5000",
};

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || API_URLS[API_MODE]
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
