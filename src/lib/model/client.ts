/**
 * Seam 1 of analysis (ticket 01) — the contract every model-backed operation
 * in this product speaks.
 *
 * One operation, `complete`, and one shape of answer. A caller hands over a
 * schema; it gets back either a value that satisfied that schema or a typed
 * failure. There is no third state, and nothing on the failure path is coerced
 * into a value that looks valid — a fabricated analysis is the single result
 * this product exists to rule out (ADR 0001, ADR 0004).
 *
 * Failures are data rather than thrown `Error`s, matching intake's `Refusal`:
 * the interface switches on `kind` and writes its own copy. An error message
 * from a transport is never reader-facing text.
 */

import type { ModelSchema } from "./schema";

export interface StructuredRequest<T> {
  /**
   * Names the operation the payload belongs to — "analysis", "answer". The
   * transport does not read it; the fixture-backed stub does, and so do logs.
   */
  operation: string;
  /** Instructions that do not vary with the document. */
  system: string;
  /** The document, the red lines, the question — whatever this call is about. */
  user: string;
  /** Declares the JSON the model must return, and validates what it did. */
  schema: ModelSchema<T>;
}

export type ModelFailure =
  /**
   * A required environment variable is absent. `variable` names it, so the
   * operator is told which one rather than "configuration error".
   */
  | { kind: "missing-configuration"; variable: string }
  /** The request never completed: DNS, TLS, timeout, offline. */
  | { kind: "unreachable"; detail: string }
  /** The endpoint answered, and refused. Rate limits and bad keys land here. */
  | { kind: "rejected"; status: number; detail: string }
  /**
   * The endpoint answered 2xx and the body cannot be used. `reason` separates
   * "no content at all" from "not JSON" from "JSON that broke the schema",
   * because only the last one is a prompt problem.
   */
  | {
      kind: "unusable-response";
      reason: "no-content" | "not-json" | "off-schema";
      detail: string;
    };

export type ModelResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: ModelFailure };

export interface ModelClient {
  complete<T>(request: StructuredRequest<T>): Promise<ModelResult<T>>;
}
