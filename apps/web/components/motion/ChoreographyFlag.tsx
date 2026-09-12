/**
 * Marks the document as animated BEFORE first paint.
 *
 * The choreography hides elements it is about to reveal. If that hiding were
 * applied from an effect, the server HTML would paint visible, blink out, then
 * animate — so the decision is made by a tiny blocking script in the document
 * instead, from the reader's own motion preference.
 *
 * The 3s timer is the safety net: if the GSAP chunk never arrives, or throws,
 * the class is dropped and the page is simply readable. Hidden content with no
 * animation coming is the one failure this must not have.
 */
const FLAG = `try{
if(matchMedia('(prefers-reduced-motion: no-preference)').matches){
var h=document.documentElement;h.classList.add('choreographed');
setTimeout(function(){h.classList.remove('choreographed')},3000);}
}catch(e){}`;

export function ChoreographyFlag() {
  return <script dangerouslySetInnerHTML={{ __html: FLAG }} />;
}
