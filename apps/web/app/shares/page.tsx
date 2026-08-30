import { deployments } from "@/lib/deployments";

export const revalidate = 10;

/**
 * The ERC-3643 share class: supply, holders, and whether the class is currently
 * FROZEN because MandatePolicy.inBreach() is true (via MandateComplianceModule).
 */
export default async function Shares() {
  const token = deployments.ats?.SecurityToken ?? "";

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-2xl font-bold">Shares</h1>
      <p className="text-neutral-400">
        ERC-3643 security token {token || "(unset)"}. A portfolio breach freezes
        transfers and redemptions for the whole class until the mandate is back
        in compliance.
      </p>
      <dl className="grid grid-cols-2 gap-2 max-w-sm">
        <dt className="text-neutral-500">Status</dt>
        <dd>STUB &mdash; wire to MandatePolicy.inBreach()</dd>
        <dt className="text-neutral-500">Total supply</dt>
        <dd>&mdash;</dd>
        <dt className="text-neutral-500">Holders</dt>
        <dd>&mdash;</dd>
        <dt className="text-neutral-500">NAV / share</dt>
        <dd>&mdash;</dd>
      </dl>
    </div>
  );
}
