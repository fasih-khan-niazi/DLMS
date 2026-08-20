import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const serviceAccountPath = path.resolve(
  __dirname,
  "../../",
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../secrets/firebase-admin.json"
);

initializeApp({
  credential: cert(serviceAccountPath),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
export const messaging = getMessaging();
