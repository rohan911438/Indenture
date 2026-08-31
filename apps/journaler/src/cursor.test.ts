import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advance, loadCursor, saveCursor, alreadyJournaled } from "./cursor.js";

describe("advance (pure)", () => {
  const c0 = { lastTimestamp: "100.0", journaled: ["a"] };

  it("moves the timestamp forward and adds the key", () => {
    const c1 = advance(c0, "b", "200.5");
    expect(c1.lastTimestamp).toBe("200.5");
    expect(c1.journaled).toEqual(["a", "b"]);
  });

  it("never moves the timestamp backward", () => {
    expect(advance(c0, "b", "50.0").lastTimestamp).toBe("100.0");
  });

  it("is idempotent for a key already present", () => {
    expect(advance(c0, "a", "100.0").journaled).toEqual(["a"]);
  });
});

describe("alreadyJournaled", () => {
  it("detects a committed key", () => {
    expect(alreadyJournaled({ lastTimestamp: "0", journaled: ["x"] }, "x")).toBe(true);
    expect(alreadyJournaled({ lastTimestamp: "0", journaled: [] }, "x")).toBe(false);
  });
});

describe("load / save round-trip", () => {
  it("persists and reads back, bounding the dedupe set", () => {
    const path = join(mkdtempSync(join(tmpdir(), "jrnl-")), "cursor.json");
    const many = Array.from({ length: 600 }, (_, i) => `k${i}`);
    saveCursor({ lastTimestamp: "999.9", journaled: many }, path);
    const back = loadCursor(path);
    expect(back.lastTimestamp).toBe("999.9");
    expect(back.journaled.length).toBe(500); // last 500 kept
    expect(back.journaled.at(-1)).toBe("k599");
    expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
  });

  it("returns an empty cursor for a missing file", () => {
    expect(loadCursor(join(tmpdir(), "does-not-exist-xyz.json"))).toEqual({
      lastTimestamp: "0.0",
      journaled: [],
    });
  });
});
