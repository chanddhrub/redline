import Link from "next/link";

import { HomeAccount } from "./_components/home-account";
import { Inspector } from "./_demo/inspector";

const REFUSALS = [
  {
    what: "Scanned or photographed documents",
    why: "Refused, not processed. A sentence misread on the way in is worse than no sentence at all, because it still looks checkable. OCR is excluded permanently, not deferred.",
  },
  {
    what: "A verdict on whether to sign",
    why: "Never. Redline reads the document and shows you what it says. You have the rest of your situation; we have four clause types and a text file.",
  },
  {
    what: "Flags we cannot quote",
    why: "Dropped before they reach you. That costs recall deliberately — a risk we cannot anchor to a sentence is not softened into an unsourced note.",
  },
  {
    what: "Legal advice",
    why: "Not what this is. Enforceability information is general context about your state, labelled as such, and no substitute for a lawyer.",
  },
  {
    what: "Leases, freelance contracts, terms of service",
    why: "Out of scope. This version reads offer letters, non-competes and IP assignments, and tunes four clause types to the people who sign them.",
  },
];

const CLEAN_RECEIPT = [
  { type: "Non-compete / non-solicit", finding: "No clause found" },
  { type: "Mandatory arbitration and class-action waiver", finding: "No clause found" },
  { type: "IP assignment and moonlighting restrictions", finding: "Present, within ordinary scope" },
  { type: "Equity vesting, clawback and bonus repayment", finding: "Present, prorated — no finding" },
];

/** The page's one heading voice: heavy, tight, and set in two tones — the
 *  claim in near-black, the reason in grey. */
const STATEMENT =
  "max-w-[24ch] text-balance text-[2rem] font-[650] leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]";

function Actions({ centred = false }: { centred?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2 ${centred ? "justify-center" : ""}`}>
      <Link href="/review" className="slug h-12 px-6 text-[1rem]">
        <span>Read your document</span>
      </Link>
      <a href="#sample" className="slug slug-quiet h-12 px-6 text-[1rem]">
        <span>See a sample</span>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </a>
    </div>
  );
}

export default function Home() {
  return (
    <div className="calm min-h-screen overflow-x-clip">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-rule bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-[1.25rem] font-[700] tracking-[-0.03em] text-graphite">
              Redline
            </Link>
            <nav
              aria-label="On this page"
              className="hidden items-center gap-6 text-[0.9375rem] font-medium text-graphite md:flex"
            >
              <a href="#sample" className="hover:text-soft">
                How it works
              </a>
              <a href="#receipt" className="hover:text-soft">
                Clean documents
              </a>
              <a href="#refuses" className="hover:text-soft">
                What it refuses
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <HomeAccount />
            {/* Wrapped, because the button's own display rule outranks a
                utility on the same element; the hero carries it on a phone. */}
            <span className="hidden sm:block">
              <Link href="/review" className="slug">
                <span>Read your document</span>
              </Link>
            </span>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[72rem] px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28">
          <h1 className="mx-auto max-w-[14ch] text-balance text-[2.75rem] font-[650] leading-[0.98] tracking-[-0.045em] text-graphite sm:text-[4.25rem] lg:text-[5.25rem]">
            Every flag shows its sentence.
          </h1>
          <p className="mx-auto mt-7 max-w-[44ch] text-balance text-[1.125rem] leading-relaxed text-soft sm:text-[1.25rem]">
            Read an offer letter, non-compete or IP assignment before you sign.
            Every clause that could hurt you comes with the exact sentence it
            came from.
          </p>
          <div className="mt-9">
            <Actions centred />
          </div>
          <p className="mt-4 text-[0.875rem] text-soft">
            PDF, Word or pasted text. Read in your browser, never uploaded.
          </p>
        </section>

        {/* ── The product, framed ────────────────────────────────────── */}
        <section id="sample" className="scroll-mt-20 px-3 sm:px-6">
          <div className="mx-auto max-w-[80rem] rounded-[2rem] bg-wash p-3 sm:p-6 lg:p-8">
            <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,20,0.06),0_12px_32px_rgba(20,20,20,0.06)] sm:p-8 lg:p-10">
              <Inspector />
            </div>
          </div>
        </section>

        {/* ── The standard, in one line ──────────────────────────────── */}
        <section className="mx-auto max-w-[72rem] px-5 pb-8 pt-28 sm:px-8 sm:pt-36">
          <p className={STATEMENT}>
            <span className="text-graphite">A flag we cannot quote is a flag you never see. </span>
            <span className="text-[#757575]">
              Redline ranks what could hurt you by how hard it is to escape, and
              holds every claim against your own contract before showing it.
            </span>
          </p>
        </section>

        {/* ── Coverage receipt ───────────────────────────────────────── */}
        <section id="receipt" className="mx-auto max-w-[72rem] scroll-mt-20 px-5 py-20 sm:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className={STATEMENT}>
                <span className="text-graphite">When nothing is wrong, </span>
                <span className="text-[#757575]">you still get a receipt.</span>
              </h2>
              <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-relaxed text-soft">
                A clean document does not return an empty screen, and it never
                returns a small finding invented to fill the space. It returns the
                clause types we checked, what we found in each, and a plain
                statement of what we did not review. “No flags” is not the same
                sentence as “safe to sign”, and the receipt exists so the two are
                never read as one.
              </p>
            </div>

            <div className="rounded-[1.75rem] bg-wash p-3 sm:p-4">
              <div className="overflow-hidden rounded-[1.25rem] bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-2 pt-5">
                  <p className="text-[1rem] font-semibold text-graphite">What was checked</p>
                  <p className="text-[0.8125rem] text-soft">Clean document</p>
                </div>
                <dl className="px-5">
                  {CLEAN_RECEIPT.map((row) => (
                    <div
                      key={row.type}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-3.5"
                    >
                      <dt className="text-[0.9375rem] text-graphite">{row.type}</dt>
                      <dd className="text-[0.8125rem] font-medium text-soft">{row.finding}</dd>
                    </div>
                  ))}
                </dl>
                <p className="px-5 py-4 text-[0.875rem] leading-relaxed text-soft">
                  <span className="font-semibold text-graphite">Not reviewed: </span>
                  anything outside these four clause types, and any clause that is
                  missing from the document. An absence has no sentence to quote,
                  so Redline cannot flag it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── The second layer ───────────────────────────────────────── */}
        <section className="mx-auto max-w-[72rem] px-5 py-20 sm:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className={STATEMENT}>
                <span className="text-graphite">Where you work </span>
                <span className="text-[#757575]">changes what a clause is worth.</span>
              </h2>
              <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-relaxed text-soft">
                Redline asks which state you work in, and says why before it asks.
                Enforceability then sits beside the flag on a screened panel,
                labelled as not coming from your document, and it never quietly
                changes a flag’s severity. The flag is about your contract. This is
                about your state. Keeping the two apart is the only way either one
                stays worth trusting.
              </p>
            </div>

            <div className="rounded-[1.75rem] bg-wash p-3 sm:p-4">
              {/* The document speaking: cream and the serif, as in the app. */}
              <div className="overflow-hidden rounded-[1.25rem] bg-quote">
                <p className="px-5 pt-4 text-[0.75rem] font-semibold text-soft">
                  CR-1 · Non-compete · from your document
                </p>
                <p className="document px-5 pb-4 pt-1.5 text-[1.0625rem] leading-relaxed text-graphite">
                  “…for a period of eighteen (18) months following the termination
                  of your employment for any reason…”
                </p>
              </div>

              {/* Redline speaking about the world: white, dashed, screened. */}
              <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-dashed border-soft bg-white">
                <p className="border-b border-dashed border-soft px-5 py-2.5 text-[0.8125rem] font-semibold text-graphite">
                  Not from your document · general context for California
                </p>
                <div className="flex items-stretch">
                  <div
                    className="halftone w-9 shrink-0 border-r border-dashed border-soft"
                    aria-hidden="true"
                  />
                  <p className="px-5 py-4 text-[0.9375rem] leading-relaxed text-graphite">
                    California generally does not enforce employee non-competes.
                    This does not change the sentence above, and it does not
                    change its severity — the clause still says what it says.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What Redline refuses ───────────────────────────────────── */}
        <section id="refuses" className="mx-auto max-w-[72rem] scroll-mt-20 px-5 py-20 sm:px-8">
          <h2 className={STATEMENT}>
            <span className="text-graphite">What Redline refuses to do. </span>
            <span className="text-[#757575]">
              Every one costs us something, so it is written down here.
            </span>
          </h2>

          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REFUSALS.map((row) => (
              <li key={row.what} className="rounded-[1.5rem] bg-wash p-6 sm:p-7">
                <h3 className="text-[1.125rem] font-semibold leading-snug tracking-[-0.01em] text-graphite">
                  {row.what}
                </h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-[#5c5c5c]">{row.why}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[72rem] px-5 pb-28 pt-16 text-center sm:px-8 sm:pt-24">
          <h2 className="mx-auto max-w-[16ch] text-balance text-[2.5rem] font-[650] leading-[1.02] tracking-[-0.04em] sm:text-[3.5rem]">
            <span className="text-graphite">You can negotiate. </span>
            <span className="text-[#757575]">You just need to know what to ask for.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[48ch] text-balance text-[1.0625rem] leading-relaxed text-soft">
            An offer letter is one of the few documents you are handed that is
            genuinely open to being changed. Redline shows you which sentences
            are worth pushing on, and drafts the language to send back.
          </p>
          <div className="mt-9">
            <Actions centred />
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <p className="text-[1rem] font-[700] tracking-[-0.03em] text-graphite">Redline</p>
            <p className="mt-2 max-w-[56ch] text-[0.875rem] leading-relaxed text-soft">
              <strong className="font-semibold text-graphite">Not legal advice.</strong>{" "}
              Redline reads a document and shows you what it says. Enforceability
              information, where shown, is general context about your state,
              labelled as not coming from your document, and it is not a
              substitute for a lawyer.
            </p>
          </div>
          <p className="text-[0.875rem] leading-relaxed text-soft">
            Your file is parsed in your browser.
            <br />
            Only the text is kept — never the file.
          </p>
        </div>
      </footer>
    </div>
  );
}
