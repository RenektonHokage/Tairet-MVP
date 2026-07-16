import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { describe, it } from "node:test";

import {
  type AbortDeadlineScheduler,
  createAbortDeadline,
} from "./abortDeadline";

interface ScheduledDeadline {
  callback: () => void;
  timeoutMs: number;
  cancelCalls: number;
}

function createFakeScheduler(): {
  schedule: AbortDeadlineScheduler;
  scheduled: ScheduledDeadline[];
} {
  const scheduled: ScheduledDeadline[] = [];

  return {
    scheduled,
    schedule(callback, timeoutMs) {
      const deadline = {
        callback,
        timeoutMs,
        cancelCalls: 0,
      };
      scheduled.push(deadline);

      return () => {
        deadline.cancelCalls += 1;
      };
    },
  };
}

describe("createAbortDeadline", () => {
  it("aborts on timeout and accepts effective timeouts below the configured minimum", () => {
    const parent = new AbortController();
    const fake = createFakeScheduler();
    const listenersBefore = getEventListeners(parent.signal, "abort").length;
    const deadline = createAbortDeadline(17, parent.signal, fake.schedule);
    const scheduled = fake.scheduled[0];

    assert.ok(scheduled);
    assert.equal(scheduled.timeoutMs, 17);
    assert.equal(deadline.state(), "active");
    assert.equal(deadline.signal.aborted, false);
    assert.equal(getEventListeners(parent.signal, "abort").length, listenersBefore + 1);

    scheduled.callback();

    assert.equal(deadline.signal.aborted, true);
    assert.equal(deadline.state(), "deadline_exceeded");
    assert.equal(deadline.didTimeout(), true);
    assert.equal(deadline.wasExternallyAborted(), false);
    assert.equal(scheduled.cancelCalls, 1);
    assert.equal(getEventListeners(parent.signal, "abort").length, listenersBefore);

    deadline.dispose();
    assert.equal(deadline.state(), "deadline_exceeded");
    assert.equal(scheduled.cancelCalls, 1);
  });

  it("aborts from the external signal without reporting a timeout", () => {
    const parent = new AbortController();
    const fake = createFakeScheduler();
    const deadline = createAbortDeadline(5_000, parent.signal, fake.schedule);
    const scheduled = fake.scheduled[0];

    assert.ok(scheduled);
    parent.abort();

    assert.equal(deadline.signal.aborted, true);
    assert.equal(deadline.state(), "external_abort");
    assert.equal(deadline.didTimeout(), false);
    assert.equal(deadline.wasExternallyAborted(), true);
    assert.equal(scheduled.cancelCalls, 1);

    scheduled.callback();
    assert.equal(deadline.state(), "external_abort");
    assert.equal(scheduled.cancelCalls, 1);
  });

  it("handles an already-aborted external signal without scheduling a timer", () => {
    const parent = new AbortController();
    parent.abort();
    const fake = createFakeScheduler();

    const deadline = createAbortDeadline(5_000, parent.signal, fake.schedule);

    assert.equal(deadline.signal.aborted, true);
    assert.equal(deadline.state(), "external_abort");
    assert.equal(fake.scheduled.length, 0);
  });

  it("completes and cleans up idempotently before the timeout", () => {
    const parent = new AbortController();
    const fake = createFakeScheduler();
    const listenersBefore = getEventListeners(parent.signal, "abort").length;
    const deadline = createAbortDeadline(5_000, parent.signal, fake.schedule);
    const scheduled = fake.scheduled[0];

    assert.ok(scheduled);
    deadline.dispose();
    deadline.dispose();

    assert.equal(deadline.state(), "completed");
    assert.equal(deadline.signal.aborted, false);
    assert.equal(deadline.didTimeout(), false);
    assert.equal(deadline.wasExternallyAborted(), false);
    assert.equal(scheduled.cancelCalls, 1);
    assert.equal(getEventListeners(parent.signal, "abort").length, listenersBefore);

    parent.abort();
    scheduled.callback();
    assert.equal(deadline.state(), "completed");
    assert.equal(deadline.signal.aborted, false);
  });

  it("rejects non-positive and non-finite timeouts without scheduling work", () => {
    const fake = createFakeScheduler();

    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => createAbortDeadline(timeoutMs, undefined, fake.schedule),
        RangeError,
      );
    }

    assert.equal(fake.scheduled.length, 0);
  });

  it("cleans up when a scheduler fires synchronously", () => {
    let cancelCalls = 0;
    const schedule: AbortDeadlineScheduler = (callback) => {
      callback();
      return () => {
        cancelCalls += 1;
      };
    };

    const deadline = createAbortDeadline(5_000, undefined, schedule);

    assert.equal(deadline.state(), "deadline_exceeded");
    assert.equal(deadline.signal.aborted, true);
    assert.equal(cancelCalls, 1);

    deadline.dispose();
    assert.equal(cancelCalls, 1);
  });

  it("sanitizes scheduler failures and removes the external listener", () => {
    const parent = new AbortController();
    const listenersBefore = getEventListeners(parent.signal, "abort").length;
    const schedule: AbortDeadlineScheduler = () => {
      throw new Error("sensitive scheduler detail");
    };

    assert.throws(
      () => createAbortDeadline(5_000, parent.signal, schedule),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Abort deadline scheduling failed" &&
        !error.message.includes("sensitive"),
    );
    assert.equal(getEventListeners(parent.signal, "abort").length, listenersBefore);
  });
});
