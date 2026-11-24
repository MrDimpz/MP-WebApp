import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

if (typeof window !== "undefined") {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  });
}

async function testConnection() {
  if (typeof window === "undefined") return;
  const cleanPath = window.location.pathname.toLowerCase().replace(/\/+$/, "");
  const params = new URLSearchParams(window.location.search);
  if (
    cleanPath.endsWith("/overlay") ||
    params.get("overlay") === "1" ||
    params.get("clean") === "1"
  ) {
    return;
  }
  try {
    const rawPause =
      window.localStorage.getItem("mp_firestore_quota_pause_until_v2") ||
      window.sessionStorage.getItem("mp_firestore_quota_pause_until_v2");
    if (rawPause && Number(rawPause) > Date.now()) {
      return;
    }
  } catch {
    // ignore storage errors
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

export default app;
