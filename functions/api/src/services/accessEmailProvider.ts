export interface AccessEmailProviderSendInput {
  idempotencyKey: string;
  requestPayloadHash: string;
  templateVersion: string;
}

export type AccessEmailProviderOutcome =
  | {
      kind: "accepted";
      providerMessageId: string;
    }
  | {
      kind: "failed_retryable";
      errorCode: string;
      retryAfterSeconds?: number;
    }
  | {
      kind: "failed_terminal";
      errorCode: string;
    }
  | {
      kind: "ambiguous";
      errorCode: string;
      retryAfterSeconds?: number;
    };

/**
 * Slice 9E.5B3 owns the adapter-specific SDK call, headers or endpoint,
 * timeout, and transport/status classification. They are intentionally
 * absent from this provider-neutral contract.
 */
export interface AccessEmailProvider {
  send(input: AccessEmailProviderSendInput): Promise<AccessEmailProviderOutcome>;
}
