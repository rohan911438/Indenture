/**
 * The journaler's committed position. Advanced ONLY after an HCS receipt
 * confirms the envelope landed, so a crash mid-tick re-processes rather than
 * skips. `journaled` is the idempotency set: (event, nonce, tx) keys already
 * written.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type Cursor = {
  /** mirror-node consensus timestamp of the last journaled log, exclusive */
  lastTimestamp: string;
  /** dedupe keys already written to HCS */
  journaled: string[];
};

const EMPTY: Cursor = { lastTimestamp: "0.0", journaled: [] };

export function cursorPath(base = process.cwd()): string {
  return resolve(base, "cursor.json");
}

export function loadCursor(path = cursorPath()): Cursor {
  if (!existsSync(path)) return { ...EMPTY };
  try {
    const c = JSON.parse(readFileSync(path, "utf8")) as Partial<Cursor>;
    return {
      lastTimestamp: c.lastTimestamp ?? EMPTY.lastTimestamp,
      journaled: Array.isArray(c.journaled) ? c.journaled : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCursor(c: Cursor, path = cursorPath()): void {
  // keep the dedupe set bounded - the timestamp cursor covers older entries
  const journaled = c.journaled.slice(-500);
  writeFileSync(path, JSON.stringify({ ...c, journaled }, null, 2) + "\n");
}

export function alreadyJournaled(c: Cursor, key: string): boolean {
  return c.journaled.includes(key);
}

/** pure: returns the next cursor after committing `key` at `timestamp` */
export function advance(c: Cursor, key: string, timestamp: string): Cursor {
  return {
    lastTimestamp:
      Number(timestamp) > Number(c.lastTimestamp) ? timestamp : c.lastTimestamp,
    journaled: c.journaled.includes(key)
      ? c.journaled
      : [...c.journaled, key],
  };
}
