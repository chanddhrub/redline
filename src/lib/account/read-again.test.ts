import { describe, expect, it, vi } from "vitest";
import { readAgain } from "./read-again";

const noWait = () => Promise.resolve();

describe("readAgain", () => {
  it("reads once when the first read works", async () => {
    const read = vi.fn().mockResolvedValue("row");
    await expect(readAgain(read, [500, 1500], noWait)).resolves.toBe("row");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("gets past a refusal that clears", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("JWT issued at future"))
      .mockResolvedValue("row");
    await expect(readAgain(read, [500, 1500], noWait)).resolves.toBe("row");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps an empty answer as an answer rather than reading again", async () => {
    const read = vi.fn().mockResolvedValue(null);
    await expect(readAgain(read, [500, 1500], noWait)).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("waits between reads, and gives up with the last failure", async () => {
    const wait = vi.fn(noWait);
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValue(new Error("last"));
    await expect(readAgain(read, [500, 1500], wait)).rejects.toThrow("last");
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[500], [1500]]);
  });
});
