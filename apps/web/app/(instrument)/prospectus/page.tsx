import { CertificateBand } from "@/components/landing/CertificateBand";
import { Close, type Party } from "@/components/landing/Close";
import { DemoStage, type DemoSubject } from "@/components/landing/DemoStage";
import { Enforcement } from "@/components/landing/Enforcement";
import { Hero } from "@/components/landing/Hero";
import { SystemSpine } from "@/components/landing/SystemSpine";
import { Threat } from "@/components/landing/Threat";
import { sealFromCovenants } from "@/components/seal/rosette";
import {
  getAttackScenarios,
  getCovenantStatus,
  getJournal,
  getMandate,
  getSharesState,
  JOURNAL_TOPIC_ID,
} from "@/lib/data";
import {
  deployments,
  MANDATE_TOPIC,
  VALIDATOR_URL,
} from "@/lib/deployments";
import { mandateSentence, sharesFromUnits6, usd } from "@/lib/format";
import type { ContextBody, JournalRow, ReceiptBody } from "@/lib/types";

export const revalidate = 5;

/**
 * The prospectus — what Indenture is, and why a blocked attack is the product.
 *
 * Seven movements: the claim, the threat, the pipeline, one refusal taken
 * apart, the certificate, the honest split between the two kinds of covenant,
 * and an instruction to go and try it.
 *
 * Every figure comes through lib/data.ts and carries its own source label, so a
 * page showing fixtures says so in each place it shows one. The live document
 * this route used to be now lives at /mandate, unchanged.
 */
export default async function ProspectusPage() {
  const [mandateSrc, covenantsSrc, sharesSrc, journalSrc] = await Promise.all([
    getMandate(),
    getCovenantStatus(),
    getSharesState(),
    getJournal(),
  ]);

  const mandate = mandateSrc.data;
  const covenants = covenantsSrc.data;
  const shares = sharesSrc.data;
  const rows = journalSrc.data;

  // One read of the journal, three counts off it. /blocked is this same list
  // filtered, so counting it separately could only ever disagree with itself.
  const isRefusal = (r: JournalRow) =>
    r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED";
  const refusals = rows.filter(isRefusal).length;
  const approved = rows.filter(
    (r) => r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "APPROVED",
  ).length;
  const breaches = rows.filter((r) => r.type === "BREACH").length;

  const supply = sharesFromUnits6(shares.shareClass.totalSupply);
  const nav = supply * Number(shares.shareClass.navPerShare);

  const sealState = sealFromCovenants(covenants);
  const scenarios = getAttackScenarios();

  // A deed names the parties that executed it. These are the real keys from
  // contracts/deployments.json; any that was never issued is simply left out
  // rather than shown as an empty address.
  const parties: Party[] = [
    {
      role: "Validator",
      address: deployments.signers?.validator ?? "",
      note: "signs receipts, or refuses. Holds no funds.",
    },
    {
      role: "Manager",
      address: deployments.signers?.manager ?? "",
      note: "proposes trades. Trusted with nothing.",
    },
    {
      role: "Vault",
      address: mandate.vault,
      note: "holds the assets, and reports its own portfolio on-chain.",
    },
  ].filter((p) => p.address.length > 0);

  /**
   * The demo narrates a real journaled refusal when one exists with the text the
   * model actually saw. If it does not, it narrates a fixture scenario IN FULL
   * and says so — never a real verdict wearing a fixture's sentence, or the
   * reverse. Mixing the two would be the one dishonesty this page cannot afford.
   */
  const realRefusal = rows.find(
    (r) => isRefusal(r) && !!r.context?.reasoning,
  );
  let subject: DemoSubject;
  if (realRefusal && realRefusal.context) {
    const body = realRefusal.body as ReceiptBody;
    const ctx = realRefusal.context as ContextBody;
    subject = {
      reasoning: ctx.reasoning,
      reason: body.reason,
      covenant: body.reason.split(":")[0] ?? "covenant",
      poolId: ctx.poolId,
      swapParams: ctx.swapParams,
      seq: realRefusal.seq,
      live: journalSrc.live,
    };
  } else {
    const s = scenarios[0];
    subject = {
      reasoning: s.injectedReasoning,
      reason: s.reason,
      covenant: s.covenant,
      poolId: s.poolId,
      swapParams: s.swapParams,
      seq: null,
      live: false,
    };
  }

  return (
    <>
      <Hero
        sealState={sealState}
        refusals={refusals}
        breaches={breaches}
        approved={approved}
        nav={usd(nav)}
        navLive={sharesSrc.live}
        navNote={sharesSrc.note}
        journalLive={journalSrc.live}
        journalNote={journalSrc.note}
        instrument={[
          { label: "Network", value: deployments.network?.name ?? "not deployed" },
          { label: "Vault", value: mandate.vault },
          { label: "Mandate", value: mandate.mandateHash },
          { label: "Journal topic", value: JOURNAL_TOPIC_ID || "(unset)" },
        ]}
      />

      <Threat specimens={scenarios} />

      <SystemSpine />

      <DemoStage subject={subject} />

      <CertificateBand
        facts={{
          className: shares.shareClass.name,
          token: shares.shareClass.token,
          vault: mandate.vault,
          mandateHash: mandate.mandateHash,
          mandateSeq: mandate.seq,
          mandateTopic: MANDATE_TOPIC || mandate.topicId,
          terms: mandateSentence(mandate),
          supply: supply.toLocaleString("en-US"),
          navPerShare:
            "$" + Number(shares.shareClass.navPerShare).toFixed(4),
          refusals,
          approved,
          breaches,
          frozen: shares.shareClass.frozen,
          frozenReason: shares.shareClass.frozenReason,
          sharesLive: sharesSrc.live,
          sharesNote: sharesSrc.note,
          mandateLive: mandateSrc.live,
        }}
      />

      <Enforcement
        covenants={covenants}
        live={covenantsSrc.live}
        note={covenantsSrc.note}
      />

      <Close
        validatorLive={VALIDATOR_URL.length > 0}
        network={deployments.network?.name ?? "no network"}
        chainId={deployments.network?.chainId ?? 0}
        parties={parties}
      />
    </>
  );
}
