/**
 * Runtime configuration.
 *
 * The app runs with zero configuration. Firebase switches on only when every
 * required variable is present, so a half-filled `.env.local` falls back to
 * local storage rather than throwing at first render.
 */

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

/**
 * Read as literal `process.env.X` expressions, never `process.env[name]`:
 * Next inlines the former at build time and cannot see the latter.
 */
export function firebaseConfig(): FirebaseConfig | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return Object.values(config).every((v) => typeof v === "string" && v.length > 0)
    ? (config as FirebaseConfig)
    : null;
}

export const isFirebaseConfigured = (): boolean => firebaseConfig() !== null;

export const useEmulator = (): boolean =>
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
