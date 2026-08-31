import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
        404
      </p>
      <h1 className="mt-4 font-serif text-[26px] leading-snug text-signal">
        No such clause in this indenture.
      </h1>
      <Link
        href="/"
        className="mt-4 inline-block font-sans text-sm text-brass hover:underline"
      >
        Back to the mandate →
      </Link>
    </div>
  );
}
