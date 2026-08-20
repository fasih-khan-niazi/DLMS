import axios from "axios";
import { firebaseAuth } from "./firebase";

/**
 * How your phone reaches the Express API on your PC.
 *
 * - "lan"      → PC Ethernet/Wi-Fi IP (try this first)
 * - "usb"      → after: adb reverse tcp:5000 tcp:5000
 * - "emulator" → Android emulator only
 */
type ApiMode = "lan" | "usb" | "emulator";

const API_MODE: ApiMode = "lan";

const API_URLS: Record<ApiMode, string> = {
  lan: "http://192.168.100.7:5000",
  usb: "http://127.0.0.1:5000",
  emulator: "http://10.0.2.2:5000",
};

export const API_BASE_URL = API_URLS[API_MODE];

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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
