import type { AccessEmailMessage } from "./accessEmailMessage";

export interface AccessEmailProviderSendInput {
  readonly idempotencyKey: string;
  readonly requestPayloadHash: string;
  readonly templateVersion: string;
  readonly message: AccessEmailMessage;
}

export interface AccessEmailProviderSendOptions {
  readonly signal?: AbortSignal;
}

export type AccessEmailProviderOutcome =
  | {
      readonly kind: "accepted";
      readonly providerMessageId: string;
    }
  | {
      readonly kind: "failed_retryable";
      readonly errorCode: string;
      readonly retryAfterSeconds?: number;
    }
  | {
      readonly kind: "failed_terminal";
      readonly errorCode: string;
    }
  | {
      readonly kind: "ambiguous";
      readonly errorCode: string;
      readonly retryAfterSeconds?: number;
    };

/**
 * Slice 9E.5B3 owns the adapter-specific SDK call, headers or endpoint,
 * timeout, and transport/status classification. They are intentionally
 * absent from this provider-neutral contract.
 */
export interface AccessEmailProvider {
  send(
    input: AccessEmailProviderSendInput,
    options?: AccessEmailProviderSendOptions,
  ): Promise<AccessEmailProviderOutcome>;
}
