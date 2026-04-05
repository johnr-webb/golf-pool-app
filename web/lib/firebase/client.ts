"use client";

// Minimal Firebase client. Used ONLY for authentication — no Firestore, no
// Storage. All application data flows through the Express API (see lib/api/).
// This module must not be imported from server components.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { firebaseConfig, useEmulators } from "./config";

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let emulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp());
  if (useEmulators && !emulatorConnected && typeof window !== "undefined") {
    connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    emulatorConnected = true;
  }
  return authInstance;
}
