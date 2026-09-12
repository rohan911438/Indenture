import Link from "next/link";
import { Shell } from "@/components/ui/Shell";
import { Rule } from "@/components/ui/Rule";

export default function NotFound() {
  return (
    <Shell className="py-24" as="div">
      <div className="max-w-deed">
        <Rule weight="refusal" className="w-16" />
        <h1 className="heading mt-8 text-signal">
          No such clause in this indenture.
        </h1>
        <p className="mt-6 text-slate-lit">
          That address is not one of the five pages this site has. The mandate,
          the journal, the wall of blocked attempts and the share class are all
          below.
        </p>
        <nav className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
          <Link href="/" className="link font-sans text-meta text-brass">
            The prospectus
          </Link>
          <Link href="/mandate" className="link font-sans text-meta text-slate-lit">
            The mandate
          </Link>
          <Link href="/journal" className="link font-sans text-meta text-slate-lit">
            The journal
          </Link>
          <Link href="/blocked" className="link font-sans text-meta text-slate-lit">
            Blocked attempts
          </Link>
          <Link href="/shares" className="link font-sans text-meta text-slate-lit">
            The share class
          </Link>
        </nav>
      </div>
    </Shell>
  );
}
