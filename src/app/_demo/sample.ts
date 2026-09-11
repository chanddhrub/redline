/**
 * Demonstration material for the landing page.
 *
 * The letter below is synthetic and labelled as such wherever it is shown.
 * The clauses are ordinary examples of the four types v1 covers (ADR 0003);
 * no real employer, person, salary or matter is represented.
 *
 * Severity is escapability first, money second. Every finding quotes a
 * sentence that appears verbatim in `paragraphs` below — that is the whole
 * point of the demonstration, and the test at the bottom of this file's
 * consumer proves it rather than assuming it.
 */

export type Severity = "Critical" | "High";

export interface Measure {
  label: string;
  value: string;
}

export interface Finding {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  /** Exact sentence from the letter. Must string-match `paragraphs`. */
  sentence: string;
  meaning: string;
  counter: string;
  measures: Measure[];
}

export interface Paragraph {
  heading?: string;
  /** Sentences; one may carry a finding id, which windows it. */
  runs: { text: string; cite?: string }[];
}

export const SAMPLE_LETTER = {
  company: "Northwind Analytics, Inc.",
  title: "Offer of Employment — Senior Software Engineer",
  filename: "northwind-offer.pdf",
  words: 1284,
};

export const paragraphs: Paragraph[] = [
  {
    runs: [
      {
        text: "We are delighted to offer you the position of Senior Software Engineer at Northwind Analytics, Inc. (the “Company”), reporting to the VP of Engineering.",
      },
      {
        text: "Your annual base salary will be $186,000, paid semi-monthly in accordance with the Company’s standard payroll practices.",
      },
    ],
  },
  {
    heading: "1. Signing bonus",
    runs: [
      {
        text: "You will receive a signing bonus of $25,000, less applicable withholding, payable with your first regular paycheck.",
      },
      {
        text: "If your employment ends for any reason within twelve (12) months of your start date, you agree to repay the full gross amount of the signing bonus within thirty (30) days of your last day of employment.",
        cite: "bonus",
      },
    ],
  },
  {
    heading: "2. Equity",
    runs: [
      {
        text: "Subject to Board approval, you will be granted an option to purchase 12,000 shares of common stock, vesting over four years with a one-year cliff.",
      },
    ],
  },
  {
    heading: "3. Confidentiality and inventions",
    runs: [
      {
        text: "You agree to assign to the Company all right, title, and interest in any invention, work of authorship, or improvement that you conceive or reduce to practice during the term of your employment, whether or not developed using Company resources or during working hours.",
        cite: "ip",
      },
    ],
  },
  {
    heading: "4. Non-competition",
    runs: [
      {
        text: "For a period of eighteen (18) months following the termination of your employment for any reason, you shall not, directly or indirectly, engage in or provide services to any business that competes with the Company anywhere in the United States.",
        cite: "noncompete",
      },
    ],
  },
  {
    heading: "5. Dispute resolution",
    runs: [
      {
        text: "You and the Company agree that any dispute arising out of or relating to this Agreement or your employment shall be resolved exclusively by final and binding arbitration administered in Santa Clara County, California, and you waive any right to participate in any class, collective, or representative action.",
        cite: "arbitration",
      },
    ],
  },
  {
    heading: "6. At-will employment",
    runs: [
      {
        text: "Your employment with the Company is at will, meaning that either you or the Company may terminate the employment relationship at any time, with or without cause and with or without notice.",
      },
    ],
  },
];

/** Ranked: escapability first, money second. Not document order. */
export const findings: Finding[] = [
  {
    id: "noncompete",
    code: "CR-1",
    title: "Non-compete runs 18 months across the whole country",
    severity: "Critical",
    sentence:
      "For a period of eighteen (18) months following the termination of your employment for any reason, you shall not, directly or indirectly, engage in or provide services to any business that competes with the Company anywhere in the United States.",
    meaning:
      "For a year and a half after you leave — including if they let you go — you cannot work for a competitor anywhere in the US. The sentence does not define which businesses compete, so the limit is whatever the Company later says it is.",
    counter:
      "Reduce the period to six months, limit it to the named competitors listed in an appendix, and apply it only within 50 miles of your assigned office. Strike the clause entirely where employment ends without cause.",
    measures: [
      { label: "Duration", value: "18 months" },
      { label: "Geography", value: "United States" },
      { label: "Scope", value: "Any competing business, undefined" },
      { label: "Applies if laid off", value: "Yes — “for any reason”" },
    ],
  },
  {
    id: "arbitration",
    code: "CR-2",
    title: "Arbitration only, and no class action",
    severity: "Critical",
    sentence:
      "You and the Company agree that any dispute arising out of or relating to this Agreement or your employment shall be resolved exclusively by final and binding arbitration administered in Santa Clara County, California, and you waive any right to participate in any class, collective, or representative action.",
    meaning:
      "You give up a court hearing and a jury for anything arising from your employment, and you cannot join other employees in a shared claim. The venue is fixed to one county regardless of where you work.",
    counter:
      "Carve out statutory discrimination, harassment and wage claims. Make the obligation mutual, require the Company to pay the arbitrator's fees, and set the venue where you actually work.",
    measures: [
      { label: "Duration", value: "Indefinite" },
      { label: "Scope", value: "Any employment dispute" },
      { label: "Venue", value: "Santa Clara County, CA" },
      { label: "Collective claims", value: "Waived" },
    ],
  },
  {
    id: "ip",
    code: "HI-1",
    title: "Invention assignment reaches your own time",
    severity: "High",
    sentence:
      "You agree to assign to the Company all right, title, and interest in any invention, work of authorship, or improvement that you conceive or reduce to practice during the term of your employment, whether or not developed using Company resources or during working hours.",
    meaning:
      "Anything you make while employed here belongs to the Company, explicitly including work built on your own machine on a Sunday. A side project started after your first day is covered by this sentence as written.",
    counter:
      "Limit the assignment to work that relates to the Company's actual business or uses its resources, and attach a schedule of your existing projects that this agreement does not touch.",
    measures: [
      { label: "Duration", value: "Full term of employment" },
      { label: "Own time", value: "Included" },
      { label: "Own equipment", value: "Included" },
      { label: "Prior work excluded", value: "No schedule attached" },
    ],
  },
  {
    id: "bonus",
    code: "HI-2",
    title: "Signing bonus repayable in full, gross",
    severity: "High",
    sentence:
      "If your employment ends for any reason within twelve (12) months of your start date, you agree to repay the full gross amount of the signing bonus within thirty (30) days of your last day of employment.",
    meaning:
      "Leave or be let go inside a year and you owe the whole $25,000 back — the gross figure, not the amount that reached your account after tax. You would repay money you never received.",
    counter:
      "Prorate the repayment by completed months of service, cap it at the net amount actually received, and remove the obligation where the Company ends the employment without cause.",
    measures: [
      { label: "Duration", value: "12 months" },
      { label: "Amount at stake", value: "$25,000 gross" },
      { label: "Repayment window", value: "30 days" },
      { label: "Applies if laid off", value: "Yes — “for any reason”" },
    ],
  },
];

/** Clause types checked on every analysis, clean or not (ADR 0004). */
export const coverage = [
  { type: "Non-compete / non-solicit", found: "1 finding", flagged: true },
  { type: "Mandatory arbitration and class-action waiver", found: "1 finding", flagged: true },
  { type: "IP assignment and moonlighting restrictions", found: "1 finding", flagged: true },
  { type: "Equity vesting, clawback and bonus repayment", found: "1 finding", flagged: true },
];
