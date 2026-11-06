/**
 * A read that gets more than one chance.
 *
 * The first reads of a session go out the moment it is issued, and the service
 * has been seen refusing a token that new ("JWT issued at future") and taking
 * the same token 0.4 seconds later. A reader who has just signed in should not
 * be told their document cannot be read because of that.
 *
 * Reads only. A failed read here is still a failure at the end: nothing is
 * taken for empty, which is why an answer of `null` is returned, not retried.
 */

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function readAgain<T>(
  read: () => Promise<T>,
  waits: readonly number[] = [500, 1500],
  wait: (ms: number) => Promise<void> = pause,
): Promise<T> {
  for (const ms of waits) {
    try {
      return await read();
    } catch {
      await wait(ms);
    }
  }
  return read();
}
