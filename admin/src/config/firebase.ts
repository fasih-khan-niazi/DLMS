import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ",
  authDomain: "dlms-b7390.firebaseapp.com",
  projectId: "dlms-b7390",
  storageBucket: "dlms-b7390.firebasestorage.app",
  messagingSenderId: "747601344349",
  appId: "1:747601344349:web:5044b526512f8ca183dab4",
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
