import { randomUUID } from "node:crypto";

import {
  AccessFulfillmentConfigError,
  type AccessFulfillmentEnv,
  loadAccessFulfillmentConfig,
} from "../config/accessFulfillment";
import { createAccessFulfillmentClient } from "../services/accessFulfillment";
import { logger as defaultLogger } from "../utils/logger";
import {
  type AccessFulfillmentRunLoopResult,
  type AccessFulfillmentWorkerClient,
  type AccessFulfillmentWorkerDependencies,
  type AccessFulfillmentWorkerLogger,
  type AccessFulfillmentWorkerSleep,
  createAccessFulfillmentWorker,
} from "./accessFulfillmentWorker";

export interface AccessFulfillmentWorkerRunner {
  runLoop(signal: AbortSignal): Promise<AccessFulfillmentRunLoopResult>;
}

export interface AccessFulfillmentWorkerMainDependencies {
  env?: AccessFulfillmentEnv;
  logger?: AccessFulfillmentWorkerLogger;
  loadClient?: () => Promise<AccessFulfillmentWorkerClient>;
  createWorker?: (
    dependencies: AccessFulfillmentWorkerDependencies,
  ) => AccessFulfillmentWorkerRunner;
  generateToken?: () => string;
  sleep?: AccessFulfillmentWorkerSleep;
  registerSignalHandlers?: (requestShutdown: () => void) => () => void;
}

export type AccessFulfillmentWorkerMainResult =
  | { kind: "disabled"; exitCode: 0 }
  | { kind: "dry_run"; exitCode: 0 }
  | { kind: "stopped"; exitCode: 0 }
  | { kind: "fatal"; exitCode: 1; errorCode: string };

export function abortableWorkerSleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function loadDefaultClient(): Promise<AccessFulfillmentWorkerClient> {
  const { supabase } = await import("../services/supabase");
  return createAccessFulfillmentClient(supabase);
}

export function registerAccessFulfillmentWorkerSignalHandlers(
  requestShutdown: () => void,
): () => void {
  process.on("SIGTERM", requestShutdown);
  process.on("SIGINT", requestShutdown);
  return () => {
    process.removeListener("SIGTERM", requestShutdown);
    process.removeListener("SIGINT", requestShutdown);
  };
}

function safeWorkerLog(
  workerLogger: AccessFulfillmentWorkerLogger,
  level: "info" | "warn" | "error",
  event: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    workerLogger[level](event, metadata);
  } catch {
    // Logging must not block configuration gates, shutdown, or exitCode.
  }
}

export async function runAccessFulfillmentWorkerMain(
  dependencies: AccessFulfillmentWorkerMainDependencies = {},
): Promise<AccessFulfillmentWorkerMainResult> {
  const workerLogger = dependencies.logger ?? defaultLogger;
  let config;
  try {
    config = loadAccessFulfillmentConfig(dependencies.env ?? process.env);
  } catch (error) {
    const field =
      error instanceof AccessFulfillmentConfigError ? error.field : "access_fulfillment";
    safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
      errorCode: "invalid_access_fulfillment_configuration",
      field,
    });
    return {
      kind: "fatal",
      exitCode: 1,
      errorCode: "invalid_access_fulfillment_configuration",
    };
  }

  if (config.durableEmailDeliveryEnabled) {
    safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
      errorCode: "durable_email_capability_not_implemented",
    });
    return {
      kind: "fatal",
      exitCode: 1,
      errorCode: "durable_email_capability_not_implemented",
    };
  }

  if (!config.workerEnabled) {
    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_disabled");
    return { kind: "disabled", exitCode: 0 };
  }

  if (config.workerDryRun) {
    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_dry_run");
    return { kind: "dry_run", exitCode: 0 };
  }

  const controller = new AbortController();
  const requestShutdown = (): void => {
    if (!controller.signal.aborted) {
      safeWorkerLog(
        workerLogger,
        "info",
        "access_fulfillment_worker_shutdown_requested",
      );
      controller.abort();
    }
  };
  const unregisterSignalHandlers = (
    dependencies.registerSignalHandlers ??
    registerAccessFulfillmentWorkerSignalHandlers
  )(requestShutdown);

  try {
    const client = await (dependencies.loadClient ?? loadDefaultClient)();
    const worker = (dependencies.createWorker ?? createAccessFulfillmentWorker)({
      client,
      config,
      generateToken: dependencies.generateToken ?? randomUUID,
      now: Date.now,
      sleep: dependencies.sleep ?? abortableWorkerSleep,
      logger: workerLogger,
    });

    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_started", {
      batchSize: config.batchSize,
      pollIntervalMs: config.pollIntervalMs,
      leaseSeconds: config.leaseSeconds,
      concurrency: config.concurrency,
    });
    const result = await worker.runLoop(controller.signal);
    if (result.kind === "fatal") {
      safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
        errorCode: result.errorCode,
      });
      return { kind: "fatal", exitCode: 1, errorCode: result.errorCode };
    }

    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_stopped", {
      shutdown: controller.signal.aborted,
    });
    return { kind: "stopped", exitCode: 0 };
  } catch {
    safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
      errorCode: "worker_startup_failed",
    });
    return { kind: "fatal", exitCode: 1, errorCode: "worker_startup_failed" };
  } finally {
    unregisterSignalHandlers();
  }
}

if (require.main === module) {
  void runAccessFulfillmentWorkerMain()
    .then((result) => {
      process.exitCode = result.exitCode;
    })
    .catch(() => {
      safeWorkerLog(defaultLogger, "error", "access_fulfillment_worker_stopped", {
        errorCode: "worker_unhandled_error",
      });
      process.exitCode = 1;
    });
}
