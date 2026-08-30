export default function Prospectus() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">The Prospectus</h1>
      <p className="text-neutral-300">
        Indenture is a compliance-enforced, AI-managed investment fund on Hedera.
        An untrusted AI agent proposes trades; a separate Validator independently
        re-derives every fact from source and cryptographically signs only trades
        that satisfy the fund&apos;s mandate &mdash; or refuses. A final on-chain
        Uniswap v4 hook re-checks fixed covenants before any swap executes.
      </p>
      <ul className="list-disc pl-6 text-neutral-400 space-y-1">
        <li>Even a fully compromised AI cannot move funds outside the mandate.</li>
        <li>Even a compromised Validator signature is caught by the on-chain hook.</li>
        <li>Every approval and every refusal is journaled to Hedera Consensus Service.</li>
      </ul>
      <p className="text-neutral-500">
        This page is static-ish: it reads only from the mirror node + RPC. There
        are no API routes.
      </p>
    </div>
  );
}
