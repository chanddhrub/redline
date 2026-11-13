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

const ACTION = (
  <div className="mt-8">
    <Link href="/review" className="slug px-5 py-3 text-[0.9375rem]">
      <span>Read your document</span>
    </Link>
    <p className="mt-3 max-w-[46ch] text-[0.875rem] leading-relaxed text-soft">
      PDF, Word or pasted text. Your file is read in your browser and never
      uploaded. The contract shown here is a sample, so you can see the shape
      of it before you hand over your own.
    </p>
    <a href="#receipt" className="mark mt-3 inline-block underline">
      What a clean document returns
    </a>
  </div>
);

/** Section headings: large, plain, and set tight. One size for the page's
 *  three middle sections, so the hero is the only thing that shouts. */
const SECTION_HEAD =
  "max-w-[22ch] text-balance text-[1.875rem] font-bold leading-[1.1] tracking-[-0.02em] text-graphite sm:text-[2.5rem] lg:text-[3rem]";

export default function Home() {
  return (
    <div className="calm min-h-screen overflow-x-clip">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <div className="flex items-baseline gap-4">
            <span className="text-[1.25rem] font-bold tracking-[-0.015em] text-graphite">
              Redline
            </span>
            <span className="hidden text-[0.875rem] text-soft sm:inline">
              Read it before you sign it
            </span>
          </div>
          <div className="flex items-baseline gap-5">
            <HomeAccount />
            <Link href="/review" className="mark">
              Read your document
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <main>
        <section className="mx-auto max-w-[80rem] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
          <Inspector
            lead={
              <div>
                <h1 className="max-w-[16ch] text-balance text-[2.5rem] font-bold leading-[1.02] tracking-[-0.035em] text-graphite sm:text-[3.5rem] lg:text-[4.5rem]">
                  Every flag shows its sentence
                </h1>
                <p className="mt-6 max-w-[60ch] text-[1.125rem] leading-relaxed text-graphite sm:text-[1.25rem]">
                  Upload an offer letter, non-compete or IP assignment before you
                  sign. Redline ranks what could hurt you by how hard it is to
                  escape, and quotes the exact sentence every flag came from — so
                  you can hold our claim against your own contract and settle it
                  yourself.{" "}
                  <strong className="font-semibold">
                    A flag we cannot quote is a flag you never see.
                  </strong>
                </p>
                <div className="lg:hidden">{ACTION}</div>
              </div>
            }
            action={
              <div id="start" className="hidden scroll-mt-6 lg:block">
                {ACTION}
              </div>
            }
          />
        </section>

        {/* ── Coverage receipt ───────────────────────────────────────── */}
        <section id="receipt" className="border-y border-rule bg-wash">
          <div className="mx-auto max-w-[80rem] px-5 py-20 sm:px-8">
            <h2 className={SECTION_HEAD}>When nothing is wrong, you still get a receipt</h2>

            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
              <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-graphite sm:text-[1.125rem]">
                A clean document does not return an empty screen, and it never
                returns a small finding invented to fill the space. It returns the
                clause types we checked, what we found in each, and a plain
                statement of what we did not review. “No flags” is not the same
                sentence as “safe to sign”, and the receipt exists so the two are
                never read as one.
              </p>

              <div className="border border-rule bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
                  <p className="text-[0.9375rem] font-bold text-graphite">What was checked</p>
                  <p className="text-[0.8125rem] text-soft">Clean document</p>
                </div>
                <dl>
                  {CLEAN_RECEIPT.map((row) => (
                    <div
                      key={row.type}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-4 py-3"
                    >
                      <dt className="text-[0.9375rem] text-graphite">{row.type}</dt>
                      <dd className="text-[0.8125rem] font-semibold text-soft">{row.finding}</dd>
                    </div>
                  ))}
                </dl>
                <p className="px-4 py-3 text-[0.875rem] leading-relaxed text-soft">
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
        <section className="mx-auto max-w-[80rem] px-5 py-20 sm:px-8">
          <h2 className={SECTION_HEAD}>Where you work changes what a clause is worth</h2>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
            <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-graphite sm:text-[1.125rem]">
              Redline asks which state you work in, and says why before it asks.
              Enforceability then sits beside the flag on a screened panel,
              labelled as not coming from your document, and it never quietly
              changes a flag’s severity. The flag is about your contract. This is
              about your state. Keeping the two apart is the only way either one
              stays worth trusting.
            </p>

            <div>
              {/* The document speaking: cream and the serif, as in the app. */}
              <div className="border border-rule bg-quote">
                <p className="px-4 pt-2.5 text-[0.75rem] font-semibold text-soft">
                  CR-1 · Non-compete · from your document
                </p>
                <p className="document px-4 pb-3 pt-1.5 text-[1rem] leading-relaxed text-graphite">
                  “…for a period of eighteen (18) months following the termination
                  of your employment for any reason…”
                </p>
              </div>

              {/* Redline speaking about the world: white, dashed, screened. */}
              <div className="mt-3 border border-dashed border-soft bg-white">
                <p className="border-b border-dashed border-soft px-4 py-2 text-[0.8125rem] font-semibold text-graphite">
                  Not from your document · general context for California
                </p>
                <div className="flex items-stretch">
                  <div
                    className="halftone w-9 shrink-0 border-r border-dashed border-soft"
                    aria-hidden="true"
                  />
                  <p className="px-4 py-3 text-[0.9375rem] leading-relaxed text-graphite">
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
        <section className="border-t border-rule">
          <div className="mx-auto max-w-[80rem] px-5 py-20 sm:px-8">
            <h2 className={SECTION_HEAD}>What Redline refuses to do</h2>
            <p className="mt-5 max-w-[64ch] text-[1.0625rem] leading-relaxed text-soft sm:text-[1.125rem]">
              Every one of these costs us something. They are written down here
              rather than discovered later.
            </p>

            <dl className="mt-10 border-t border-graphite">
              {REFUSALS.map((row) => (
                <div
                  key={row.what}
                  className="grid gap-2 border-b border-rule py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12"
                >
                  <dt className="text-[1.125rem] font-semibold leading-snug text-graphite sm:text-[1.25rem]">
                    {row.what}
                  </dt>
                  <dd className="max-w-[64ch] text-[1rem] leading-relaxed text-soft sm:text-[1.0625rem]">
                    {row.why}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="close-band">
          <div className="mx-auto max-w-[80rem] px-5 py-20 sm:px-8">
            <h2 className="max-w-[20ch] text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[2.75rem] lg:text-[3.5rem]">
              You can negotiate. You just need to know what to ask for.
            </h2>
            <p className="mt-6 max-w-[64ch] text-[1.0625rem] leading-relaxed text-[#d9dde2] sm:text-[1.125rem]">
              An offer letter is one of the few documents you are handed that is
              genuinely open to being changed. Redline shows you which sentences
              are worth pushing on, and drafts the language to send back.
            </p>
            <Link href="/review" className="slug slug-light mt-8 px-5 py-3 text-[0.9375rem]">
              <span>Read your document</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[80rem] px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[62ch] text-[0.875rem] leading-relaxed text-soft">
            <strong className="font-semibold text-graphite">Not legal advice.</strong>{" "}
            Redline reads a document and shows you what it says. Enforceability
            information, where shown, is general context about your state,
            labelled as not coming from your document, and it is not a substitute
            for a lawyer.
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-soft">
            Your file is parsed in your browser.
            <br />
            Only the text is kept — never the file.
          </p>
        </div>
      </footer>
    </div>
  );
}
