import { SplitLines } from "@/components/motion/SplitLines";
import { Rule } from "@/components/ui/Rule";
import { mandateSentence } from "@/lib/format";
import type { MandateView } from "@/lib/data";

/**
 * The mandate as one sentence, built from the compiled covenant values.
 *
 * The numbers are no longer picked out in italic brass inside the sentence.
 * Accenting a word or two inside a headline is decoration wearing the clothes
 * of emphasis, and it was making four load-bearing figures harder to compare,
 * not easier. They are set plainly here and given their own register below,
 * where they can be tabular and measured against their live values.
 */
export function MandateHero({ mandate }: { mandate: MandateView }) {
  return (
    <div>
      <SplitLines
        as="h1"
        className="heading max-w-[22ch] text-signal"
        stagger={0.07}
      >
        {mandateSentence(mandate)}
      </SplitLines>
      <Rule weight="covenant" className="mt-8 w-24" />
    </div>
  );
}
