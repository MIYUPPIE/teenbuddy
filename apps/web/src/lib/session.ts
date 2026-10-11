"use client";

/**
 * Who the app thinks you are, and what day it is for you.
 *
 * Identity is deliberately thin. With the local adapter there is no account at
 * all: a random id is generated on first run and never leaves the device. That
 * is not a placeholder for real auth, it is the privacy default - a teenager
 * can use every screen without handing over an identity to anybody.
 */

import { DEFAULT_PRIVACY, SCHEMA_VERSION, type Profile } from "@teenbuddy/contracts";
import { localDateOf } from "@teenbuddy/progress";
import { newId } from "../data/adapter.ts";

const USER_KEY = "teenbuddy:v1:userId";

/** Stable per device. Regenerated only if storage is cleared. */
export function currentUserId(): string {
  if (typeof localStorage === "undefined") return "anonymous";
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(USER_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

/**
 * The browser's IANA zone, which is the teen's own zone by definition.
 * Falls back to UTC only when the runtime refuses to say.
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function newProfile(userId: string): Profile {
  return {
    userId,
    displayName: "there",
    timezone: detectTimezone(),
    ageBand: "13-15",
    privacy: DEFAULT_PRIVACY,
    createdAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
}

/** The teen's civil date. Never `new Date().toISOString().slice(0,10)`. */
export const todayFor = (profile: Profile | null): string =>
  localDateOf(new Date(), profile?.timezone ?? detectTimezone());
