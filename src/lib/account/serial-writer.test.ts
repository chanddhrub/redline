import { describe, expect, it } from "vitest";
import { serialWriter, type WriteEvent } from "./serial-writer";

/** A write the test finishes by hand, so overlap is something it can see. */
function harness() {
  const calls: { value: string; finish: () => void; fail: () => void }[] = [];
  const events: WriteEvent<string>[] = [];
  const writer = serialWriter<string>(
    (value) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ value, finish: resolve, fail: () => reject(new Error("no")) });
      }),
    (event) => events.push(event),
  );
  return { calls, events, writer };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("keeping one thing in an account, one write at a time", () => {
  it("writes once for one change and reports it saved", async () => {
    const { calls, events, writer } = harness();
    writer.push("a");
    calls[0].finish();
    await settle();
    expect(calls).toHaveLength(1);
    expect(events).toEqual([{ kind: "saving" }, { kind: "saved", value: "a" }]);
  });

  it("never runs two writes at once", async () => {
    const { calls, writer } = harness();
    writer.push("a");
    writer.push("b");
    writer.push("c");
    expect(calls).toHaveLength(1);
  });

  it("skips what was overtaken and finishes on the newest value", async () => {
    const { calls, events, writer } = harness();
    writer.push("a");
    writer.push("b");
    writer.push("c");
    calls[0].finish();
    await settle();
    expect(calls.map((c) => c.value)).toEqual(["a", "c"]);
    calls[1].finish();
    await settle();
    expect(events.at(-1)).toEqual({ kind: "saved", value: "c" });
  });

  it("does not call anything saved while a newer value is still waiting", async () => {
    const { calls, events, writer } = harness();
    writer.push("a");
    writer.push("b");
    calls[0].finish();
    await settle();
    expect(events.filter((e) => e.kind === "saved")).toEqual([]);
  });

  it("reports a failure once and does not retry on its own", async () => {
    const { calls, events, writer } = harness();
    writer.push("a");
    calls[0].fail();
    await settle();
    expect(calls).toHaveLength(1);
    expect(events.at(-1)).toEqual({ kind: "failed" });
  });

  it("still writes the newest value when the one before it failed", async () => {
    const { calls, events, writer } = harness();
    writer.push("a");
    writer.push("b");
    calls[0].fail();
    await settle();
    expect(calls.map((c) => c.value)).toEqual(["a", "b"]);
    calls[1].finish();
    await settle();
    expect(events.at(-1)).toEqual({ kind: "saved", value: "b" });
  });

  it("knows what the account is heading towards", async () => {
    const { calls, writer } = harness();
    expect(writer.wanted()).toBeUndefined();
    writer.push("a");
    expect(writer.wanted()).toBe("a");
    writer.push("b");
    expect(writer.wanted()).toBe("b");
    calls[0].finish();
    await settle();
    calls[1].finish();
    await settle();
    expect(writer.wanted()).toBe("b");
  });

  it("forgets a failed value, so changing back to the saved one is not a write", async () => {
    const { calls, writer } = harness();
    writer.push("a");
    calls[0].finish();
    await settle();
    writer.push("b");
    calls[1].fail();
    await settle();
    expect(writer.wanted()).toBe("a");
  });
});
