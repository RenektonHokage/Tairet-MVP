import { createClient } from "@supabase/supabase-js";

import {
  verifySupabasePublicConfigIdentity,
  type SupabasePublicConfig,
} from "./publicConfig";

export type OperatorAuthTransport = Readonly<{
  signInWithPassword(credentials: Readonly<{
    email: string;
    password: string;
  }>): Promise<unknown>;
}>;

export type AcquireOperatorBearerInput = Readonly<{
  transport: OperatorAuthTransport;
  email: string;
  password: string;
  requiredLifecycleBudgetSeconds: number;
  nowEpochSeconds?: number;
}>;

export type OperatorBearerMetadata = Readonly<{
  projectRef: string;
  userId: string;
  sessionId: string;
  audience: "authenticated";
  tokenType: "bearer";
  issuedAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
  verifiedAtEpochSeconds: number;
  secondsRemaining: number;
  requiredLifecycleBudgetSeconds: number;
}>;

export type OperatorBearerLease = Readonly<{
  metadata: OperatorBearerMetadata;
  consume(): string;
  toJSON(): Readonly<{ metadata: OperatorBearerMetadata }>;
}>;

export type OperatorBearerErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REJECTED"
  | "MALFORMED_AUTH_RESPONSE"
  | "TOKEN_IDENTITY_MISMATCH"
  | "TOKEN_NOT_FRESH"
  | "TOKEN_ALREADY_CONSUMED";

type UnknownRecord = Record<string, unknown>;

const MAXIMUM_ACQUISITION_AGE_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 30;
const REQUIRED_FRESHNESS_MARGIN_SECONDS = 120;

function fail(code: OperatorBearerErrorCode): never {
  const error = new Error(code) as Error & { code: OperatorBearerErrorCode };
  error.name = "OperatorBearerError";
  error.code = code;
  throw error;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSafeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}

function decodeJwtPayload(token: string): UnknownRecord {
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    return fail("MALFORMED_AUTH_RESPONSE");
  }

  try {
    const decoded = Buffer.from(segments[1], "base64url").toString("utf8");
    const payload: unknown = JSON.parse(decoded);
    if (!isRecord(payload)) {
      return fail("MALFORMED_AUTH_RESPONSE");
    }
    return payload;
  } catch {
    return fail("MALFORMED_AUTH_RESPONSE");
  }
}

function hasAuthenticatedAudience(value: unknown): boolean {
  return (
    value === "authenticated" ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((entry) => typeof entry === "string") &&
      value.includes("authenticated"))
  );
}

export function createSupabasePasswordAuthTransport(
  config: SupabasePublicConfig,
): OperatorAuthTransport {
  verifySupabasePublicConfigIdentity(config);
  const client = createClient(config.projectUrl, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return Object.freeze({
    async signInWithPassword(credentials) {
      return client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
    },
  });
}

export async function acquireOperatorBearer(
  input: AcquireOperatorBearerInput,
): Promise<OperatorBearerLease> {
  if (
    !input ||
    !input.transport ||
    typeof input.transport.signInWithPassword !== "function" ||
    typeof input.email !== "string" ||
    input.email.trim().length === 0 ||
    typeof input.password !== "string" ||
    input.password.length === 0 ||
    !Number.isSafeInteger(input.requiredLifecycleBudgetSeconds) ||
    input.requiredLifecycleBudgetSeconds < 0
  ) {
    return fail("INVALID_INPUT");
  }

  const nowEpochSeconds =
    input.nowEpochSeconds ??
    Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(nowEpochSeconds) || nowEpochSeconds < 0) {
    return fail("INVALID_INPUT");
  }

  let response: unknown;
  try {
    response = await input.transport.signInWithPassword({
      email: input.email,
      password: input.password,
    });
  } catch {
    return fail("AUTH_REJECTED");
  }

  if (!isRecord(response)) {
    return fail("MALFORMED_AUTH_RESPONSE");
  }
  if (response.error !== null && response.error !== undefined) {
    return fail("AUTH_REJECTED");
  }
  if (!isRecord(response.data) || !isRecord(response.data.session) || !isRecord(response.data.user)) {
    return fail("MALFORMED_AUTH_RESPONSE");
  }

  const session = response.data.session;
  const user = response.data.user;
  const accessToken =
    typeof session.access_token === "string" && session.access_token.length > 0
      ? session.access_token
      : undefined;
  const tokenType =
    typeof session.token_type === "string"
      ? session.token_type.toLowerCase()
      : undefined;
  const expiresAtEpochSeconds = requireSafeInteger(session.expires_at);
  const userId =
    typeof user.id === "string" && user.id.length > 0
      ? user.id
      : undefined;
  if (
    !accessToken ||
    tokenType !== "bearer" ||
    expiresAtEpochSeconds === undefined ||
    !userId
  ) {
    return fail("MALFORMED_AUTH_RESPONSE");
  }

  const claims = decodeJwtPayload(accessToken);
  const issuedAtEpochSeconds = requireSafeInteger(claims.iat);
  const tokenExpiryEpochSeconds = requireSafeInteger(claims.exp);
  const subject = typeof claims.sub === "string" ? claims.sub : undefined;
  const issuer = typeof claims.iss === "string" ? claims.iss : undefined;
  const role = typeof claims.role === "string" ? claims.role : undefined;
  const sessionId =
    typeof claims.session_id === "string" && claims.session_id.length > 0
      ? claims.session_id
      : undefined;

  if (
    issuer !== "https://omteyctmrgahavgfaodw.supabase.co/auth/v1" ||
    !hasAuthenticatedAudience(claims.aud) ||
    role !== "authenticated" ||
    subject !== userId ||
    !sessionId ||
    issuedAtEpochSeconds === undefined ||
    tokenExpiryEpochSeconds !== expiresAtEpochSeconds
  ) {
    return fail("TOKEN_IDENTITY_MISMATCH");
  }

  if (
    issuedAtEpochSeconds > nowEpochSeconds + CLOCK_SKEW_SECONDS ||
    nowEpochSeconds - issuedAtEpochSeconds > MAXIMUM_ACQUISITION_AGE_SECONDS
  ) {
    return fail("TOKEN_NOT_FRESH");
  }

  const secondsRemaining = expiresAtEpochSeconds - nowEpochSeconds;
  if (
    secondsRemaining <
    input.requiredLifecycleBudgetSeconds + REQUIRED_FRESHNESS_MARGIN_SECONDS
  ) {
    return fail("TOKEN_NOT_FRESH");
  }

  const metadata: OperatorBearerMetadata = Object.freeze({
    projectRef: "omteyctmrgahavgfaodw",
    userId,
    sessionId,
    audience: "authenticated",
    tokenType: "bearer",
    issuedAtEpochSeconds,
    expiresAtEpochSeconds,
    verifiedAtEpochSeconds: nowEpochSeconds,
    secondsRemaining,
    requiredLifecycleBudgetSeconds: input.requiredLifecycleBudgetSeconds,
  });

  let unconsumedToken: string | undefined = accessToken;
  return Object.freeze({
    metadata,
    consume() {
      if (unconsumedToken === undefined) {
        return fail("TOKEN_ALREADY_CONSUMED");
      }
      const token = unconsumedToken;
      unconsumedToken = undefined;
      return token;
    },
    toJSON() {
      return Object.freeze({ metadata });
    },
  });
}
