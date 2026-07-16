export type AbortDeadlineState =
  | "active"
  | "completed"
  | "deadline_exceeded"
  | "external_abort";

export type AbortDeadlineScheduler = (
  callback: () => void,
  timeoutMs: number,
) => () => void;

export interface AbortDeadline {
  readonly signal: AbortSignal;
  state(): AbortDeadlineState;
  didTimeout(): boolean;
  wasExternallyAborted(): boolean;
  dispose(): void;
}

const scheduleSystemDeadline: AbortDeadlineScheduler = (callback, timeoutMs) => {
  const timeout = setTimeout(callback, timeoutMs);
  return () => clearTimeout(timeout);
};

export function createAbortDeadline(
  timeoutMs: number,
  externalSignal?: AbortSignal,
  schedule: AbortDeadlineScheduler = scheduleSystemDeadline,
): AbortDeadline {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Abort deadline timeout must be a positive finite number");
  }

  const controller = new AbortController();
  let currentState: AbortDeadlineState = "active";
  let cancelScheduledDeadline: (() => void) | undefined;
  let externalListenerAttached = false;

  const cleanup = (): void => {
    const cancel = cancelScheduledDeadline;
    cancelScheduledDeadline = undefined;
    cancel?.();

    if (externalSignal && externalListenerAttached) {
      externalSignal.removeEventListener("abort", handleExternalAbort);
      externalListenerAttached = false;
    }
  };

  const transitionToAbort = (
    state: "deadline_exceeded" | "external_abort",
  ): void => {
    if (currentState !== "active") {
      return;
    }

    currentState = state;
    cleanup();
    controller.abort();
  };

  const handleExternalAbort = (): void => {
    transitionToAbort("external_abort");
  };

  if (externalSignal?.aborted) {
    transitionToAbort("external_abort");
  } else {
    if (externalSignal) {
      externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
      externalListenerAttached = true;
    }

    try {
      const cancel = schedule(
        () => transitionToAbort("deadline_exceeded"),
        timeoutMs,
      );
      if (currentState === "active") {
        cancelScheduledDeadline = cancel;
      } else {
        cancel();
      }
    } catch {
      currentState = "completed";
      cleanup();
      throw new Error("Abort deadline scheduling failed");
    }
  }

  return {
    signal: controller.signal,

    state() {
      return currentState;
    },

    didTimeout() {
      return currentState === "deadline_exceeded";
    },

    wasExternallyAborted() {
      return currentState === "external_abort";
    },

    dispose() {
      if (currentState === "active") {
        currentState = "completed";
      }
      cleanup();
    },
  };
}
