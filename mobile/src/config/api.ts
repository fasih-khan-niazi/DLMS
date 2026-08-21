import axios from "axios";
import { firebaseAuth } from "./firebase";

/**
 * API base URL.
 * - Default: Render (Week 1 public demo)
 * - Override: EXPO_PUBLIC_API_URL (Expo Go / EAS)
 *   e.g. http://192.168.100.7:5000 for home LAN
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://dlms-csij.onrender.com"
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // allow Render free-tier cold start
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
