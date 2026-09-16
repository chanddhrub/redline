/**
 * The starting set for the labelled second layer (ADR 0005, PRD §6.6).
 *
 * **This is not a maintained legal corpus, and nothing here pretends to be
 * one.** It is a small set of positions that are written into a statute, apply
 * to employees rather than to a category a court has to decide you fall into,
 * and have held still long enough to be worth stating plainly. Everything else
 * is absent on purpose.
 *
 * Absent means absent. Where there is no entry for a state and a topic, the
 * reader is shown nothing — not "this varies by state", which is the hedged
 * sentence ADR 0004 rules out, and not a softened version of a position we are
 * unsure of. A reader shown nothing here has lost nothing they could have
 * checked; a reader shown a hedge has been given something that reads like
 * knowledge and is not.
 *
 * **What is deliberately empty**
 *
 * - **Equity vesting, clawback and signing-bonus repayment, in every state.**
 *   There is no statute to point at. Whether a repayment clause survives turns
 *   on wage-deduction law, on how the payment was characterised, and on facts
 *   a contract does not settle, and the honest summary of that is a paragraph
 *   of qualifications rather than a position. So this layer says nothing about
 *   it, and the flag still says what the sentence says.
 * - **Arbitration beyond two entries.** Several states have tried to restrict
 *   employment arbitration and been held preempted by the Federal Arbitration
 *   Act in whole or in part. Stating a ban a federal court has already
 *   disapplied would be worse than silence.
 * - **Forty-odd states on non-competes.** Most of them apply a reasonableness
 *   test, which produces an answer only against facts. The entries below are
 *   the states whose answer is in the statute.
 *
 * **Staleness.** ADR 0005 accepts that this set goes out of date silently.
 * `asOf` on every entry is what makes the silence visible: it is printed
 * beside the note, so a reader can see how old the statement they are being
 * asked to weigh actually is. Nothing in the code refreshes it, and nothing
 * should pretend to.
 *
 * Written 2026-09-16. Every `basis` names the statute or the case, so it can
 * be looked up rather than taken on ours.
 */

import type { UsState } from "../intake/analysis-request";
import type { ClauseType } from "../model/payloads";

/**
 * What a note is about. The four clause types, plus the one topic that is not
 * a clause type: what the reader's own state does with a contract that picks
 * another state's law. That question only arises because the document has a
 * governing-law sentence, and the answer to it is not a reading of that
 * sentence, so it belongs in this layer rather than beside the quote.
 */
export type EnforceabilityTopic = ClauseType | "governing-law";

export interface SetEntry {
  readonly topic: EnforceabilityTopic;
  /** The states this holds in. `"every-state"` is for federal law, which does
   *  not stop at a state line and is not made state-specific by pretending
   *  fifty entries were checked one at a time. */
  readonly states: readonly UsState[] | "every-state";
  /** Reader-facing. Archivo, never Tinos: these are not their document's
   *  words, and the panel says so. */
  readonly statement: string;
  /** Where it came from, in enough detail to go and look. */
  readonly basis: string;
  /** ISO date this basis was last checked. */
  readonly asOf: string;
}

/** The date the set below was written, recorded once so a reader of the file
 *  sees the age of the whole thing and not only of a line. */
export const SET_WRITTEN = "2026-09-16";

const INVENTION_CARVE_OUT =
  "State law here carves your own inventions out of an assignment clause. Anything you made on your own time, without the employer's equipment, supplies, facilities or confidential information, that does not relate to their business or to research they had actually started or planned, and that did not come out of work you did for them, stays yours. Wording in the contract cannot reach it.";

export const ENFORCEABILITY_SET: readonly SetEntry[] = [
  /* ── Non-compete and non-solicit ──────────────────────────────────── */
  {
    topic: "non-compete",
    states: ["California"],
    statement:
      "California voids employee non-compete clauses, whatever the contract says and wherever it was signed. Since 2024 an employer who tries to enforce one against you here is breaking the law, and you can sue them for doing it.",
    basis:
      "Cal. Bus. & Prof. Code §16600 and §16600.5 (SB 699, in force 1 January 2024)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["North Dakota"],
    statement:
      "North Dakota voids a contract that stops you carrying on your trade or profession. The exceptions are about selling a business or leaving a partnership, not about taking another job.",
    basis: "N.D. Cent. Code §9-08-06",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["Oklahoma"],
    statement:
      "Oklahoma voids a clause that stops you working for a competitor. One thing survives it: a clause barring you from directly soliciting the sale of goods or services to the employer's established customers.",
    basis: "15 Okla. Stat. §219A",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["Minnesota"],
    statement:
      "Minnesota voids employee non-compete clauses agreed on or after 1 July 2023. One signed before that date is not covered by the ban, so the date on your agreement matters.",
    basis: "Minn. Stat. §181.988 (2023)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["Washington"],
    statement:
      "Washington will not enforce a non-compete against an employee earning under a threshold that the Department of Labor & Industries resets every year, and it will not enforce one running longer than eighteen months after you leave. If you were laid off, an employer can only enforce it by paying your base salary for the whole restricted period.",
    basis: "RCW 49.62.020",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["Colorado"],
    statement:
      "Colorado voids a non-compete unless you earn above a highly-compensated threshold the Division of Labor resets every year and the clause is there to protect a trade secret. The employer also has to hand you the clause in a separate signed notice before you accept the job.",
    basis: "C.R.S. §8-2-113, as amended by HB 22-1317 (2022)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "non-compete",
    states: ["Texas"],
    statement:
      "Texas enforces a non-compete that came attached to something else the employer gave you, such as confidential information, and that is reasonable in how long it lasts, how far it reaches and what work it covers. If a court finds one too broad, the statute tells it to narrow the clause and enforce what is left rather than throw it out. Whether any particular clause is reasonable is a question a court answers on the facts.",
    basis: "Tex. Bus. & Com. Code §§15.50–15.51",
    asOf: SET_WRITTEN,
  },

  /* ── Mandatory arbitration and class-action waiver ────────────────── */
  {
    topic: "arbitration",
    states: "every-state",
    statement:
      "An arbitration clause signed before a dispute cannot be forced on you for a claim of sexual assault or sexual harassment. Federal law lets you take that kind of claim to court instead, and the choice is yours, whatever this contract says.",
    basis:
      "9 U.S.C. §§401–402 (Ending Forced Arbitration of Sexual Assault and Sexual Harassment Act of 2021)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "arbitration",
    states: ["California"],
    statement:
      "California courts hold an employment arbitration clause to a minimum before enforcing it: a neutral arbitrator, enough discovery to prove your case, a written decision, every remedy a court could have given you, and no arbitration cost you would not have paid in court. A clause that falls short of that can be refused as unconscionable, though it is a court that decides, on the clause in front of it.",
    basis:
      "Armendariz v. Foundation Health Psychcare Services, 24 Cal. 4th 83 (2000)",
    asOf: SET_WRITTEN,
  },

  /* ── IP assignment and moonlighting restrictions ──────────────────── */
  {
    topic: "ip-assignment",
    states: ["California"],
    statement: `${INVENTION_CARVE_OUT} California also requires the employer to tell you in writing that the clause does not reach those inventions.`,
    basis: "Cal. Lab. Code §§2870 and 2872",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Washington"],
    statement: INVENTION_CARVE_OUT,
    basis: "RCW 49.44.140",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Illinois"],
    statement: INVENTION_CARVE_OUT,
    basis: "765 ILCS 1060/2 (Employee Patent Act)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Delaware"],
    statement: INVENTION_CARVE_OUT,
    basis: "19 Del. C. §805",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Kansas"],
    statement: INVENTION_CARVE_OUT,
    basis: "K.S.A. §44-130",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Minnesota"],
    statement: INVENTION_CARVE_OUT,
    basis: "Minn. Stat. §181.78",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["North Carolina"],
    statement: INVENTION_CARVE_OUT,
    basis: "N.C. Gen. Stat. §66-57.1",
    asOf: SET_WRITTEN,
  },
  {
    topic: "ip-assignment",
    states: ["Utah"],
    statement:
      "Utah law stops an assignment clause reaching an invention you created entirely on your own time that is not an employment invention: one made outside the scope of your job, not tied to the employer's business or to a business they had planned, and not made with their resources. So far as the clause reaches those, it is unenforceable.",
    basis: "Utah Code §34-39-3 (Employment Inventions Act)",
    asOf: SET_WRITTEN,
  },

  /* ── What the reader's state does with a governing-law clause ─────── */
  {
    topic: "governing-law",
    states: ["California"],
    statement:
      "Picking another state's law does not carry a California employee out of California's non-compete ban. Since 2024 the ban applies however the contract was written, wherever it was signed, and whichever state's law it names.",
    basis: "Cal. Bus. & Prof. Code §16600.5(a)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "governing-law",
    states: ["Colorado"],
    statement:
      "For a worker who mainly lives and works in Colorado, Colorado voids a restrictive covenant clause that picks another state's law or sends a dispute to another state's courts.",
    basis: "C.R.S. §8-2-113(6)",
    asOf: SET_WRITTEN,
  },
  {
    topic: "governing-law",
    states: ["Washington"],
    statement:
      "For a Washington-based employee, a non-compete clause that picks another state's law or another state's courts is void to that extent.",
    basis: "RCW 49.62.050",
    asOf: SET_WRITTEN,
  },
  {
    topic: "governing-law",
    states: ["Minnesota"],
    statement:
      "For an employee who mainly lives and works in Minnesota, Minnesota voids a term that would take a dispute out of the state's courts or out from under the state's law, where the employee asks for it to be heard here.",
    basis: "Minn. Stat. §181.988 subd. 3",
    asOf: SET_WRITTEN,
  },
];
