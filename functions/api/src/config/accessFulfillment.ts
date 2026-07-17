export const ACCESS_FULFILLMENT_LIMITS = {
  batchSize: { min: 1, max: 100 },
  pollIntervalMs: { min: 1_000, max: 60_000 },
  leaseSeconds: { min: 30, max: 900 },
  concurrency: { min: 1, max: 16 },
  rpcTimeoutMs: { min: 1_000, max: 25_000 },
  emailProviderTimeoutMs: { min: 1_000, max: 25_000 },
} as const;

export const ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS = 5_000;

export interface AccessFulfillmentConfig {
  workerEnabled: boolean;
  durableEmailDeliveryEnabled: boolean;
  legacyDirectEmailEnabled: boolean;
  workerDryRun: boolean;
  batchSize: number;
  pollIntervalMs: number;
  leaseSeconds: number;
  concurrency: number;
  rpcTimeoutMs: number;
  emailProviderTimeoutMs: number;
  emailEnabled: boolean;
}

export type AccessFulfillmentEnv = Readonly<Record<string, string | undefined>>;

export class AccessFulfillmentConfigError extends Error {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(`Invalid access fulfillment configuration for ${field}: ${reason}`);
    this.name = "AccessFulfillmentConfigError";
    this.field = field;
  }
}

function readBoolean(
  env: AccessFulfillmentEnv,
  field: string,
  defaultValue: boolean,
): boolean {
  const value = env[field];

  if (value === undefined) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new AccessFulfillmentConfigError(
    field,
    'expected the explicit value "true" or "false"',
  );
}

function readInteger(
  env: AccessFulfillmentEnv,
  field: string,
  defaultValue: number,
  range: { readonly min: number; readonly max: number },
): number {
  const value = env[field];

  if (value === undefined) {
    return defaultValue;
  }

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new AccessFulfillmentConfigError(field, "expected a base-10 integer");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AccessFulfillmentConfigError(field, "integer is outside the safe range");
  }

  if (parsed < range.min || parsed > range.max) {
    throw new AccessFulfillmentConfigError(
      field,
      `expected an integer from ${range.min} through ${range.max}`,
    );
  }

  return parsed;
}

function requireNonEmpty(env: AccessFulfillmentEnv, field: string): void {
  const value = env[field];
  if (value === undefined || value.trim().length === 0) {
    throw new AccessFulfillmentConfigError(field, "required when durable email delivery is enabled");
  }
}

export function loadAccessFulfillmentConfig(
  env: AccessFulfillmentEnv,
): AccessFulfillmentConfig {
  const workerEnabled = readBoolean(env, "ACCESS_FULFILLMENT_WORKER_ENABLED", false);
  const durableEmailDeliveryEnabled = readBoolean(
    env,
    "ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED",
    false,
  );
  const legacyDirectEmailEnabled = readBoolean(
    env,
    "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED",
    true,
  );
  const workerDryRun = readBoolean(env, "ACCESS_FULFILLMENT_WORKER_DRY_RUN", true);
  const emailEnabled = readBoolean(env, "EMAIL_ENABLED", false);

  if (legacyDirectEmailEnabled && durableEmailDeliveryEnabled) {
    throw new AccessFulfillmentConfigError(
      "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED",
      "cannot be enabled with durable email delivery",
    );
  }

  if (legacyDirectEmailEnabled && workerEnabled) {
    throw new AccessFulfillmentConfigError(
      "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED",
      "cannot be enabled with the fulfillment worker",
    );
  }

  if (durableEmailDeliveryEnabled) {
    if (!emailEnabled) {
      throw new AccessFulfillmentConfigError(
        "EMAIL_ENABLED",
        "must be true when durable email delivery is enabled",
      );
    }

    requireNonEmpty(env, "RESEND_API_KEY");
    requireNonEmpty(env, "EMAIL_FROM_ADDRESS");
  }

  const batchSize = readInteger(
    env,
    "ACCESS_FULFILLMENT_BATCH_SIZE",
    5,
    ACCESS_FULFILLMENT_LIMITS.batchSize,
  );
  const pollIntervalMs = readInteger(
    env,
    "ACCESS_FULFILLMENT_POLL_INTERVAL_MS",
    5_000,
    ACCESS_FULFILLMENT_LIMITS.pollIntervalMs,
  );
  const leaseSeconds = readInteger(
    env,
    "ACCESS_FULFILLMENT_LEASE_SECONDS",
    300,
    ACCESS_FULFILLMENT_LIMITS.leaseSeconds,
  );
  const concurrency = readInteger(
    env,
    "ACCESS_FULFILLMENT_CONCURRENCY",
    2,
    ACCESS_FULFILLMENT_LIMITS.concurrency,
  );
  const rpcTimeoutMs = readInteger(
    env,
    "ACCESS_FULFILLMENT_RPC_TIMEOUT_MS",
    10_000,
    ACCESS_FULFILLMENT_LIMITS.rpcTimeoutMs,
  );
  const emailProviderTimeoutMs = readInteger(
    env,
    "ACCESS_EMAIL_PROVIDER_TIMEOUT_MS",
    15_000,
    ACCESS_FULFILLMENT_LIMITS.emailProviderTimeoutMs,
  );

  if (
    rpcTimeoutMs + ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS >
    leaseSeconds * 1_000
  ) {
    throw new AccessFulfillmentConfigError(
      "ACCESS_FULFILLMENT_RPC_TIMEOUT_MS",
      "must leave the fixed safety margin within the fulfillment lease",
    );
  }

  if (
    emailProviderTimeoutMs + ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS >
    leaseSeconds * 1_000
  ) {
    throw new AccessFulfillmentConfigError(
      "ACCESS_EMAIL_PROVIDER_TIMEOUT_MS",
      "must leave the fixed safety margin within the fulfillment lease",
    );
  }

  return {
    workerEnabled,
    durableEmailDeliveryEnabled,
    legacyDirectEmailEnabled,
    workerDryRun,
    batchSize,
    pollIntervalMs,
    leaseSeconds,
    concurrency,
    rpcTimeoutMs,
    emailProviderTimeoutMs,
    emailEnabled,
  };
}
