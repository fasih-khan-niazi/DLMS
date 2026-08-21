import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

function loadCredential() {
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonInline) {
    const parsed = JSON.parse(jsonInline) as ServiceAccount;
    return cert(parsed);
  }

  const relative =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../secrets/firebase-admin.json";
  const serviceAccountPath = path.resolve(__dirname, "../../", relative);
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT_JSON (Render) or FIREBASE_SERVICE_ACCOUNT_PATH (local). Tried: ${serviceAccountPath}`
    );
  }
  return cert(serviceAccountPath);
}

initializeApp({
  credential: loadCredential(),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
export const messaging = getMessaging();
