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
    try {
      const parsed = JSON.parse(jsonInline) as ServiceAccount;
      return cert(parsed);
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full service account file contents. (${String(err)})`
      );
    }
  }

  // Render has no secrets/ folder. PATH from a copied local .env will crash deploy.
  if (process.env.RENDER === "true") {
    throw new Error(
      "On Render, set FIREBASE_SERVICE_ACCOUNT_JSON to the full service account JSON. Remove FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  const relative =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../secrets/firebase-admin.json";
  const serviceAccountPath = path.resolve(__dirname, "../../", relative);
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found at ${serviceAccountPath}. For Render use FIREBASE_SERVICE_ACCOUNT_JSON instead.`
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
