import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type { BancardConfirmInput } from "../schemas/bancardConfirm";
import type { AccessOrderEntriesEmailResult } from "./accessEmails";
import {
  confirmBancardAccessPayment,
  type BancardConfirmDependencies,
} from "./bancardConfirm";

const PRIVATE_KEY = "private-key-test-sentinel";
const INVALID_GATE_VALUE = "raw-invalid-authority-test-sentinel";
const BUYER_EMAIL = "buyer-private@example.test";
const BUYER_NAME = "Buyer Private Name";
const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const PAYMENT_ATTEMPT_ID = "00000000-0000-4000-8000-000000000002";
const PUBLIC_REF = "acc_00000000000000000000000000000001";

const APPROVED_CONFIRM_RESULT = {
  ok: true,
  status: "approved",
  idempotent: false,
  manual_review: false,
  order_id: ORDER_ID,
  payment_attempt_id: PAYMENT_ATTEMPT_ID,
  public_ref: PUBLIC_REF,
};

const ISSUED_RESULT = {
  ok: true,
  status: "issued",
  public_ref: PUBLIC_REF,
  expected_entries: 2,
  existing_entries_before: 0,
  inserted_entries: 2,
  total_entries: 2,
  idempotent: false,
};

const SENT_RESULT: AccessOrderEntriesEmailResult = {
  ok: true,
  status: "sent",
  entriesClaimed: 2,
  entriesSent: 2,
};

interface RpcStubResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

interface ScenarioOptions {
  includePrivateKey?: boolean;
  validToken?: boolean;
  legacyGate?: string;
  mutateLegacyGateDuringConfirm?: string;
  confirmResponse?: RpcStubResponse;
  issueResponse?: RpcStubResponse;
  loaderThrows?: boolean;
  senderThrows?: boolean;
  senderThrowMessage?: string;
  senderResult?: AccessOrderEntriesEmailResult;
}

interface ScenarioState {
  events: string[];
  rpcCalls: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }>;
  senderLoaderCalls: number;
  senderCalls: number;
  senderInputs: Array<{ orderId: string; publicRef?: string | null }>;
  logs: LogEntry[];
}

function md5Hex(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function makeInput(validToken = true): BancardConfirmInput {
  const operation = {
    shop_process_id: "shop-process-test",
    amount: "125000.00",
    currency: "PYG" as const,
    response_code: "00",
    response: "S",
    response_details: "approved",
    extended_response_description: null,
    iva_amount: null,
    authorization_number: "authorization-test",
    ticket_number: "ticket-test",
    response_description: "approved",
    security_information: {
      buyer_email: BUYER_EMAIL,
      buyer_name: BUYER_NAME,
    },
    buyer_email: BUYER_EMAIL,
    buyer_name: BUYER_NAME,
  };
  const valid = md5Hex(
    `${PRIVATE_KEY}${operation.shop_process_id}confirm${operation.amount}${operation.currency}`,
  );

  return {
    operation: {
      ...operation,
      token: validToken ? valid : "0".repeat(32),
    },
  };
}

function createScenario(options: ScenarioOptions = {}): {
  input: BancardConfirmInput;
  dependencies: BancardConfirmDependencies;
  state: ScenarioState;
} {
  const input = makeInput(options.validToken !== false);
  const env: Record<string, string | undefined> = {};
  if (options.includePrivateKey !== false) {
    env.BANCARD_PRIVATE_KEY = PRIVATE_KEY;
  }
  if (options.legacyGate !== undefined) {
    env.ACCESS_LEGACY_DIRECT_EMAIL_ENABLED = options.legacyGate;
  }

  const state: ScenarioState = {
    events: [],
    rpcCalls: [],
    senderLoaderCalls: 0,
    senderCalls: 0,
    senderInputs: [],
    logs: [],
  };

  const logger: NonNullable<BancardConfirmDependencies["logger"]> = {
    info(message, metadata) {
      state.logs.push({ level: "info", message, metadata });
    },
    warn(message, metadata) {
      state.logs.push({ level: "warn", message, metadata });
    },
    error(message, metadata) {
      state.logs.push({ level: "error", message, metadata });
    },
  };

  const rpc: NonNullable<BancardConfirmDependencies["rpc"]> = async (
    name,
    parameters,
  ) => {
    state.events.push(
      name === "confirm_bancard_access_payment" ? "confirm" : "issue",
    );
    state.rpcCalls.push({ name, parameters });

    if (name === "confirm_bancard_access_payment") {
      if (options.mutateLegacyGateDuringConfirm !== undefined) {
        env.ACCESS_LEGACY_DIRECT_EMAIL_ENABLED =
          options.mutateLegacyGateDuringConfirm;
      }
      return (
        options.confirmResponse ?? {
          data: APPROVED_CONFIRM_RESULT,
          error: null,
        }
      );
    }

    return (
      options.issueResponse ?? {
        data: ISSUED_RESULT,
        error: null,
      }
    );
  };

  const loadLegacyEmailSender: NonNullable<
    BancardConfirmDependencies["loadLegacyEmailSender"]
  > = async () => {
    state.senderLoaderCalls += 1;
    state.events.push("loader");
    if (options.loaderThrows) {
      throw new Error(options.senderThrowMessage ?? "loader failed");
    }

    return async (senderInput) => {
      state.senderCalls += 1;
      state.events.push("sender");
      state.senderInputs.push(senderInput);
      if (options.senderThrows) {
        throw new Error(options.senderThrowMessage ?? "sender failed");
      }
      return options.senderResult ?? SENT_RESULT;
    };
  };

  return {
    input,
    dependencies: {
      env,
      rpc,
      logger,
      loadLegacyEmailSender,
    },
    state,
  };
}

async function runScenario(options: ScenarioOptions = {}) {
  const scenario = createScenario(options);
  const callbackResult = await confirmBancardAccessPayment(
    scenario.input,
    scenario.dependencies,
  );
  return { ...scenario, callbackResult };
}

function assertErrorResult(value: unknown, status: number): void {
  assert.deepEqual(value, {
    status,
    body: { status: "error" },
  });
}

function assertSuccessResult(value: unknown): void {
  assert.deepEqual(value, {
    status: 200,
    body: { status: "success" },
  });
}

function assertNoLegacyEmail(state: ScenarioState): void {
  assert.equal(state.senderLoaderCalls, 0);
  assert.equal(state.senderCalls, 0);
}

describe("confirmBancardAccessPayment legacy email authority gate", () => {
  it("rejects a missing private key before every dependency", async () => {
    const { callbackResult, state } = await runScenario({
      includePrivateKey: false,
    });

    assertErrorResult(callbackResult, 500);
    assert.equal(state.rpcCalls.length, 0);
    assertNoLegacyEmail(state);
  });

  it("preserves timing-safe token rejection before the authority gate", async () => {
    const { callbackResult, state } = await runScenario({
      validToken: false,
      legacyGate: INVALID_GATE_VALUE,
    });

    assertErrorResult(callbackResult, 401);
    assert.equal(state.rpcCalls.length, 0);
    assertNoLegacyEmail(state);
  });

  it("fails closed on an invalid legacy gate before the first RPC", async () => {
    const { callbackResult, state } = await runScenario({
      legacyGate: INVALID_GATE_VALUE,
    });

    assertErrorResult(callbackResult, 500);
    assert.equal(state.rpcCalls.length, 0);
    assertNoLegacyEmail(state);
    assert.deepEqual(state.logs.at(-1), {
      level: "error",
      message: "Bancard confirm legacy email authority configuration is invalid",
      metadata: {
        shopProcessId: "shop-process-test",
        responseCode: "00",
        errorCode: "invalid_access_fulfillment_configuration",
        field: "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED",
      },
    });
  });

  it("preserves default-true approved confirm, issue, and sender order", async () => {
    const { callbackResult, state } = await runScenario();

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue", "loader", "sender"]);
    assert.equal(state.senderLoaderCalls, 1);
    assert.equal(state.senderCalls, 1);
    assert.deepEqual(state.senderInputs, [
      { orderId: ORDER_ID, publicRef: PUBLIC_REF },
    ]);
  });

  it("preserves explicit-true legacy delivery", async () => {
    const { callbackResult, state } = await runScenario({
      legacyGate: "true",
    });

    assertSuccessResult(callbackResult);
    assert.equal(state.senderLoaderCalls, 1);
    assert.equal(state.senderCalls, 1);
  });

  it("skips both loader and sender when the gate is false", async () => {
    const { callbackResult, state } = await runScenario({
      legacyGate: "false",
    });

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue"]);
    assert.equal(state.senderLoaderCalls, 0);
    assert.equal(state.senderCalls, 0);
    assert.ok(
      state.logs.some(
        (entry) =>
          entry.message
          === "Access Core legacy entries email skipped by authority gate after Bancard confirm",
      ),
    );
  });

  it("reads and freezes the false gate before confirm mutates the env", async () => {
    const { callbackResult, state } = await runScenario({
      legacyGate: "false",
      mutateLegacyGateDuringConfirm: "true",
    });

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue"]);
    assertNoLegacyEmail(state);
  });

  it("does not issue or load email for rejected and manual-review results", async () => {
    for (const status of ["rejected", "manual_review"]) {
      const { callbackResult, state } = await runScenario({
        confirmResponse: {
          data: {
            ok: true,
            status,
            idempotent: false,
            manual_review: status === "manual_review",
          },
          error: null,
        },
      });

      assertSuccessResult(callbackResult);
      assert.deepEqual(state.events, ["confirm"]);
      assertNoLegacyEmail(state);
    }
  });

  it("does not load email after a confirm RPC error", async () => {
    const { callbackResult, state } = await runScenario({
      confirmResponse: {
        data: null,
        error: { code: "confirm_failed", message: BUYER_EMAIL },
      },
    });

    assertErrorResult(callbackResult, 500);
    assert.deepEqual(state.events, ["confirm"]);
    assertNoLegacyEmail(state);
  });

  it("does not load email after a malformed confirm response", async () => {
    const { callbackResult, state } = await runScenario({
      confirmResponse: { data: null, error: null },
    });

    assertErrorResult(callbackResult, 500);
    assert.deepEqual(state.events, ["confirm"]);
    assertNoLegacyEmail(state);
  });

  it("does not load email after an issue RPC error", async () => {
    const { callbackResult, state } = await runScenario({
      issueResponse: {
        data: null,
        error: { code: "issue_failed", message: BUYER_NAME },
      },
    });

    assertErrorResult(callbackResult, 500);
    assert.deepEqual(state.events, ["confirm", "issue"]);
    assertNoLegacyEmail(state);
  });

  it("does not load email after a malformed issue response", async () => {
    const { callbackResult, state } = await runScenario({
      issueResponse: { data: null, error: null },
    });

    assertErrorResult(callbackResult, 500);
    assert.deepEqual(state.events, ["confirm", "issue"]);
    assertNoLegacyEmail(state);
  });

  it("requires approved identifiers before issuing or loading email", async () => {
    const { callbackResult, state } = await runScenario({
      confirmResponse: {
        data: {
          ok: true,
          status: "approved",
          public_ref: PUBLIC_REF,
        },
        error: null,
      },
    });

    assertErrorResult(callbackResult, 500);
    assert.deepEqual(state.events, ["confirm"]);
    assertNoLegacyEmail(state);
  });

  it("keeps a controlled sender failure non-blocking after issuance", async () => {
    const { callbackResult, state } = await runScenario({
      senderResult: {
        ok: false,
        status: "failed",
        entriesClaimed: 2,
        entriesSent: 0,
        errorCode: "email_send_failed",
      },
    });

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue", "loader", "sender"]);
    assert.ok(
      state.logs.some(
        (entry) =>
          entry.level === "warn"
          && entry.message
            === "Access Core entries email failed after Bancard confirm",
      ),
    );
  });

  it("keeps a sender loader failure non-blocking after issuance", async () => {
    const { callbackResult, state } = await runScenario({
      loaderThrows: true,
    });

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue", "loader"]);
    assert.equal(state.senderLoaderCalls, 1);
    assert.equal(state.senderCalls, 0);
  });

  it("keeps a sender throw non-blocking after issuance", async () => {
    const { callbackResult, state } = await runScenario({
      senderThrows: true,
    });

    assertSuccessResult(callbackResult);
    assert.deepEqual(state.events, ["confirm", "issue", "loader", "sender"]);
    assert.equal(state.senderLoaderCalls, 1);
    assert.equal(state.senderCalls, 1);
  });

  it("never logs secrets, tokens, buyer PII, email, or raw invalid values", async () => {
    const invalid = await runScenario({
      legacyGate: INVALID_GATE_VALUE,
    });
    const sensitiveError =
      `${PRIVATE_KEY} ${invalid.input.operation.token} ${BUYER_NAME} ${BUYER_EMAIL}`;
    const senderFailure = await runScenario({
      senderThrows: true,
      senderThrowMessage: sensitiveError,
    });
    const issueFailure = await runScenario({
      issueResponse: {
        data: null,
        error: { code: "issue_failed", message: sensitiveError },
      },
    });
    const serializedLogs = JSON.stringify([
      ...invalid.state.logs,
      ...senderFailure.state.logs,
      ...issueFailure.state.logs,
    ]);

    for (const forbidden of [
      PRIVATE_KEY,
      invalid.input.operation.token,
      BUYER_NAME,
      BUYER_EMAIL,
      INVALID_GATE_VALUE,
    ]) {
      assert.equal(serializedLogs.includes(forbidden), false);
    }
  });
});
