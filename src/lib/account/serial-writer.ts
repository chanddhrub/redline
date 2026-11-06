/**
 * One write at a time, and the newest value wins.
 *
 * What the reader sees changes faster than a row can be written. Without this,
 * each change starts its own write, and an older write that lands last leaves
 * the account holding something the reader has already changed. So a value
 * pushed during a write waits, a newer one replaces it, and "saved" is only
 * said once nothing is waiting.
 *
 * A failed write is reported and left. Retrying here would turn a service that
 * is down into a stream of requests; the next change is the retry.
 *
 * Pure of React and of the network, so all of that can be tested without
 * either.
 */

export type WriteEvent<T> =
  | { kind: "saving" }
  | { kind: "saved"; value: T }
  | { kind: "failed" };

export interface SerialWriter<T> {
  push(value: T): void;
  /** What the account will hold once the writes in hand are done: the value
   *  waiting, else the one being written, else the last one that was written.
   *  Nothing, if this writer has written nothing yet. */
  wanted(): T | undefined;
}

export function serialWriter<T>(
  write: (value: T) => Promise<void>,
  report: (event: WriteEvent<T>) => void,
): SerialWriter<T> {
  let writing: { value: T } | null = null;
  let waiting: { value: T } | null = null;
  let written: { value: T } | null = null;

  async function drain() {
    while (waiting) {
      writing = waiting;
      waiting = null;
      try {
        await write(writing.value);
        written = writing;
        if (!waiting) report({ kind: "saved", value: writing.value });
      } catch {
        if (!waiting) report({ kind: "failed" });
      }
      writing = null;
    }
  }

  return {
    push(value) {
      waiting = { value };
      if (writing) return;
      report({ kind: "saving" });
      void drain();
    },
    wanted() {
      return (waiting ?? writing ?? written)?.value;
    },
  };
}
