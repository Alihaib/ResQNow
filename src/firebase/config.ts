import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOlzzkSshIJTm3Mylcd4RcM85HpGxgK1I",
  authDomain: "resqnow-b548d.firebaseapp.com",
  projectId: "resqnow-b548d",
  storageBucket: "resqnow-b548d.firebasestorage.app",
  messagingSenderId: "278501531382",
  appId: "1:278501531382:web:df307a729cae48875516d7",
  measurementId: "G-W2E96RVP1L"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
