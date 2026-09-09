import axios from "axios";
import { firebaseAuth } from "./firebase";

// API base URL - local ke liye VITE_API_URL set karo
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://dlms-csij.onrender.com"
).replace(/\/$/, "");

export const api = axios.create({
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
