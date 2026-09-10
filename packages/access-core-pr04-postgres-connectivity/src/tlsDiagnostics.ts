/** Result-only diagnostics. No messages, stacks, certificate objects or arbitrary causes. */
export const TLS_DIAGNOSTIC_CODES = Object.freeze([
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_UNTRUSTED', 'INVALID_CA',
  'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_UNSUPPORTED_PROTOCOL',
  'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA',
  'ECONNRESET', 'ETIMEDOUT', 'ABORT_ERR',
] as const);

type NativeCode = (typeof TLS_DIAGNOSTIC_CODES)[number];
type BoundedCode = NativeCode | 'NOT_AVAILABLE' | 'REDACTED_UNRECOGNIZED';
export type TlsFailureKind =
  | 'NONE' | 'CONNECT_THROW' | 'ERROR_EVENT' | 'CLOSE_BEFORE_SECURE_CONNECT'
  | 'ABORTED' | 'TLS_RESULT_REJECTED' | 'PEER_RESULT_REJECTED'
  | 'ADAPTER_REJECTED' | 'NOT_AVAILABLE';

export type TlsDiagnostics = Readonly<{
  schemaVersion: 'PR04_TLS_DIAGNOSTIC_V1';
  availability: 'OBSERVED' | 'NOT_AVAILABLE';
  stage: 'CP06' | 'CP07' | null;
  failureKind: TlsFailureKind;
  nodeErrorCode: BoundedCode;
  causeCode: BoundedCode;
  authorizationError: BoundedCode | 'NONE';
  authorized: boolean | 'NOT_AVAILABLE';
  secureConnectObserved: boolean | 'NOT_AVAILABLE';
}>;

/** Read a data property only. Never evaluate an error's message, stack or getters. */
function ownData(value: unknown, key: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function nativeCode(value: unknown): BoundedCode {
  if (value === undefined || value === null) return 'NOT_AVAILABLE';
  return typeof value === 'string' && (TLS_DIAGNOSTIC_CODES as readonly string[]).includes(value)
    ? value as NativeCode
    : 'REDACTED_UNRECOGNIZED';
}

export function unavailableTlsDiagnostics(
  stage: TlsDiagnostics['stage'] = null,
  failureKind: TlsFailureKind = 'NOT_AVAILABLE',
): TlsDiagnostics {
  return Object.freeze({
    schemaVersion: 'PR04_TLS_DIAGNOSTIC_V1', availability: 'NOT_AVAILABLE', stage, failureKind,
    nodeErrorCode: 'NOT_AVAILABLE', causeCode: 'NOT_AVAILABLE',
    authorizationError: 'NOT_AVAILABLE', authorized: 'NOT_AVAILABLE',
    secureConnectObserved: 'NOT_AVAILABLE',
  });
}

export function observeTlsDiagnostics(input: Readonly<{
  failureKind: TlsFailureKind;
  error?: unknown;
  socketAvailable: boolean;
  authorizationError?: unknown;
  authorized?: unknown;
  secureConnectObserved?: boolean;
}>): TlsDiagnostics {
  const authError = input.authorizationError;
  return Object.freeze({
    schemaVersion: 'PR04_TLS_DIAGNOSTIC_V1', availability: 'OBSERVED', stage: 'CP06',
    failureKind: input.failureKind,
    nodeErrorCode: nativeCode(ownData(input.error, 'code')),
    causeCode: nativeCode(ownData(ownData(input.error, 'cause'), 'code')),
    authorizationError: !input.socketAvailable ? 'NOT_AVAILABLE'
      : authError === undefined || authError === null ? 'NONE'
        : nativeCode(typeof authError === 'string' ? authError : ownData(authError, 'code')),
    authorized: input.socketAvailable && typeof input.authorized === 'boolean'
      ? input.authorized : 'NOT_AVAILABLE',
    secureConnectObserved: input.secureConnectObserved ?? 'NOT_AVAILABLE',
  });
}

export class TlsDiagnosticError extends Error {
  constructor(readonly tlsDiagnostics: TlsDiagnostics) {
    super('PRODUCTION_TLS_IDENTITY_MISMATCH');
    this.name = 'TlsDiagnosticError';
  }
}

export function diagnosticForCaughtTlsError(error: unknown, aborted: boolean): TlsDiagnostics {
  if (error instanceof TlsDiagnosticError) return error.tlsDiagnostics;
  return observeTlsDiagnostics({
    failureKind: aborted ? 'ABORTED' : 'ADAPTER_REJECTED', error, socketAvailable: false,
  });
}
