/**
 * The local adapter: `localStorage`, one key per collection.
 *
 * This is the default and it is deliberately the honest one. No account, no
 * network, nothing leaves the device. It is also what makes the app runnable by
 * anyone who clones this repo without a Firebase project.
 *
 * Every read is defensive. Storage can be full, disabled in a private window,
 * or hold a record written by an older version of the app, and none of those
 * may lose someone their journal or crash the screen they are standing on.
 */

import {
  JournalEntrySchema, MoodEntrySchema, ProfileSchema, SupportRequestSchema,
  TrustedPersonSchema, ChallengeCompletionSchema, HelpSessionSchema,
  LessonCompletionSchema,
  type Validator,
} from "@teenbuddy/contracts";
import type { DataAdapter } from "./adapter.ts";

const PREFIX = "teenbuddy:v1";
const key = (userId: string, collection: string): string => `${PREFIX}:${userId}:${collection}`;

function readAll<T>(storageKey: string, schema: Validator<T>): T[] {
  if (typeof localStorage === "undefined") return [];
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return []; // storage disabled entirely
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return []; // corrupt blob; better an empty list than a white screen
  }
  if (!Array.isArray(parsed)) return [];

  // Records that no longer validate are skipped, not thrown away: they stay in
  // storage, so a fixed schema can pick them up again on the next release.
  const out: T[] = [];
  for (const item of parsed) {
    const r = schema.parse(item);
    if (r.ok) out.push(r.value);
  }
  return out;
}

function writeAll(storageKey: string, items: unknown[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (e) {
    // QuotaExceededError. Surfacing it is better than silently dropping a
    // journal entry the teen believes they just saved.
    throw new Error(
      "This device is out of storage space, so that could not be saved. Free some space and try again.",
      { cause: e },
    );
  }
}

const collection = <T>(name: string, schema: Validator<T>) => ({
  list: (userId: string): T[] => readAll(key(userId, name), schema),
  append: (userId: string, item: T): void => {
    const k = key(userId, name);
    writeAll(k, [...readAll(k, schema), item]);
  },
  remove: (userId: string, predicate: (item: T) => boolean): void => {
    const k = key(userId, name);
    writeAll(k, readAll(k, schema).filter((i) => !predicate(i)));
  },
  clear: (userId: string): void => {
    try {
      localStorage?.removeItem(key(userId, name));
    } catch { /* nothing to do */ }
  },
});

const moods = collection("moods", MoodEntrySchema);
const journal = collection("journal", JournalEntrySchema);
const lessons = collection("lessons", LessonCompletionSchema);
const challenges = collection("challenges", ChallengeCompletionSchema);
const help = collection("help", HelpSessionSchema);
const trusted = collection("trusted", TrustedPersonSchema);
const support = collection("support", SupportRequestSchema);

export function localAdapter(): DataAdapter {
  return {
    kind: "local",

    async getProfile(userId) {
      if (typeof localStorage === "undefined") return null;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key(userId, "profile"));
      } catch {
        return null;
      }
      if (!raw) return null;
      try {
        const r = ProfileSchema.parse(JSON.parse(raw));
        return r.ok ? r.value : null;
      } catch {
        return null;
      }
    },
    async saveProfile(profile) {
      writeAll(key(profile.userId, "profile"), []); // reserve the key first
      try {
        localStorage.setItem(key(profile.userId, "profile"), JSON.stringify(profile));
      } catch (e) {
        throw new Error("This device is out of storage space, so your profile could not be saved.", { cause: e });
      }
    },

    async listMoodEntries(u) { return moods.list(u); },
    async addMoodEntry(e) { moods.append(e.userId, e); },

    async listJournalEntries(u) { return journal.list(u); },
    async addJournalEntry(e) { journal.append(e.userId, e); },
    async deleteJournalEntry(u, id) { journal.remove(u, (e) => e.id === id); },

    async listLessonCompletions(u) { return lessons.list(u); },
    async addLessonCompletion(e) { lessons.append(e.userId, e); },

    async listChallengeCompletions(u) { return challenges.list(u); },
    async addChallengeCompletion(e) { challenges.append(e.userId, e); },

    async listHelpSessions(u) { return help.list(u); },
    async addHelpSession(e) { help.append(e.userId, e); },

    async listTrustedPeople(u) { return trusted.list(u); },
    async addTrustedPerson(p) { trusted.append(p.userId, p); },
    async removeTrustedPerson(u, id) { trusted.remove(u, (p) => p.id === id); },

    async listSupportRequests(u) { return support.list(u); },
    async addSupportRequest(r) { support.append(r.userId, r); },

    async eraseAll(userId) {
      for (const c of [moods, journal, lessons, challenges, help, trusted, support]) c.clear(userId);
      try {
        localStorage?.removeItem(key(userId, "profile"));
      } catch { /* already gone */ }
    },
  };
}
