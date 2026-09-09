import axios from "axios";
import { firebaseAuth } from "./firebase";

/** Default = Render production API. Override with VITE_API_URL for local work. */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://dlms-csij.onrender.com"
).replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
