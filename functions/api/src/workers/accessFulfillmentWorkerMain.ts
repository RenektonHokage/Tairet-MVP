import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  AccessFulfillmentConfigError,
  type AccessFulfillmentEnv,
  loadAccessFulfillmentConfig,
} from "../config/accessFulfillment";
import {
  createAccessFulfillmentClient,
  type AccessFulfillmentRpcTransport,
} from "../services/accessFulfillment";
import type {
  AccessEntriesEmailMessageInput,
  BuiltAccessEntriesEmailMessage,
} from "../services/accessEmailMessage";
import type {
  AccessEmailMessageData,
  AccessEmailMessageDataLoadResult,
  AccessEmailMessageDataReadOptions,
  AccessEmailMessageDataReader,
} from "../services/accessEmailMessageData";
import type { AccessEmailMessageDataSupabaseClient } from "../services/accessEmailMessageDataSupabase";
import type { AccessEmailProvider } from "../services/accessEmailProvider";
import type { CreateResendAccessEmailProviderOptions } from "../services/accessEmailProviderResend";
import { logger as defaultLogger } from "../utils/logger";
import {
  type AccessFulfillmentEmailCapability,
  type AccessFulfillmentRunLoopResult,
  type AccessFulfillmentStopReason,
  type AccessFulfillmentWorkerClient,
  type AccessFulfillmentWorkerDependencies,
  type AccessFulfillmentWorkerLogger,
  type AccessFulfillmentWorkerSleep,
  createAccessFulfillmentWorker,
} from "./accessFulfillmentWorker";

export interface AccessFulfillmentWorkerRunner {
  runLoop(signal: AbortSignal): Promise<AccessFulfillmentRunLoopResult>;
}

export interface AccessFulfillmentRuntimeSupabaseClient
  extends AccessFulfillmentRpcTransport,
    AccessEmailMessageDataSupabaseClient {}

export interface AccessFulfillmentEmailRuntime {
  createReader(
    client: AccessEmailMessageDataSupabaseClient,
  ): AccessEmailMessageDataReader;
  loadMessageData(
    reader: AccessEmailMessageDataReader,
    orderId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataLoadResult>;
  buildMessage(
    input: AccessEntriesEmailMessageInput,
  ): Promise<BuiltAccessEntriesEmailMessage>;
  createProvider(
    options: CreateResendAccessEmailProviderOptions,
  ): AccessEmailProvider;
  getQrBaseUrl(): string;
}

export interface AccessFulfillmentWorkerMainDependencies {
  env?: AccessFulfillmentEnv;
  logger?: AccessFulfillmentWorkerLogger;
  loadClient?: () => Promise<AccessFulfillmentWorkerClient>;
  loadSupabaseClient?: () => Promise<AccessFulfillmentRuntimeSupabaseClient>;
  createRpcClient?: (
    transport: AccessFulfillmentRpcTransport,
  ) => AccessFulfillmentWorkerClient;
  loadEmailRuntime?: () => Promise<AccessFulfillmentEmailRuntime>;
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
  | {
      kind: "stopped";
      exitCode: 0;
      stopReason: Extract<AccessFulfillmentStopReason, "external_shutdown">;
    }
  | {
      kind: "fatal";
      exitCode: 1;
      stopReason: Extract<AccessFulfillmentStopReason, "fatal_stop">;
      errorCode: string;
    };

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
  return createAccessFulfillmentClient(await loadDefaultSupabaseClient());
}

async function loadDefaultSupabaseClient(): Promise<AccessFulfillmentRuntimeSupabaseClient> {
  const { supabase } = await import("../services/supabase");
  return supabase as unknown as AccessFulfillmentRuntimeSupabaseClient;
}

async function loadDefaultEmailRuntime(): Promise<AccessFulfillmentEmailRuntime> {
  const [messageData, messageDataSupabase, message, provider, qr] =
    await Promise.all([
      import("../services/accessEmailMessageData"),
      import("../services/accessEmailMessageDataSupabase"),
      import("../services/accessEmailMessage"),
      import("../services/accessEmailProviderResend"),
      import("../services/accessQr"),
    ]);
  return Object.freeze({
    createReader: messageDataSupabase.createAccessEmailMessageDataSupabaseReader,
    loadMessageData: messageData.loadAccessEmailMessageData,
    buildMessage: message.buildAccessEntriesEmailMessage,
    createProvider: provider.createResendAccessEmailProvider,
    getQrBaseUrl: qr.getAccessQrBaseUrl,
  });
}

function readDurableEmailEnv(
  env: AccessFulfillmentEnv,
  field: "EMAIL_FROM_ADDRESS" | "RESEND_API_KEY",
): string {
  const value = env[field];
  if (value === undefined) {
    throw new Error("Missing validated durable email configuration");
  }
  return value;
}

function bindEmailLoader(
  runtime: AccessFulfillmentEmailRuntime,
  reader: AccessEmailMessageDataReader,
): AccessFulfillmentEmailCapability["load"] {
  return (orderId, options) => runtime.loadMessageData(reader, orderId, options);
}

function bindEmailBuilder(
  runtime: AccessFulfillmentEmailRuntime,
  from: string,
  qrBaseUrl: string,
): AccessFulfillmentEmailCapability["build"] {
  return (data: AccessEmailMessageData) =>
    runtime.buildMessage({
      from,
      buyerEmail: data.buyerEmail,
      buyerName: data.buyerName,
      publicRef: data.publicRef,
      sourceName: data.sourceName,
      accessDate: data.accessDate,
      qrBaseUrl,
      entries: data.entries,
    });
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
  const env = dependencies.env ?? process.env;
  let config;
  try {
    config = loadAccessFulfillmentConfig(env);
  } catch (error) {
    const field =
      error instanceof AccessFulfillmentConfigError ? error.field : "access_fulfillment";
    safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
      errorCode: "invalid_access_fulfillment_configuration",
      field,
      stopReason: "fatal_stop",
    });
    return {
      kind: "fatal",
      exitCode: 1,
      stopReason: "fatal_stop",
      errorCode: "invalid_access_fulfillment_configuration",
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
    let client: AccessFulfillmentWorkerClient;
    let emailCapability: AccessFulfillmentEmailCapability | undefined;

    if (config.durableEmailDeliveryEnabled) {
      const supabaseClient = await (
        dependencies.loadSupabaseClient ?? loadDefaultSupabaseClient
      )();
      client = (dependencies.createRpcClient ?? createAccessFulfillmentClient)(
        supabaseClient,
      );
      const emailRuntime = await (
        dependencies.loadEmailRuntime ?? loadDefaultEmailRuntime
      )();
      const reader = emailRuntime.createReader(supabaseClient);
      const from = readDurableEmailEnv(env, "EMAIL_FROM_ADDRESS");
      const qrBaseUrl = emailRuntime.getQrBaseUrl();
      const load = bindEmailLoader(emailRuntime, reader);
      const build = bindEmailBuilder(emailRuntime, from, qrBaseUrl);
      const apiKey = readDurableEmailEnv(env, "RESEND_API_KEY");
      const provider = emailRuntime.createProvider({
        apiKey,
        timeoutMs: config.emailProviderTimeoutMs,
      });
      emailCapability = Object.freeze({ load, build, provider });
    } else {
      client = await (dependencies.loadClient ?? loadDefaultClient)();
    }

    const worker = (dependencies.createWorker ?? createAccessFulfillmentWorker)({
      client,
      config,
      generateToken: dependencies.generateToken ?? randomUUID,
      now: () => performance.now(),
      sleep: dependencies.sleep ?? abortableWorkerSleep,
      logger: workerLogger,
      ...(emailCapability ? { emailCapability } : {}),
    });

    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_started", {
      ...(config.durableEmailDeliveryEnabled
        ? {
            mode: "durable_email",
            durableEmailDeliveryEnabled: true,
            provider: "resend",
            emailProviderTimeoutMs: config.emailProviderTimeoutMs,
          }
        : {}),
      batchSize: config.batchSize,
      pollIntervalMs: config.pollIntervalMs,
      leaseSeconds: config.leaseSeconds,
      concurrency: config.concurrency,
      rpcTimeoutMs: config.rpcTimeoutMs,
    });
    const result = await worker.runLoop(controller.signal);
    if (result.kind === "fatal") {
      safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
        errorCode: result.errorCode,
        stopReason: result.stopReason,
      });
      return {
        kind: "fatal",
        exitCode: 1,
        stopReason: result.stopReason,
        errorCode: result.errorCode,
      };
    }

    safeWorkerLog(workerLogger, "info", "access_fulfillment_worker_stopped", {
      stopReason: result.stopReason,
    });
    return {
      kind: "stopped",
      exitCode: 0,
      stopReason: result.stopReason,
    };
  } catch {
    safeWorkerLog(workerLogger, "error", "access_fulfillment_worker_stopped", {
      errorCode: "worker_startup_failed",
      stopReason: "fatal_stop",
    });
    return {
      kind: "fatal",
      exitCode: 1,
      stopReason: "fatal_stop",
      errorCode: "worker_startup_failed",
    };
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
        stopReason: "fatal_stop",
      });
      process.exitCode = 1;
    });
}
