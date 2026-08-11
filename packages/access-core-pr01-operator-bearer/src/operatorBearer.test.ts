import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireOperatorBearer,
  type OperatorAuthTransport,
} from "./operatorBearer";

const NOW = 1_700_000_000;
const PASSWORD = "synthetic-password-never-persist";
const REFRESH_TOKEN = "synthetic-refresh-never-return";

function syntheticJwt(overrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
    "utf8",
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://omteyctmrgahavgfaodw.supabase.co/auth/v1",
      aud: "authenticated",
      role: "authenticated",
      sub: "operator-user-id",
      session_id: "synthetic-session-id",
      iat: NOW,
      exp: NOW + 1_000,
      ...overrides,
    }),
    "utf8",
  ).toString("base64url");
  return `${header}.${payload}.synthetic-signature`;
}

function transportFor(response: unknown): {
  transport: OperatorAuthTransport;
  calls: () => number;
} {
  let count = 0;
  return {
    transport: {
      async signInWithPassword() {
        count += 1;
        return response;
      },
    },
    calls: () => count,
  };
}

function authResponse(
  token: string,
  expiresAt: number = NOW + 1_000,
): unknown {
  return {
    data: {
      user: { id: "operator-user-id" },
      session: {
        access_token: token,
        refresh_token: REFRESH_TOKEN,
        token_type: "bearer",
        expires_at: expiresAt,
      },
    },
    error: null,
  };
}

test("returns a one-use in-memory bearer lease with safe metadata", async () => {
  const token = syntheticJwt();
  const mock = transportFor(authResponse(token));
  const lease = await acquireOperatorBearer({
    transport: mock.transport,
    email: "operator@example.invalid",
    password: PASSWORD,
    requiredLifecycleBudgetSeconds: 600,
    nowEpochSeconds: NOW,
  });

  assert.equal(mock.calls(), 1);
  const serialized = JSON.stringify(lease);
  assert.equal(serialized.includes(PASSWORD), false);
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes(REFRESH_TOKEN), false);
  assert.equal(lease.metadata.secondsRemaining, 1_000);
  assert.equal(lease.consume().length > 0, true);
  assert.throws(
    () => lease.consume(),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "TOKEN_ALREADY_CONSUMED" &&
      !error.message.includes(token),
  );
});

test("maps invalid credentials to a non-sensitive error", async () => {
  const mock = transportFor({
    data: { user: null, session: null },
    error: { message: `invalid ${PASSWORD}` },
  });

  await assert.rejects(
    acquireOperatorBearer({
      transport: mock.transport,
      email: "operator@example.invalid",
      password: PASSWORD,
      requiredLifecycleBudgetSeconds: 1,
      nowEpochSeconds: NOW,
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "AUTH_REJECTED" &&
      !error.message.includes(PASSWORD),
  );
});

test("fails closed on malformed auth response shapes", async () => {
  const malformed = transportFor({
    data: { user: { id: "operator-user-id" }, session: { access_token: 42 } },
    error: null,
  });

  await assert.rejects(
    acquireOperatorBearer({
      transport: malformed.transport,
      email: "operator@example.invalid",
      password: PASSWORD,
      requiredLifecycleBudgetSeconds: 1,
      nowEpochSeconds: NOW,
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "MALFORMED_AUTH_RESPONSE",
  );
});

test("rejects expired, stale and near-expiry tokens", async () => {
  const cases = [
    authResponse(syntheticJwt({ iat: NOW - 61 }), NOW + 1_000),
    authResponse(syntheticJwt({ exp: NOW - 1 }), NOW - 1),
    authResponse(syntheticJwt({ exp: NOW + 719 }), NOW + 719),
  ];

  for (const response of cases) {
    const mock = transportFor(response);
    await assert.rejects(
      acquireOperatorBearer({
        transport: mock.transport,
        email: "operator@example.invalid",
        password: PASSWORD,
        requiredLifecycleBudgetSeconds: 600,
        nowEpochSeconds: NOW,
      }),
      (error: unknown) =>
        error instanceof Error && error.message === "TOKEN_NOT_FRESH",
    );
  }
});

test("rejects issuer, audience, role, subject and session mismatches", async () => {
  const tokens = [
    syntheticJwt({ iss: "https://example.invalid/auth/v1" }),
    syntheticJwt({ aud: "anon" }),
    syntheticJwt({ role: "service_role" }),
    syntheticJwt({ sub: "other-user" }),
    syntheticJwt({ session_id: "" }),
  ];

  for (const token of tokens) {
    const mock = transportFor(authResponse(token));
    await assert.rejects(
      acquireOperatorBearer({
        transport: mock.transport,
        email: "operator@example.invalid",
        password: PASSWORD,
        requiredLifecycleBudgetSeconds: 1,
        nowEpochSeconds: NOW,
      }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "TOKEN_IDENTITY_MISMATCH" &&
        !error.message.includes(token),
    );
  }
});

test("uses only the injected transport in deterministic unit tests", async () => {
  const token = syntheticJwt();
  const mock = transportFor(authResponse(token));
  await acquireOperatorBearer({
    transport: mock.transport,
    email: "operator@example.invalid",
    password: PASSWORD,
    requiredLifecycleBudgetSeconds: 1,
    nowEpochSeconds: NOW,
  });
  assert.equal(mock.calls(), 1);
});
