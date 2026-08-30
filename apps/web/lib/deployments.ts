import deployments from "../../../contracts/deployments.json";

/** deployments.json is the single source of truth. Never read an address from env. */
export { deployments };

export const MIRROR_URL =
  deployments.network?.mirrorUrl ?? "https://testnet.mirrornode.hedera.com/api/v1";
export const JOURNAL_TOPIC = deployments.hcs?.journalTopicId ?? "";
export const MANDATE_TOPIC = deployments.hcs?.mandateTopicId ?? "";
