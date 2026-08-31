export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy>
      <div className="h-3 w-32 bg-hairline" />
      <div className="h-7 w-11/12 bg-hairline" />
      <div className="h-7 w-3/4 bg-hairline" />
      <div className="mt-6 h-20 w-full bg-hairline" />
      <p className="font-mono text-xs text-slate">
        Reading from the Hedera mirror node…
      </p>
    </div>
  );
}
