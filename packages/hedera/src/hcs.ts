/**
 * NODE-ONLY. Imports @hashgraph/sdk, which needs gRPC over HTTP/2 and will not
 * run on Cloudflare Workers / edge. Only apps/journaler and scripts use this.
 */
import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { envelopeSchema, type Envelope } from "./envelope.js";

export type HcsAuth = {
  operatorId: string; // 0.0.xxxxx
  operatorKey: string; // DER / hex private key
  network?: "testnet" | "mainnet" | "previewnet";
};

export function hcsClient(auth: HcsAuth): Client {
  const client =
    auth.network === "mainnet"
      ? Client.forMainnet()
      : auth.network === "previewnet"
        ? Client.forPreviewnet()
        : Client.forTestnet();
  client.setOperator(auth.operatorId, PrivateKey.fromStringDer(auth.operatorKey));
  return client;
}

export async function createTopic(
  client: Client,
  memo: string,
): Promise<string> {
  const tx = await new TopicCreateTransaction().setTopicMemo(memo).execute(client);
  const receipt = await tx.getReceipt(client);
  const id = receipt.topicId;
  if (!id) throw new Error("topic id missing from receipt");
  return id.toString();
}

export async function submit(
  client: Client,
  topicId: string,
  envelope: Envelope,
): Promise<{ sequenceNumber: string }> {
  const e = envelopeSchema.parse(envelope);
  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(e))
    .execute(client);
  const receipt = await tx.getReceipt(client);
  return { sequenceNumber: receipt.topicSequenceNumber?.toString() ?? "0" };
}
