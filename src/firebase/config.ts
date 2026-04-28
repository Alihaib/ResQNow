import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, setLogLevel } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOlzzkSshIJTm3Mylcd4RcM85HpGxgK1I",
  authDomain: "resqnow-b548d.firebaseapp.com",
  projectId: "resqnow-b548d",
  storageBucket: "resqnow-b548d.firebasestorage.app",
  messagingSenderId: "278501531382",
  appId: "1:278501531382:web:df307a729cae48875516d7",
  measurementId: "G-W2E96RVP1L"
};

// Prevent duplicate app initialization on Fast Refresh
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Firestore SDK logging (dev only) helps debug realtime permission issues.
if (typeof __DEV__ !== "undefined" && __DEV__) {
  try {
    setLogLevel("debug");
  } catch {
    // ignore
  }
}

// initializeFirestore (with long-polling for React Native) can only be called
// once. On Fast Refresh the module re-runs, so we fall back to getFirestore()
// if the instance already exists.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
export { db };
