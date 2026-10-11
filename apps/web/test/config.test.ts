import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * `firebaseConfig` reads literal `process.env.X` expressions so Next can inline
 * them at build time. That means these tests must mutate process.env and
 * re-import, rather than passing an env object in.
 */
const KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const load = async () => {
  // A cache-busting query gives a fresh module with the current env.
  const mod = await import(`../src/lib/config.ts?t=${Math.random()}`);
  return mod as typeof import("../src/lib/config.ts");
};

const setAll = (value: string | undefined) => {
  for (const k of KEYS) {
    if (value === undefined) delete process.env[k];
    else process.env[k] = value;
  }
};

describe("firebaseConfig", () => {
  test("no configuration means local storage, not a crash", async () => {
    setAll(undefined);
    const { firebaseConfig, isFirebaseConfigured } = await load();
    assert.equal(firebaseConfig(), null);
    assert.equal(isFirebaseConfigured(), false);
  });

  test("a complete configuration switches Firebase on", async () => {
    setAll("value");
    const { isFirebaseConfigured } = await load();
    assert.equal(isFirebaseConfigured(), true);
    setAll(undefined);
  });

  test("a half-filled .env.local falls back rather than half-initialising", async () => {
    setAll("value");
    delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    const { isFirebaseConfigured } = await load();
    assert.equal(isFirebaseConfigured(), false, "one missing key must not produce a broken client");
    setAll(undefined);
  });

  test("empty strings count as missing", async () => {
    setAll("");
    const { isFirebaseConfigured } = await load();
    assert.equal(isFirebaseConfigured(), false);
    setAll(undefined);
  });
});
