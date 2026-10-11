/**
 * The Firestore adapter.
 *
 * Every document lives under `users/{userId}/...`, which is what makes the
 * security rules in `firestore.rules` expressible as a single condition:
 * the signed-in user is the only one who can read or write their own subtree.
 * A flat collection with a `userId` field would need that check repeated on
 * every rule, and one omission would expose a teenager's journal.
 *
 * Firebase is imported lazily so a build with no Firebase config never pulls
 * the SDK into the bundle.
 */

import type {
  ChallengeCompletion, HelpSession, JournalEntry, LessonCompletion,
  MoodEntry, Profile, SupportRequest, TrustedPerson,
} from "@teenbuddy/contracts";
import {
  ChallengeCompletionSchema, HelpSessionSchema, JournalEntrySchema,
  LessonCompletionSchema, MoodEntrySchema, ProfileSchema,
  SupportRequestSchema, TrustedPersonSchema, type Validator,
} from "@teenbuddy/contracts";
import type { DataAdapter } from "./adapter.ts";
import { firebaseConfig, useEmulator } from "../lib/config.ts";

type Deps = {
  db: import("firebase/firestore").Firestore;
  fs: typeof import("firebase/firestore");
};

let deps: Promise<Deps> | null = null;

async function load(): Promise<Deps> {
  deps ??= (async () => {
    const [{ initializeApp, getApps, getApp }, fs] = await Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
    ]);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig()!);
    const db = fs.getFirestore(app);
    if (useEmulator()) fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    return { db, fs };
  })();
  return deps;
}

/** Skips documents that no longer validate rather than failing the whole read. */
function coerce<T>(schema: Validator<T>, docs: { data(): unknown }[]): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const r = schema.parse(d.data());
    if (r.ok) out.push(r.value);
  }
  return out;
}

export function firebaseAdapter(): DataAdapter {
  const listOf = async <T>(userId: string, name: string, schema: Validator<T>): Promise<T[]> => {
    const { db, fs } = await load();
    const snap = await fs.getDocs(fs.collection(db, "users", userId, name));
    return coerce(schema, snap.docs);
  };

  const put = async (userId: string, name: string, id: string, value: unknown): Promise<void> => {
    const { db, fs } = await load();
    await fs.setDoc(fs.doc(db, "users", userId, name, id), value as Record<string, unknown>);
  };

  const drop = async (userId: string, name: string, id: string): Promise<void> => {
    const { db, fs } = await load();
    await fs.deleteDoc(fs.doc(db, "users", userId, name, id));
  };

  return {
    kind: "firebase",

    async getProfile(userId) {
      const { db, fs } = await load();
      const snap = await fs.getDoc(fs.doc(db, "users", userId));
      if (!snap.exists()) return null;
      const r = ProfileSchema.parse(snap.data());
      return r.ok ? r.value : null;
    },
    async saveProfile(profile: Profile) {
      const { db, fs } = await load();
      await fs.setDoc(fs.doc(db, "users", profile.userId), profile);
    },

    listMoodEntries: (u) => listOf(u, "moods", MoodEntrySchema),
    addMoodEntry: (e: MoodEntry) => put(e.userId, "moods", e.id, e),

    listJournalEntries: (u) => listOf(u, "journal", JournalEntrySchema),
    addJournalEntry: (e: JournalEntry) => put(e.userId, "journal", e.id, e),
    deleteJournalEntry: (u, id) => drop(u, "journal", id),

    listLessonCompletions: (u) => listOf(u, "lessons", LessonCompletionSchema),
    addLessonCompletion: (e: LessonCompletion) => put(e.userId, "lessons", e.id, e),

    listChallengeCompletions: (u) => listOf(u, "challenges", ChallengeCompletionSchema),
    addChallengeCompletion: (e: ChallengeCompletion) => put(e.userId, "challenges", e.id, e),

    listHelpSessions: (u) => listOf(u, "help", HelpSessionSchema),
    addHelpSession: (e: HelpSession) => put(e.userId, "help", e.id, e),

    listTrustedPeople: (u) => listOf(u, "trusted", TrustedPersonSchema),
    addTrustedPerson: (p: TrustedPerson) => put(p.userId, "trusted", p.id, p),
    removeTrustedPerson: (u, id) => drop(u, "trusted", id),

    listSupportRequests: (u) => listOf(u, "support", SupportRequestSchema),
    addSupportRequest: (r: SupportRequest) => put(r.userId, "support", r.id, r),

    async eraseAll(userId) {
      const { db, fs } = await load();
      for (const name of ["moods", "journal", "lessons", "challenges", "help", "trusted", "support"]) {
        const snap = await fs.getDocs(fs.collection(db, "users", userId, name));
        await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
      }
      await fs.deleteDoc(fs.doc(db, "users", userId));
    },
  };
}
