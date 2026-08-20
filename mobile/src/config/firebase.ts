import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ",
  authDomain: "dlms-b7390.firebaseapp.com",
  projectId: "dlms-b7390",
  storageBucket: "dlms-b7390.firebasestorage.app",
  messagingSenderId: "747601344349",
  appId: "1:747601344349:web:5044b526512f8ca183dab4",
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

function createAuth() {
  try {
    // RN persistence helper is on the React Native build entry.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require("@firebase/auth/dist/rn/index.js") as {
      getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => unknown;
    };
    return initializeAuth(app, {
      persistence: rnAuth.getReactNativePersistence(ReactNativeAsyncStorage) as any,
    });
  } catch {
    return getAuth(app);
  }
}

export const firebaseAuth = createAuth();
