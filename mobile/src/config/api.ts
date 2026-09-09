import axios from "axios";
import { firebaseAuth } from "./firebase";

// API base URL - EXPO_PUBLIC_API_URL se override ho sakti hai
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://dlms-csij.onrender.com"
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// har request pe Firebase token lagata hai
api.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
