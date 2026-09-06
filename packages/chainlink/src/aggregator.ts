/**
 * Defensive Chainlink AggregatorV3 reads.
 *
 * The naive read — destructure `latestRoundData()`, take `answer`, move on —
 * is the single most common way a protocol ends up pricing against a number
 * the feed never intended to publish. Chainlink's own integration guidance
 * calls out every check below. This module exists so those checks happen in
 * exactly one place, and so a failed check is a VALUE the caller must handle
 * rather than an exception it can accidentally swallow.
 *
 * `latestRoundData()` returns
 *   (roundId, answer, startedAt, updatedAt, answeredInRound)
 * and four of those five fields matter:
 *
 *   updatedAt == 0            the round has not completed; `answer` is
 *                             meaningless, not merely old.
 *   answeredInRound < roundId the answer was carried over from an earlier
 *                             round. The feed is telling you it has not
 *                             produced a fresh answer for this one.
 *   answer <= 0               a USD price feed never legitimately reports
 *                             zero or negative. Treating it as a price
 *                             values the portfolio at zero, which reads as
 *                             a catastrophic loss and can trip covenants
 *                             in the wrong direction.
 *   now - updatedAt > maxAge  stale relative to the mandate's tolerance.
 *
 * On Hedera specifically the last one is subtle: the feeds publish on an
 * 86400s heartbeat, so "a day old" is healthy, not broken. The tolerance is
 * therefore a MANDATE field rather than a constant here — see
 * docs/RESEARCH.md section 2.1 for the bug that taught us this.
 */
import { getAddress, parseAbi, type Hex, type PublicClient } from "viem";

export const aggregatorV3Abi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function version() view returns (uint256)",
]);

export type FeedFault =
  | "incompleteRound"
  | "staleRound"
  | "nonPositiveAnswer"
  | "stale"
  | "unreadable";

export type FeedOk = {
  ok: true;
  /** the raw integer answer, at `decimals` precision */
  answer: bigint;
  decimals: number;
  /** unix seconds the answer was published */
  updatedAt: number;
  /** seconds since publication, at the time of the read */
  ageSec: number;
  roundId: bigint;
};

export type FeedFailure = {
  ok: false;
  fault: FeedFault;
  reason: string;
  detail: Record<string, string>;
};

export type FeedReading = FeedOk | FeedFailure;

export type ReadFeedOptions = {
  /** the mandate's staleness tolerance, seconds. MUST be >= the feed heartbeat. */
  maxAgeSec: number;
  /** injectable for deterministic tests */
  nowSec?: number;
};

/**
 * Read one feed and validate it. Never throws for a bad feed — a fault is a
 * value, because the Validator's job when a price is untrustworthy is to
 * REFUSE with a reason, not to crash and be restarted into the same state.
 */
export async function readFeed(
  client: PublicClient,
  feed: string,
  opts: ReadFeedOptions,
): Promise<FeedReading> {
  const address = getAddress(feed) as Hex;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);

  let roundId: bigint;
  let answer: bigint;
  let updatedAt: bigint;
  let answeredInRound: bigint;
  let decimals: number;

  try {
    const [round, dec] = await Promise.all([
      client.readContract({ address, abi: aggregatorV3Abi, functionName: "latestRoundData" }),
      client.readContract({ address, abi: aggregatorV3Abi, functionName: "decimals" }),
    ]);
    [roundId, answer, , updatedAt, answeredInRound] = round;
    decimals = Number(dec);
  } catch (e) {
    return {
      ok: false,
      fault: "unreadable",
      reason: `feed ${address} could not be read: ${(e as Error).message}`,
      detail: { feed: address },
    };
  }

  if (updatedAt === 0n) {
    return {
      ok: false,
      fault: "incompleteRound",
      reason: `feed ${address} round ${roundId} has not completed`,
      detail: { feed: address, roundId: roundId.toString() },
    };
  }

  if (answeredInRound < roundId) {
    return {
      ok: false,
      fault: "staleRound",
      reason: `feed ${address} answered in round ${answeredInRound}, current round is ${roundId}`,
      detail: {
        feed: address,
        roundId: roundId.toString(),
        answeredInRound: answeredInRound.toString(),
      },
    };
  }

  if (answer <= 0n) {
    return {
      ok: false,
      fault: "nonPositiveAnswer",
      reason: `feed ${address} reported a non-positive price (${answer})`,
      detail: { feed: address, answer: answer.toString() },
    };
  }

  const ageSec = now - Number(updatedAt);

  if (ageSec > opts.maxAgeSec) {
    return {
      ok: false,
      fault: "stale",
      reason: `feed ${address} is ${ageSec}s old, tolerance is ${opts.maxAgeSec}s`,
      detail: {
        feed: address,
        observedAgeSec: String(ageSec),
        toleranceSec: String(opts.maxAgeSec),
      },
    };
  }

  return {
    ok: true,
    answer,
    decimals,
    updatedAt: Number(updatedAt),
    // A feed published slightly ahead of local clock skew should read as 0,
    // not as a negative age that would later compare oddly against a cap.
    ageSec: ageSec < 0 ? 0 : ageSec,
    roundId,
  };
}

/** Human label for the prospectus, e.g. "HBAR / USD". Best-effort. */
export async function describeFeed(client: PublicClient, feed: string): Promise<string | null> {
  try {
    return await client.readContract({
      address: getAddress(feed) as Hex,
      abi: aggregatorV3Abi,
      functionName: "description",
    });
  } catch {
    return null;
  }
}
