/**
 * Adapter selection.
 *
 * Local storage is the default, and Firebase is opt-in via configuration. That
 * ordering is the product decision, not an implementation detail: nothing about
 * a teenager leaves their device unless someone deliberately configured it to.
 */

import type { DataAdapter } from "./adapter.ts";
import { localAdapter } from "./local.ts";
import { firebaseAdapter } from "./firebase.ts";
import { isFirebaseConfigured } from "../lib/config.ts";

export * from "./adapter.ts";

let cached: DataAdapter | null = null;

export function getAdapter(): DataAdapter {
  cached ??= isFirebaseConfigured() ? firebaseAdapter() : localAdapter();
  return cached;
}

/** Test seam. */
export function setAdapter(adapter: DataAdapter | null): void {
  cached = adapter;
}
