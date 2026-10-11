import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRIVACY, SCHEMA_VERSION, type JournalEntry, type MoodEntry, type Profile } from "@teenbuddy/contracts";
import { localAdapter } from "../src/data/local.ts";
import { newId } from "../src/data/adapter.ts";

/** A localStorage that behaves like the real one, including throwing on quota. */
function fakeStorage(opts: { quota?: number; disabled?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    getItem(k: string) {
      if (opts.disabled) throw new Error("storage disabled");
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      if (opts.disabled) throw new Error("storage disabled");
      const total = [...map.entries()].reduce((n, [a, b]) => n + a.length + b.length, 0);
      if (opts.quota !== undefined && total + v.length > opts.quota) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      map.set(k, v);
    },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const install = (s: ReturnType<typeof fakeStorage>) => {
  (globalThis as { localStorage?: unknown }).localStorage = s;
};

const USER = "u1";
const NOW = "2026-08-31T09:00:00.000Z";

const profile = (): Profile => ({
  userId: USER, displayName: "Ada", timezone: "Africa/Lagos", ageBand: "13-15",
  privacy: DEFAULT_PRIVACY, createdAt: NOW, schemaVersion: SCHEMA_VERSION,
});
const mood = (localDate: string): MoodEntry => ({
  id: newId(), userId: USER, localDate, createdAt: NOW,
  mood: "okay", causes: ["school"], schemaVersion: SCHEMA_VERSION,
});
const journal = (body: string): JournalEntry => ({
  id: newId(), userId: USER, localDate: "2026-08-31", createdAt: NOW,
  body, schemaVersion: SCHEMA_VERSION,
});

beforeEach(() => install(fakeStorage()));

describe("round trips", () => {
  test("a profile survives a save and load", async () => {
    const a = localAdapter();
    await a.saveProfile(profile());
    assert.deepEqual(await a.getProfile(USER), profile());
  });

  test("a missing profile is null, not a throw", async () => {
    assert.equal(await localAdapter().getProfile("nobody"), null);
  });

  test("records accumulate and read back in order", async () => {
    const a = localAdapter();
    await a.addMoodEntry(mood("2026-08-29"));
    await a.addMoodEntry(mood("2026-08-30"));
    const all = await a.listMoodEntries(USER);
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((m) => m.localDate), ["2026-08-29", "2026-08-30"]);
  });

  test("journal entries can be deleted individually", async () => {
    const a = localAdapter();
    const keep = journal("keep me");
    const drop = journal("delete me");
    await a.addJournalEntry(keep);
    await a.addJournalEntry(drop);
    await a.deleteJournalEntry(USER, drop.id);
    const left = await a.listJournalEntries(USER);
    assert.equal(left.length, 1);
    assert.equal(left[0]!.body, "keep me");
  });

  test("one user's data is invisible to another", async () => {
    const a = localAdapter();
    await a.addMoodEntry(mood("2026-08-31"));
    assert.deepEqual(await a.listMoodEntries("someone-else"), []);
  });
});

describe("survives hostile storage", () => {
  test("a corrupt blob yields an empty list, not a crash", async () => {
    const s = fakeStorage();
    s.map.set("teenbuddy:v1:u1:moods", "{ not json at all");
    install(s);
    assert.deepEqual(await localAdapter().listMoodEntries(USER), []);
  });

  test("a non-array blob yields an empty list", async () => {
    const s = fakeStorage();
    s.map.set("teenbuddy:v1:u1:moods", '{"oops":true}');
    install(s);
    assert.deepEqual(await localAdapter().listMoodEntries(USER), []);
  });

  test("records that no longer validate are skipped, and the valid ones still load", async () => {
    const s = fakeStorage();
    const good = mood("2026-08-31");
    s.map.set("teenbuddy:v1:u1:moods", JSON.stringify([good, { id: "x", broken: true }, "nonsense"]));
    install(s);
    const loaded = await localAdapter().listMoodEntries(USER);
    assert.equal(loaded.length, 1, "one bad record must not lose the good ones");
    assert.equal(loaded[0]!.id, good.id);
  });

  test("a skipped record is not deleted, so a schema fix can recover it", async () => {
    const s = fakeStorage();
    s.map.set("teenbuddy:v1:u1:moods", JSON.stringify([{ future: "shape" }]));
    install(s);
    await localAdapter().listMoodEntries(USER);
    assert.match(s.map.get("teenbuddy:v1:u1:moods")!, /future/, "the raw blob is untouched by a read");
  });

  test("storage being disabled degrades to empty rather than throwing", async () => {
    install(fakeStorage({ disabled: true }));
    const a = localAdapter();
    assert.equal(await a.getProfile(USER), null);
    assert.deepEqual(await a.listMoodEntries(USER), []);
  });

  test("a full disk surfaces a readable error instead of silently dropping the write", async () => {
    install(fakeStorage({ quota: 80 }));
    await assert.rejects(
      () => localAdapter().addJournalEntry(journal("x".repeat(500))),
      /out of storage space/,
      "a teen who pressed Save must not be told it worked",
    );
  });
});

describe("eraseAll", () => {
  test("removes every collection and the profile", async () => {
    const s = fakeStorage();
    install(s);
    const a = localAdapter();
    await a.saveProfile(profile());
    await a.addMoodEntry(mood("2026-08-31"));
    await a.addJournalEntry(journal("private"));
    await a.addTrustedPerson({
      id: newId(), userId: USER, name: "Aunt Bisi", relation: "relative",
      contactMethod: "sms", contactValue: "0700", addedAt: NOW, schemaVersion: SCHEMA_VERSION,
    });

    await a.eraseAll(USER);

    assert.equal(await a.getProfile(USER), null);
    assert.deepEqual(await a.listMoodEntries(USER), []);
    assert.deepEqual(await a.listJournalEntries(USER), []);
    assert.deepEqual(await a.listTrustedPeople(USER), []);
    const leftovers = [...s.map.keys()].filter((k) => k.includes(USER));
    assert.deepEqual(leftovers, [], `erase left keys behind: ${leftovers.join(", ")}`);
  });

  test("erasing one user leaves another user's data alone", async () => {
    const a = localAdapter();
    await a.addMoodEntry(mood("2026-08-31"));
    await a.addMoodEntry({ ...mood("2026-08-31"), userId: "u2" });
    await a.eraseAll("u2");
    assert.equal((await a.listMoodEntries(USER)).length, 1);
    assert.deepEqual(await a.listMoodEntries("u2"), []);
  });
});

describe("newId", () => {
  test("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 5000 }, newId));
    assert.equal(ids.size, 5000);
  });
});
