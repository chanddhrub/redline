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
    <a href="#inspector" className="slug label">
      <span>Try it on your document</span>
      <span className="slug-hatch hatch" aria-hidden="true" />
    </a>
    <p className="mt-3 max-w-[46ch] font-voice text-sm leading-relaxed text-burnt">
      Intake is not open yet. Everything above is running live on the sample
      contract shown here, not on a document of yours.
    </p>
    <a
      href="#receipt"
      className="label mt-4 inline-block text-burnt underline decoration-2 hover:text-ink"
    >
      What a clean document returns
    </a>
  </div>
);

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-spot">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-[92rem] items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <div className="flex items-baseline gap-4">
          <span className="display border-2 border-ink px-3 py-1.5 text-2xl tracking-tight">
            Redline
          </span>
          <span className="label hidden text-burnt sm:inline">
            Read it before you sign it
          </span>
        </div>
        <a href="#start" className="label underline decoration-2 hover:bg-ink hover:text-spot">
          Try it
        </a>
      </header>

      <div className="h-0.5 bg-ink" />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <main>
        <section className="mx-auto max-w-[92rem] overflow-hidden px-5 pt-10 pb-16 sm:px-8 sm:pt-12">
          <Inspector
            lead={
              <div>
                <h1 className="display tilted text-[2.5rem] sm:text-[4.2rem] lg:text-[7.5rem]">
                  Every flag
                  <br />
                  shows its
                  <br />
                  sentence
                </h1>
                <div className="tilted mt-5 h-[3px] w-full bg-ink" />
                <p className="mt-8 max-w-[62ch] font-voice text-lg leading-relaxed sm:text-xl lg:max-w-[41rem]">
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
        <section id="receipt" className="bg-ink text-paper">
          <div className="on-ink mx-auto max-w-[92rem] px-5 py-20 sm:px-8">
            <h2 className="display max-w-[20ch] text-[1.9rem] text-spot sm:text-[3rem] lg:text-[4rem]">
              When nothing is wrong, you still get a receipt
            </h2>

            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
              <p className="max-w-[68ch] font-voice text-lg leading-relaxed">
                A clean document does not return an empty screen, and it never
                returns a small finding invented to fill the space. It returns the
                clause types we checked, what we found in each, and a plain
                statement of what we did not review. “No flags” is not the same
                sentence as “safe to sign”, and the receipt exists so the two are
                never read as one.
              </p>

              <div className="border-2 border-paper">
                <p className="label border-b-2 border-paper bg-paper px-4 py-2 text-ink">
                  Coverage receipt · clean document
                </p>
                <dl className="px-4 py-2">
                  {CLEAN_RECEIPT.map((row) => (
                    <div
                      key={row.type}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-paper/35 py-3 last:border-b-0"
                    >
                      <dt className="font-voice text-[0.9375rem] font-semibold">
                        {row.type}
                      </dt>
                      <dd className="label text-spot">{row.finding}</dd>
                    </div>
                  ))}
                </dl>
                <p className="border-t-2 border-paper px-4 py-3 font-voice text-sm leading-relaxed text-paper/85">
                  <span className="label text-spot">Not reviewed · </span>
                  anything outside these four clause types, and any clause that is
                  missing from the document. An absence has no sentence to quote,
                  so Redline cannot flag it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── The second layer ───────────────────────────────────────── */}
        <section className="mx-auto max-w-[92rem] px-5 py-20 sm:px-8">
          <h2 className="display max-w-[24ch] text-[1.9rem] sm:text-[3rem] lg:text-[4rem]">
            Where you work changes what a clause is worth
          </h2>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
            <p className="max-w-[68ch] font-voice text-lg leading-relaxed">
              Redline asks which state you work in, and says why before it asks.
              Enforceability then sits beside the flag on a screened panel,
              labelled as not coming from your document, and it never quietly
              changes a flag’s severity. The flag is about your contract. This is
              about your state. Keeping the two apart is the only way either one
              stays worth trusting.
            </p>

            <div>
              <div className="border-2 border-ink bg-paper">
                <p className="label border-b-2 border-ink px-4 py-2">
                  CR-1 · Non-compete · from your document
                </p>
                <p className="document px-4 py-3 text-[0.9375rem] leading-relaxed">
                  “…for a period of eighteen (18) months following the termination
                  of your employment for any reason…”
                </p>
              </div>

              <div className="mt-3 border-2 border-dashed border-ink bg-paper">
                <p className="label border-b-2 border-dashed border-ink px-4 py-2">
                  Not from your document · general context for California
                </p>
                <div className="flex items-stretch">
                  <div
                    className="halftone w-9 shrink-0 border-r-2 border-dashed border-ink"
                    aria-hidden="true"
                  />
                  <p className="px-4 py-3 font-voice text-[0.9375rem] leading-relaxed">
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
        <section className="border-t-2 border-ink">
          <div className="mx-auto max-w-[92rem] px-5 py-20 sm:px-8">
            <h2 className="display text-[1.9rem] sm:text-[3rem] lg:text-[4rem]">
              What Redline refuses to do
            </h2>
            <p className="mt-6 max-w-[68ch] font-voice text-lg leading-relaxed">
              Every one of these costs us something. They are written down here
              rather than discovered later.
            </p>

            <dl className="mt-10 border-t-2 border-ink">
              {REFUSALS.map((row) => (
                <div
                  key={row.what}
                  className="grid gap-2 border-b border-ink/40 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12"
                >
                  <dt className="display text-xl sm:text-2xl">
                    {row.what}
                  </dt>
                  <dd className="max-w-[68ch] font-voice text-[1.0625rem] leading-relaxed text-burnt">
                    {row.why}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="bg-ink text-paper">
          <div className="on-ink mx-auto max-w-[92rem] px-5 py-20 sm:px-8">
            <h2 className="display max-w-[18ch] text-[2.2rem] text-spot sm:text-[3.4rem] lg:text-[5rem]">
              You can negotiate. You just need to know what to ask for.
            </h2>
            <p className="mt-8 max-w-[68ch] font-voice text-lg leading-relaxed">
              An offer letter is one of the few documents you are handed that is
              genuinely open to being changed. Redline shows you which sentences
              are worth pushing on, and drafts the language to send back.
            </p>
            <a
              href="#inspector"
              className="slug label mt-9 border-paper bg-paper text-ink hover:bg-spot hover:text-ink"
            >
              <span>Try it on your document</span>
              <span className="slug-hatch hatch opacity-40" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[92rem] px-5 py-12 sm:px-8">
        <div className="h-0.5 bg-ink" />
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[62ch] font-voice text-sm leading-relaxed text-burnt">
            <strong className="font-semibold text-ink">Not legal advice.</strong>{" "}
            Redline reads a document and shows you what it says. Enforceability
            information, where shown, is general context about your state,
            labelled as not coming from your document, and it is not a substitute
            for a lawyer.
          </p>
          <p className="label text-burnt">
            Your file is parsed in your browser.
            <br />
            Only the text is kept — never the file.
          </p>
        </div>
      </footer>
    </div>
  );
}
