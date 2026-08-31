import { describe, it, expect } from "vitest";
import { topicMessagesUrl, contractLogsUrl, DEFAULT_MIRROR } from "./mirror.js";

describe("topicMessagesUrl", () => {
  it("defaults to desc, limit 100, no cursor", () => {
    const u = new URL(topicMessagesUrl("0.0.1234"));
    expect(u.origin + u.pathname).toBe(`${DEFAULT_MIRROR}/topics/0.0.1234/messages`);
    expect(u.searchParams.get("order")).toBe("desc");
    expect(u.searchParams.get("limit")).toBe("100");
    expect(u.searchParams.get("sequencenumber")).toBeNull();
  });

  it("adds a gt: cursor when sinceSeq is given", () => {
    const u = new URL(
      topicMessagesUrl("0.0.1", { order: "asc", limit: 25, sinceSeq: 7 }),
    );
    expect(u.searchParams.get("order")).toBe("asc");
    expect(u.searchParams.get("limit")).toBe("25");
    expect(u.searchParams.get("sequencenumber")).toBe("gt:7");
  });

  it("honours a custom mirror url", () => {
    const u = topicMessagesUrl("0.0.1", { mirrorUrl: "https://example.test/api/v1" });
    expect(u.startsWith("https://example.test/api/v1/topics/0.0.1/messages")).toBe(true);
  });
});

describe("contractLogsUrl", () => {
  it("defaults to asc for cursor-forward scanning", () => {
    const u = new URL(contractLogsUrl("0.0.9"));
    expect(u.pathname).toBe("/api/v1/contracts/0.0.9/results/logs");
    expect(u.searchParams.get("order")).toBe("asc");
  });

  it("filters by topic0 and a timestamp cursor", () => {
    const u = new URL(
      contractLogsUrl("0.0.9", {
        topic0: "0xabc",
        sinceTimestamp: "1725000000.000000000",
      }),
    );
    expect(u.searchParams.get("topic0")).toBe("0xabc");
    expect(u.searchParams.get("timestamp")).toBe("gt:1725000000.000000000");
  });
});
