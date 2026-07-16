import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS,
  ACCESS_FULFILLMENT_LIMITS,
  AccessFulfillmentConfigError,
  loadAccessFulfillmentConfig,
} from "./accessFulfillment";

const WORKER_ONLY_BASE = {
  ACCESS_FULFILLMENT_WORKER_ENABLED: "true",
  ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "false",
  ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
} as const;

const DURABLE_BASE = {
  ACCESS_FULFILLMENT_WORKER_ENABLED: "false",
  ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "true",
  ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
  EMAIL_ENABLED: "true",
  RESEND_API_KEY: "test-key",
  EMAIL_FROM_ADDRESS: "access@example.test",
} as const;

describe("loadAccessFulfillmentConfig", () => {
  it("loads the documented safe defaults without reading process.env", () => {
    assert.deepEqual(loadAccessFulfillmentConfig({}), {
      workerEnabled: false,
      durableEmailDeliveryEnabled: false,
      legacyDirectEmailEnabled: true,
      workerDryRun: true,
      batchSize: 5,
      pollIntervalMs: 5_000,
      leaseSeconds: 300,
      concurrency: 2,
      rpcTimeoutMs: 10_000,
      emailEnabled: false,
    });
  });

  it("accepts all four reconcile-only dry-run and email switch combinations", () => {
    for (const dryRun of ["true", "false"]) {
      for (const emailEnabled of ["true", "false"]) {
        const config = loadAccessFulfillmentConfig({
          ...WORKER_ONLY_BASE,
          ACCESS_FULFILLMENT_WORKER_DRY_RUN: dryRun,
          EMAIL_ENABLED: emailEnabled,
        });

        assert.equal(config.workerEnabled, true);
        assert.equal(config.durableEmailDeliveryEnabled, false);
        assert.equal(config.legacyDirectEmailEnabled, false);
        assert.equal(config.workerDryRun, dryRun === "true");
        assert.equal(config.emailEnabled, emailEnabled === "true");
      }
    }
  });

  it("rejects legacy delivery with the worker regardless of dry-run", () => {
    for (const dryRun of ["true", "false"]) {
      assert.throws(
        () =>
          loadAccessFulfillmentConfig({
            ACCESS_FULFILLMENT_WORKER_ENABLED: "true",
            ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "false",
            ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "true",
            ACCESS_FULFILLMENT_WORKER_DRY_RUN: dryRun,
          }),
        (error: unknown) =>
          error instanceof AccessFulfillmentConfigError &&
          error.field === "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED",
      );
    }
  });

  it("rejects legacy and durable delivery together", () => {
    assert.throws(
      () =>
        loadAccessFulfillmentConfig({
          ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "true",
          ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "true",
        }),
      AccessFulfillmentConfigError,
    );
  });

  it("requires the email switch and both provider settings for durable delivery", () => {
    assert.throws(
      () =>
        loadAccessFulfillmentConfig({
          ...DURABLE_BASE,
          EMAIL_ENABLED: "false",
        }),
      (error: unknown) =>
        error instanceof AccessFulfillmentConfigError && error.field === "EMAIL_ENABLED",
    );

    assert.throws(
      () => {
        const withoutKey = Object.fromEntries(
          Object.entries(DURABLE_BASE).filter(([field]) => field !== "RESEND_API_KEY"),
        );
        loadAccessFulfillmentConfig(withoutKey);
      },
      (error: unknown) =>
        error instanceof AccessFulfillmentConfigError && error.field === "RESEND_API_KEY",
    );

    assert.throws(
      () => {
        const withoutFrom = Object.fromEntries(
          Object.entries(DURABLE_BASE).filter(([field]) => field !== "EMAIL_FROM_ADDRESS"),
        );
        loadAccessFulfillmentConfig(withoutFrom);
      },
      (error: unknown) =>
        error instanceof AccessFulfillmentConfigError && error.field === "EMAIL_FROM_ADDRESS",
    );

    assert.equal(loadAccessFulfillmentConfig(DURABLE_BASE).durableEmailDeliveryEnabled, true);
  });

  it("allows a complete pause and keeps worker-off independent of HTTP configuration", () => {
    const config = loadAccessFulfillmentConfig({
      ACCESS_FULFILLMENT_WORKER_ENABLED: "false",
      ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "false",
      ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
    });

    assert.equal(config.workerEnabled, false);
    assert.equal(config.durableEmailDeliveryEnabled, false);
    assert.equal(config.legacyDirectEmailEnabled, false);
  });

  it("rejects ambiguous boolean representations without echoing their values", () => {
    for (const value of ["1", "TRUE", " yes ", "top-secret"]) {
      assert.throws(
        () =>
          loadAccessFulfillmentConfig({
            ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: value,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AccessFulfillmentConfigError);
          assert.equal(error.field, "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED");
          assert.equal(error.message.includes(value), false);
          return true;
        },
      );
    }
    assert.throws(
      () =>
        loadAccessFulfillmentConfig({
          ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "",
        }),
      AccessFulfillmentConfigError,
    );
  });

  it("enforces integer syntax and every documented range", () => {
    const cases = [
      ["ACCESS_FULFILLMENT_BATCH_SIZE", "0", "101"],
      ["ACCESS_FULFILLMENT_POLL_INTERVAL_MS", "999", "60001"],
      ["ACCESS_FULFILLMENT_LEASE_SECONDS", "29", "901"],
      ["ACCESS_FULFILLMENT_CONCURRENCY", "0", "17"],
      ["ACCESS_FULFILLMENT_RPC_TIMEOUT_MS", "999", "25001"],
    ] as const;

    for (const [field, below, above] of cases) {
      for (const value of [below, above, "1.5", "01", " 1"]) {
        assert.throws(
          () =>
            loadAccessFulfillmentConfig({
              ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
              [field]: value,
            }),
          (error: unknown) => error instanceof AccessFulfillmentConfigError && error.field === field,
        );
      }
    }
  });

  it("accepts the inclusive numeric boundaries", () => {
    const minimums = loadAccessFulfillmentConfig({
      ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
      ACCESS_FULFILLMENT_BATCH_SIZE: String(ACCESS_FULFILLMENT_LIMITS.batchSize.min),
      ACCESS_FULFILLMENT_POLL_INTERVAL_MS: String(
        ACCESS_FULFILLMENT_LIMITS.pollIntervalMs.min,
      ),
      ACCESS_FULFILLMENT_LEASE_SECONDS: String(ACCESS_FULFILLMENT_LIMITS.leaseSeconds.min),
      ACCESS_FULFILLMENT_CONCURRENCY: String(ACCESS_FULFILLMENT_LIMITS.concurrency.min),
      ACCESS_FULFILLMENT_RPC_TIMEOUT_MS: String(
        ACCESS_FULFILLMENT_LIMITS.rpcTimeoutMs.min,
      ),
    });
    const maximums = loadAccessFulfillmentConfig({
      ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
      ACCESS_FULFILLMENT_BATCH_SIZE: String(ACCESS_FULFILLMENT_LIMITS.batchSize.max),
      ACCESS_FULFILLMENT_POLL_INTERVAL_MS: String(
        ACCESS_FULFILLMENT_LIMITS.pollIntervalMs.max,
      ),
      ACCESS_FULFILLMENT_LEASE_SECONDS: String(ACCESS_FULFILLMENT_LIMITS.leaseSeconds.max),
      ACCESS_FULFILLMENT_CONCURRENCY: String(ACCESS_FULFILLMENT_LIMITS.concurrency.max),
      ACCESS_FULFILLMENT_RPC_TIMEOUT_MS: String(
        ACCESS_FULFILLMENT_LIMITS.rpcTimeoutMs.max,
      ),
    });

    assert.equal(minimums.batchSize, 1);
    assert.equal(minimums.pollIntervalMs, 1_000);
    assert.equal(minimums.leaseSeconds, 30);
    assert.equal(minimums.concurrency, 1);
    assert.equal(minimums.rpcTimeoutMs, 1_000);
    assert.equal(maximums.batchSize, 100);
    assert.equal(maximums.pollIntervalMs, 60_000);
    assert.equal(maximums.leaseSeconds, 900);
    assert.equal(maximums.concurrency, 16);
    assert.equal(maximums.rpcTimeoutMs, 25_000);
  });

  it("accepts the tightest timeout and lease boundary without extending the lease", () => {
    const config = loadAccessFulfillmentConfig({
      ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
      ACCESS_FULFILLMENT_LEASE_SECONDS: "30",
      ACCESS_FULFILLMENT_RPC_TIMEOUT_MS: "25000",
    });

    assert.equal(
      config.rpcTimeoutMs + ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS,
      config.leaseSeconds * 1_000,
    );
  });
});
