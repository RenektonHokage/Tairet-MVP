import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import type { ConnectionOptions, TLSSocket } from 'node:tls';
import {
  DIRECT_POSTGRES_TARGET, runDirectPostgresPreflight,
  type CredentialFreeNetworkAdapters,
} from './directPostgresPreflight';
import { startTlsWithConnector } from './tlsAdapter';
import {
  observeTlsDiagnostics, TlsDiagnosticError, TLS_DIAGNOSTIC_CODES,
  unavailableTlsDiagnostics, type TlsDiagnostics,
} from './tlsDiagnostics';

const CA_PATH = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-production-ca-acquisition-fd54f57f\\official-source\\prod-ca-2021.crt';
const CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const CA_BYTES = readFileSync(CA_PATH);
assert.equal(CA_BYTES.length, 1367);
assert.equal(createHash('sha256').update(CA_BYTES).digest('hex'), CA_SHA256);

class FakeTlsSocket extends EventEmitter {
  authorized = false;
  authorizationError: unknown = undefined;
  remoteAddress: string | undefined = '1.1.1.1';
  remotePort: number | undefined = 5432;
  remoteFamily = 'IPv4';
  destroyed = false;
  destroyCount = 0;
  protocol: string | null = 'TLSv1.3';
  destroy() { this.destroyed = true; this.destroyCount += 1; return this; }
  getProtocol() { return this.protocol; }
  getPeerCertificate(_detailed: boolean) { return { raw: Buffer.from('SYNTHETIC_CERT_BYTES') }; }
  getCipher() { return { name: 'TLS_AES_256_GCM_SHA384' }; }
}

function tlsInput(signal: AbortSignal, onDiagnostics?: (value: TlsDiagnostics) => void) {
  return {
    connection: { socket: { inert: true } }, ca: CA_BYTES, caSha256: CA_SHA256,
    servername: DIRECT_POSTGRES_TARGET.hostname, minimumVersion: 'TLSv1.2' as const,
    rejectUnauthorized: true as const, signal, onDiagnostics,
  };
}

const nativeError = () => Object.assign(new Error('SYNTHETIC_PRIVATE_MESSAGE_NOT_TO_RETAIN'), {
  code: 'ERR_TLS_CERT_ALTNAME_INVALID',
  cause: Object.assign(new Error('SYNTHETIC_PRIVATE_CAUSE_NOT_TO_RETAIN'), { code: 'CERT_HAS_EXPIRED' }),
});

test('closed diagnostic captures allowlisted codes and excludes free-form error material', () => {
  const value = observeTlsDiagnostics({
    failureKind: 'ERROR_EVENT', error: nativeError(), socketAvailable: true,
    authorized: false, authorizationError: 'CERT_HAS_EXPIRED', secureConnectObserved: false,
  });
  assert.deepEqual(Object.keys(value).sort(), [
    'schemaVersion','availability','stage','failureKind','nodeErrorCode','causeCode',
    'authorizationError','authorized','secureConnectObserved',
  ].sort());
  assert.equal(value.nodeErrorCode, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.equal(value.causeCode, 'CERT_HAS_EXPIRED');
  assert.equal(value.authorizationError, 'CERT_HAS_EXPIRED');
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE|message|stack|SYNTHETIC_CERT_BYTES/);
  assert.ok(Buffer.byteLength(JSON.stringify(value)) < 1024);
});

test('finite allowlist retains only known values and redacts unknown/oversized/non-string codes', () => {
  for (const code of TLS_DIAGNOSTIC_CODES) {
    assert.equal(observeTlsDiagnostics({ failureKind: 'ERROR_EVENT', error: { code }, socketAvailable: false }).nodeErrorCode, code);
  }
  for (const code of ['password=DO_NOT_RETAIN', 'X'.repeat(100_000), 7, { key: 'DO_NOT_RETAIN' }]) {
    const value = observeTlsDiagnostics({
      failureKind: 'ERROR_EVENT', error: { code, cause: { code } }, socketAvailable: true,
      authorizationError: code, authorized: false, secureConnectObserved: false,
    });
    assert.equal(value.nodeErrorCode, 'REDACTED_UNRECOGNIZED');
    assert.equal(value.causeCode, 'REDACTED_UNRECOGNIZED');
    assert.doesNotMatch(JSON.stringify(value), /DO_NOT_RETAIN|XXXXX/);
    assert.ok(Buffer.byteLength(JSON.stringify(value)) < 1024);
  }
});

test('missing codes and causes remain NOT_AVAILABLE; accessors are not evaluated', () => {
  let accessCount = 0;
  const error = Object.defineProperties({}, {
    code: { get() { accessCount += 1; throw new Error('DO_NOT_CALL'); } },
    cause: { get() { accessCount += 1; throw new Error('DO_NOT_CALL'); } },
    message: { get() { accessCount += 1; throw new Error('DO_NOT_CALL'); } },
    stack: { get() { accessCount += 1; throw new Error('DO_NOT_CALL'); } },
  });
  const value = observeTlsDiagnostics({ failureKind: 'ERROR_EVENT', error, socketAvailable: false });
  assert.equal(value.nodeErrorCode, 'NOT_AVAILABLE');
  assert.equal(value.causeCode, 'NOT_AVAILABLE');
  assert.equal(value.authorized, 'NOT_AVAILABLE');
  assert.equal(value.authorizationError, 'NOT_AVAILABLE');
  assert.equal(value.secureConnectObserved, 'NOT_AVAILABLE');
  assert.equal(accessCount, 0);
});

test('TLS error before secureConnect retains diagnostics while preserving exact transport options and cleanup', async () => {
  const socket = new FakeTlsSocket();
  socket.authorizationError = 'CERT_HAS_EXPIRED';
  const captured: TlsDiagnostics[] = [];
  const input = tlsInput(new AbortController().signal, (value) => captured.push(value));
  const originalSocket = input.connection.socket;
  let callCount = 0;
  const pending = startTlsWithConnector(input, (options) => {
    callCount += 1;
    assert.deepEqual(options, {
      ca: CA_BYTES, minVersion: 'TLSv1.2', rejectUnauthorized: true,
      servername: DIRECT_POSTGRES_TARGET.hostname, socket: originalSocket,
    });
    return socket as unknown as TLSSocket;
  });
  socket.emit('error', nativeError());
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof TlsDiagnosticError);
    assert.equal(error.tlsDiagnostics.nodeErrorCode, 'ERR_TLS_CERT_ALTNAME_INVALID');
    assert.equal(error.tlsDiagnostics.causeCode, 'CERT_HAS_EXPIRED');
    assert.equal(error.tlsDiagnostics.authorizationError, 'CERT_HAS_EXPIRED');
    assert.equal(error.tlsDiagnostics.secureConnectObserved, false);
    assert.equal(error.tlsDiagnostics.authorized, false);
    return true;
  });
  assert.equal(callCount, 1);
  assert.equal(captured.length, 1);
  assert.equal(socket.destroyCount, 1);
  assert.equal(socket.listenerCount('secureConnect'), 0);
  assert.equal(socket.listenerCount('error'), 0);
  assert.equal(socket.listenerCount('close'), 0);
});

test('synchronous connector failure records available code but no fabricated socket authorization', async () => {
  const pending = startTlsWithConnector(tlsInput(new AbortController().signal), () => { throw nativeError(); });
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof TlsDiagnosticError);
    assert.equal(error.tlsDiagnostics.failureKind, 'CONNECT_THROW');
    assert.equal(error.tlsDiagnostics.secureConnectObserved, false);
    assert.equal(error.tlsDiagnostics.authorized, 'NOT_AVAILABLE');
    assert.equal(error.tlsDiagnostics.authorizationError, 'NOT_AVAILABLE');
    return true;
  });
});

test('premature close records no secureConnect and does not invent an error code', async () => {
  const socket = new FakeTlsSocket();
  const pending = startTlsWithConnector(tlsInput(new AbortController().signal), () => socket as unknown as TLSSocket);
  socket.emit('close');
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof TlsDiagnosticError);
    assert.equal(error.tlsDiagnostics.failureKind, 'CLOSE_BEFORE_SECURE_CONNECT');
    assert.equal(error.tlsDiagnostics.secureConnectObserved, false);
    assert.equal(error.tlsDiagnostics.nodeErrorCode, 'NOT_AVAILABLE');
    return true;
  });
});

test('secureConnect is marked observed only on the actual event; peer fingerprint stays the existing projection', async () => {
  const socket = new FakeTlsSocket();
  socket.authorized = true;
  const captured: TlsDiagnostics[] = [];
  const pending = startTlsWithConnector(tlsInput(new AbortController().signal, (d) => captured.push(d)), () => socket as unknown as TLSSocket);
  assert.equal(captured.length, 0);
  socket.emit('secureConnect');
  const result = await pending;
  assert.equal(result.authorized, true);
  assert.equal(captured[0]?.secureConnectObserved, true);
  assert.equal(captured[0]?.failureKind, 'NONE');
  assert.equal(captured[0]?.authorizationError, 'NONE');
  assert.equal(result.peerCertificateSha256, createHash('sha256').update('SYNTHETIC_CERT_BYTES').digest('hex'));
  assert.equal(socket.destroyCount, 0);
});

type Scenario = 'error' | 'aborted' | 'no-code' | 'unauthorized' | 'peer-mismatch' | 'valid' | 'generic';
async function runScenario(scenario: Scenario) {
  const socket = new FakeTlsSocket();
  const tcp = { socket: { inert: true } };
  let onDeadline: (() => void) | undefined;
  let connectCount = 0;
  let closeCount = 0;
  let clearCount = 0;
  const adapters: CredentialFreeNetworkAdapters = {
    readFile: async () => CA_BYTES,
    resolveDns: async ({ hostname }) => ({ queriedHostname: hostname, resolver: ['synthetic-resolver'], records: [{ address: '1.1.1.1', family: 4, ttl: 60 }] }),
    inspectRoute: async ({ address, family }) => ({ address, family, usable: true, metric: 10 }),
    connectTcp: async ({ address, family, port }) => ({ connection: tcp, remoteAddress: address, remoteFamily: family, remotePort: port }),
    exchangeSslRequest: async () => Uint8Array.of(0x53),
    startTls: (input) => {
      if (scenario === 'generic') return Promise.reject(new Error('DO_NOT_RETAIN'));
      const pending = startTlsWithConnector(input, (options: ConnectionOptions) => {
        connectCount += 1;
        assert.equal(options.rejectUnauthorized, true);
        assert.equal(options.servername, DIRECT_POSTGRES_TARGET.hostname);
        assert.equal(options.minVersion, 'TLSv1.2');
        return socket as unknown as TLSSocket;
      });
      queueMicrotask(() => {
        if (scenario === 'aborted') { assert.ok(onDeadline); onDeadline(); }
        else if (scenario === 'error') { socket.authorizationError = 'CERT_HAS_EXPIRED'; socket.emit('error', nativeError()); }
        else if (scenario === 'no-code') socket.emit('error', new Error('DO_NOT_RETAIN'));
        else {
          socket.authorized = scenario !== 'unauthorized';
          if (scenario === 'unauthorized') socket.authorizationError = 'CERT_HAS_EXPIRED';
          if (scenario === 'peer-mismatch') socket.remoteAddress = '8.8.4.4';
          socket.emit('secureConnect');
        }
      });
      return pending;
    },
    closeConnection: async () => { closeCount += 1; if (!socket.destroyed) socket.destroy(); },
    setTimer: (callback, delay) => { assert.equal(delay, 10_000); onDeadline = callback; return 'SYNTHETIC_TIMER'; },
    clearTimer: () => { clearCount += 1; },
  };
  const result = await runDirectPostgresPreflight({
    adapters, caPath: CA_PATH, caSha256: CA_SHA256, timeoutMs: 10_000,
  });
  assert.equal(closeCount, 1);
  assert.equal(clearCount, 1);
  assert.equal(result.counters.retryCount, 0);
  assert.equal(result.counters.fallbackCount, 0);
  assert.equal(connectCount, scenario === 'generic' ? 0 : 1);
  return result;
}

test('real core+fake TLS producer conserves bounded failure and abort result JSON for Harness integration', async () => {
  const failed = await runScenario('error');
  assert.equal(failed.ok, false);
  assert.equal(failed.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(failed.failureStage, 'CP06');
  assert.equal(failed.tlsDiagnostics.failureKind, 'ERROR_EVENT');
  assert.equal(failed.tlsDiagnostics.nodeErrorCode, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.equal(failed.tlsDiagnostics.secureConnectObserved, false);
  const aborted = await runScenario('aborted');
  assert.equal(aborted.ok, false);
  assert.equal(aborted.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
  assert.equal(aborted.failureStage, 'CP06');
  assert.equal(aborted.tlsDiagnostics.failureKind, 'ABORTED');
  assert.equal(aborted.tlsDiagnostics.secureConnectObserved, false);
  assert.equal(aborted.tlsDiagnostics.authorized, false);
  const output = process.env.CP06_TEST_OUTPUT_ROOT;
  assert.ok(output, 'CP06_TEST_OUTPUT_ROOT must name the independent validation output directory');
  assert.match(output.replace(/\\/g, '/'), /^C:\/Users\/mateo\/AppData\/Local\/Temp\/.+/i);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'cp06-observed-failure.json'), `${JSON.stringify(failed)}\n`, { flag: 'wx' });
  writeFileSync(resolve(output, 'cp06-aborted.json'), `${JSON.stringify(aborted)}\n`, { flag: 'wx' });
});

test('no-code error remains observed without invented code/cause and without arbitrary message', async () => {
  const result = await runScenario('no-code');
  assert.equal(result.tlsDiagnostics.availability, 'OBSERVED');
  assert.equal(result.tlsDiagnostics.nodeErrorCode, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.causeCode, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.secureConnectObserved, false);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_RETAIN/);
});

test('unknown adapter rejection observes exception but not socket or secureConnect state', async () => {
  const result = await runScenario('generic');
  // This is the unchanged phase-based classification, not a native-code/root-cause finding.
  assert.equal(result.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(result.failureStage, 'CP06');
  assert.equal(result.tlsDiagnostics.failureKind, 'ADAPTER_REJECTED');
  assert.equal(result.tlsDiagnostics.availability, 'OBSERVED');
  assert.equal(result.tlsDiagnostics.nodeErrorCode, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.causeCode, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.authorizationError, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.authorized, 'NOT_AVAILABLE');
  assert.equal(result.tlsDiagnostics.secureConnectObserved, 'NOT_AVAILABLE');
  assert.doesNotMatch(JSON.stringify(result.tlsDiagnostics), /ERR_TLS_CERT_ALTNAME_INVALID|CERT_HAS_EXPIRED|DO_NOT_RETAIN/);
});

test('authorizationError availability is independent of authorization success', () => {
  const beforeSecureConnect = observeTlsDiagnostics({
    failureKind: 'ERROR_EVENT', socketAvailable: true, authorized: false,
    secureConnectObserved: false,
  });
  assert.equal(beforeSecureConnect.authorized, false);
  assert.equal(beforeSecureConnect.authorizationError, 'NONE');
  assert.equal(beforeSecureConnect.secureConnectObserved, false);
  const noSocket = observeTlsDiagnostics({ failureKind: 'CONNECT_THROW', socketAvailable: false });
  assert.equal(noSocket.authorized, 'NOT_AVAILABLE');
  assert.equal(noSocket.authorizationError, 'NOT_AVAILABLE');
  const withCode = observeTlsDiagnostics({
    failureKind: 'ERROR_EVENT', socketAvailable: true, authorized: false,
    authorizationError: Object.assign(new Error('UNSAFE_AUTH_MESSAGE'), { code: 'CERT_HAS_EXPIRED' }),
    secureConnectObserved: false,
  });
  assert.equal(withCode.authorizationError, 'CERT_HAS_EXPIRED');
  assert.doesNotMatch(JSON.stringify(withCode), /UNSAFE_AUTH_MESSAGE|stack|message/);
});

test('post-secureConnect authorization and peer gates retain their original failure stage', async () => {
  const unauthorized = await runScenario('unauthorized');
  assert.equal(unauthorized.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(unauthorized.failureStage, 'CP06');
  assert.equal(unauthorized.tlsDiagnostics.failureKind, 'TLS_RESULT_REJECTED');
  assert.equal(unauthorized.tlsDiagnostics.authorizationError, 'CERT_HAS_EXPIRED');
  assert.equal(unauthorized.tlsDiagnostics.secureConnectObserved, true);
  const peer = await runScenario('peer-mismatch');
  assert.equal(peer.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(peer.failureStage, 'CP07');
  assert.equal(peer.tlsDiagnostics.stage, 'CP07');
  assert.equal(peer.tlsDiagnostics.failureKind, 'PEER_RESULT_REJECTED');
  assert.equal(peer.tlsDiagnostics.secureConnectObserved, true);
});

test('successful candidate preserves classification and reports instrumentation rather than a new authority', async () => {
  const result = await runScenario('valid');
  assert.equal(result.ok, true);
  assert.equal(result.classification, 'DIRECT_POSTGRES_PREFLIGHT_PASS');
  assert.equal(result.tlsDiagnostics.failureKind, 'NONE');
  assert.equal(result.tlsDiagnostics.secureConnectObserved, true);
  assert.equal(result.tlsDiagnostics.authorized, true);
  assert.equal(result.counters.authenticationAttemptCount, 0);
  assert.equal(result.counters.startupMessageCount, 0);
  assert.equal(result.counters.sqlMessageCount, 0);
});

test('not reached is unavailable, never retroactively recorded legacy data', () => {
  assert.deepEqual(unavailableTlsDiagnostics(), {
    schemaVersion: 'PR04_TLS_DIAGNOSTIC_V1', availability: 'NOT_AVAILABLE', stage: null,
    failureKind: 'NOT_AVAILABLE', nodeErrorCode: 'NOT_AVAILABLE', causeCode: 'NOT_AVAILABLE',
    authorizationError: 'NOT_AVAILABLE', authorized: 'NOT_AVAILABLE', secureConnectObserved: 'NOT_AVAILABLE',
  });
});

// These observations come from the real candidate adapter and pure core. No
// operational entrypoint is imported and no normalized TLS result is fabricated.
type NormalizationTlsResult = Awaited<ReturnType<typeof startTlsWithConnector>>;
type SyntheticTerminal = 'secureConnect' | 'error' | 'close' | 'abort' | 'timeout';
type NormalizationFixture = Readonly<{
  authorizationError: unknown;
  authorized?: boolean;
  changeSocket?: (socket: FakeTlsSocket) => void;
  terminal?: SyntheticTerminal;
}>;
const normalizationObservations: unknown[] = [];
const noAuthorizationErrorCases = [
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
] as const;

function normalizationSocket(fixture: NormalizationFixture): FakeTlsSocket {
  const socket = new FakeTlsSocket();
  socket.authorized = fixture.authorized ?? true;
  socket.authorizationError = fixture.authorizationError;
  fixture.changeSocket?.(socket);
  return socket;
}

async function observeAdapterFixture(fixture: NormalizationFixture) {
  const socket = normalizationSocket(fixture);
  const controller = new AbortController();
  const diagnostics: TlsDiagnostics[] = [];
  const pending = startTlsWithConnector(
    tlsInput(controller.signal, (value) => diagnostics.push(value)),
    (options) => {
      assert.equal(options.rejectUnauthorized, true);
      assert.equal(options.minVersion, 'TLSv1.2');
      assert.equal(options.servername, DIRECT_POSTGRES_TARGET.hostname);
      assert.deepEqual(options.ca, CA_BYTES);
      assert.equal(options.checkServerIdentity, undefined);
      return socket as unknown as TLSSocket;
    },
  );
  const terminal = fixture.terminal ?? 'secureConnect';
  if (terminal === 'error') socket.emit('error', nativeError());
  else if (terminal === 'abort') controller.abort();
  else if (terminal === 'timeout') throw new Error('Use the core timer fixture for timeout');
  else socket.emit(terminal);
  let result: NormalizationTlsResult | undefined;
  let rejection: TlsDiagnostics | undefined;
  try { result = await pending; }
  catch (error: unknown) {
    assert.ok(error instanceof TlsDiagnosticError);
    rejection = error.tlsDiagnostics;
  }
  // A late secureConnect must not fabricate success after a terminal failure.
  if (terminal !== 'secureConnect') socket.emit('secureConnect');
  return {
    settlement: result === undefined ? 'rejected' : 'resolved',
    result, rejection, diagnostics, destroyCount: socket.destroyCount,
    secureConnectListenerCount: socket.listenerCount('secureConnect'),
    closeListenerCount: socket.listenerCount('close'),
  };
}

async function observeAdapterToCoreFixture(fixture: NormalizationFixture) {
  const socket = normalizationSocket(fixture);
  const connection = { socket: { inert: true } };
  let fireDeadline: (() => void) | undefined;
  let adapterResult: NormalizationTlsResult | undefined;
  let adapterRejection: TlsDiagnostics | undefined;
  let connectorCallCount = 0;
  let closeCount = 0;
  let clearTimerCount = 0;
  const adapterDiagnostics: TlsDiagnostics[] = [];
  const adapters: CredentialFreeNetworkAdapters = {
    readFile: async (path) => { assert.equal(path, CA_PATH); return CA_BYTES; },
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname, resolver: ['synthetic-resolver'],
      records: [{ address: '1.1.1.1', family: 4, ttl: 60 }],
    }),
    inspectRoute: async ({ address, family }) => ({ address, family, usable: true, metric: 10 }),
    connectTcp: async ({ address, family, port }) => ({
      connection, remoteAddress: address, remoteFamily: family, remotePort: port,
    }),
    exchangeSslRequest: async () => Uint8Array.of(0x53),
    startTls: (input) => {
      const pending = startTlsWithConnector({
        ...input,
        onDiagnostics: (diagnostic) => {
          adapterDiagnostics.push(diagnostic);
          input.onDiagnostics?.(diagnostic);
        },
      }, (options) => {
        connectorCallCount += 1;
        assert.equal(options.rejectUnauthorized, true);
        assert.equal(options.minVersion, 'TLSv1.2');
        assert.equal(options.servername, DIRECT_POSTGRES_TARGET.hostname);
        assert.deepEqual(options.ca, CA_BYTES);
        assert.equal(options.checkServerIdentity, undefined);
        return socket as unknown as TLSSocket;
      });
      queueMicrotask(() => {
        const terminal = fixture.terminal ?? 'secureConnect';
        if (terminal === 'timeout') { assert.ok(fireDeadline); fireDeadline(); }
        else if (terminal === 'error') socket.emit('error', nativeError());
        else if (terminal === 'abort') throw new Error('Use direct fixture for explicit abort');
        else socket.emit(terminal);
      });
      return pending.then((value) => {
        adapterResult = value;
        return value; // Exact adapter object flows to core, without substitutions.
      }, (error: unknown) => {
        if (error instanceof TlsDiagnosticError) adapterRejection = error.tlsDiagnostics;
        throw error;
      });
    },
    closeConnection: async () => { closeCount += 1; if (!socket.destroyed) socket.destroy(); },
    setTimer: (callback, delay) => {
      assert.equal(delay, 10_000); fireDeadline = callback; return 'NORMALIZATION_SYNTHETIC_TIMER';
    },
    clearTimer: () => { clearTimerCount += 1; },
  };
  const coreResult = await runDirectPostgresPreflight({
    adapters, caPath: CA_PATH, caSha256: CA_SHA256, timeoutMs: 10_000,
  });
  assert.equal(connectorCallCount, 1);
  assert.equal(closeCount, 1);
  assert.equal(clearTimerCount, 1);
  assert.equal(coreResult.counters.authenticationAttemptCount, 0);
  assert.equal(coreResult.counters.startupMessageCount, 0);
  assert.equal(coreResult.counters.sqlMessageCount, 0);
  assert.equal(coreResult.counters.retryCount, 0);
  assert.equal(coreResult.counters.fallbackCount, 0);
  return { adapterResult, adapterRejection, adapterDiagnostics, coreResult, connectorCallCount, closeCount, clearTimerCount };
}

async function observeBoth(label: string, fixture: NormalizationFixture) {
  const adapter = await observeAdapterFixture(fixture);
  const chain = await observeAdapterToCoreFixture(fixture);
  // Persist actual outputs before expectations are asserted, including baseline failures.
  normalizationObservations.push({ label, adapter, chain });
  return { adapter, chain };
}

function assertCoreCp06Rejected(chain: Awaited<ReturnType<typeof observeAdapterToCoreFixture>>) {
  assert.equal(chain.coreResult.ok, false);
  assert.equal(chain.coreResult.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(chain.coreResult.failureStage, 'CP06');
  assert.equal(chain.coreResult.tlsDiagnostics.failureKind, 'TLS_RESULT_REJECTED');
}

for (const absence of noAuthorizationErrorCases) {
  test(`normalization H: success diagnostics and result share one snapshot with ${absence.label}`, async () => {
    const socket = normalizationSocket({ authorizationError: absence.value });
    const diagnostics: TlsDiagnostics[] = [];
    const pending = startTlsWithConnector(tlsInput(new AbortController().signal, (diagnostic) => {
      diagnostics.push(diagnostic);
      // Instrumentation callback is deliberately adversarial. It must not turn
      // one success observation into a differently authorized returned result.
      socket.authorized = false;
      socket.authorizationError = 'CERT_HAS_EXPIRED';
    }), () => socket as unknown as TLSSocket);
    socket.emit('secureConnect');
    const result = await pending;
    normalizationObservations.push({ label: `single-snapshot/${absence.label}`, result, diagnostics });
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.authorized, true);
    assert.equal(diagnostics[0]?.authorizationError, 'NONE');
    assert.equal(diagnostics[0]?.secureConnectObserved, true);
    assert.equal(result.authorized, true);
    assert.equal(result.authorizationError, null);
    assert.equal(result.chainVerified, true);
    assert.equal(result.hostnameVerified, true);
    assert.equal(socket.authorized, false);
    assert.equal(socket.authorizationError, 'CERT_HAS_EXPIRED');
  });

  test(`normalization A/G/H: all-good ${absence.label} is coherent through real adapter and core`, async () => {
    const { adapter, chain } = await observeBoth(`all-good/${absence.label}`, { authorizationError: absence.value });
    assert.equal(adapter.settlement, 'resolved');
    assert.ok(adapter.result);
    assert.equal(adapter.result.authorized, true);
    assert.equal(adapter.result.authorizationError, null);
    assert.equal(adapter.result.chainVerified, true);
    assert.equal(adapter.result.hostnameVerified, true);
    assert.equal(adapter.diagnostics[0]?.authorizationError, 'NONE');
    assert.equal(adapter.diagnostics[0]?.authorized, true);
    assert.equal(adapter.diagnostics[0]?.secureConnectObserved, true);
    assert.equal(adapter.diagnostics[0]?.failureKind, 'NONE');
    assert.equal(adapter.destroyCount, 0);
    assert.equal(chain.coreResult.ok, true);
    assert.equal(chain.coreResult.classification, 'DIRECT_POSTGRES_PREFLIGHT_PASS');
    assert.equal(chain.coreResult.tlsDiagnostics.failureKind, 'NONE');
    assert.deepEqual(chain.adapterResult, adapter.result);
  });

  test(`normalization B: authorized=false with ${absence.label} cannot become success`, async () => {
    const { adapter, chain } = await observeBoth(`unauthorized/${absence.label}`, {
      authorizationError: absence.value, authorized: false,
    });
    assert.equal(adapter.result?.authorized, false);
    assert.equal(adapter.result?.authorizationError, null);
    assert.equal(adapter.result?.chainVerified, false);
    assert.equal(adapter.result?.hostnameVerified, false);
    assert.equal(adapter.diagnostics[0]?.authorizationError, 'NONE');
    assert.equal(adapter.diagnostics[0]?.authorized, false);
    assertCoreCp06Rejected(chain);
  });
}

const authorizationErrorFixtures = [
  { label: 'known-string', value: 'CERT_HAS_EXPIRED', diagnostic: 'CERT_HAS_EXPIRED' },
  { label: 'known-error-object', value: Object.assign(new Error('PRIVATE_NORMALIZATION_ERROR'), { code: 'CERT_HAS_EXPIRED' }), diagnostic: 'CERT_HAS_EXPIRED' },
  { label: 'empty-string', value: '', diagnostic: 'REDACTED_UNRECOGNIZED' },
  { label: 'false', value: false, diagnostic: 'NOT_AVAILABLE' },
  { label: 'zero', value: 0, diagnostic: 'NOT_AVAILABLE' },
  { label: 'NaN', value: Number.NaN, diagnostic: 'NOT_AVAILABLE' },
  { label: 'empty-object', value: {}, diagnostic: 'NOT_AVAILABLE' },
  { label: 'unrecognized-object-code', value: { code: 'PRIVATE_UNRECOGNIZED_CODE' }, diagnostic: 'REDACTED_UNRECOGNIZED' },
] as const;
for (const fixture of authorizationErrorFixtures) {
  test(`normalization C/E/H: ${fixture.label} retains rejection with other observations positive`, async () => {
    const observed = await observeBoth(`authorization-error/${fixture.label}`, { authorizationError: fixture.value });
    assert.equal(observed.adapter.settlement, 'resolved');
    assert.equal(observed.adapter.result?.authorized, true);
    assert.equal(observed.adapter.result?.authorizationError, 'TLS_AUTHORIZATION_ERROR');
    assert.equal(observed.adapter.result?.chainVerified, false);
    assert.equal(observed.adapter.result?.hostnameVerified, false);
    assert.equal(observed.adapter.diagnostics[0]?.authorizationError, fixture.diagnostic);
    assert.equal(observed.adapter.diagnostics[0]?.secureConnectObserved, true);
    assertCoreCp06Rejected(observed.chain);
    assert.doesNotMatch(JSON.stringify(observed), /PRIVATE_NORMALIZATION_ERROR|PRIVATE_UNRECOGNIZED_CODE/);
  });
}

const metadataGuards: ReadonlyArray<Readonly<{ label: string; changeSocket: (socket: FakeTlsSocket) => void }>> = [
  { label: 'remoteAddress-undefined', changeSocket: (socket) => { socket.remoteAddress = undefined; } },
  { label: 'remotePort-undefined', changeSocket: (socket) => { socket.remotePort = undefined; } },
  { label: 'remoteFamily-unrecognized', changeSocket: (socket) => { socket.remoteFamily = 'UNRECOGNIZED'; } },
  { label: 'protocol-null', changeSocket: (socket) => { socket.protocol = null; } },
];
for (const guard of metadataGuards) for (const absence of noAuthorizationErrorCases) {
  test(`normalization D first rejection branch: ${guard.label}/${absence.label}`, async () => {
    const { adapter, chain } = await observeBoth(`metadata/${guard.label}/${absence.label}`, {
      authorizationError: absence.value, changeSocket: guard.changeSocket,
    });
    assert.equal(adapter.settlement, 'rejected');
    assert.equal(adapter.result, undefined);
    assert.equal(adapter.rejection?.failureKind, 'TLS_RESULT_REJECTED');
    assert.equal(adapter.rejection?.authorizationError, 'NONE');
    assert.equal(adapter.rejection?.authorized, true);
    assert.equal(adapter.rejection?.secureConnectObserved, true);
    assert.equal(adapter.destroyCount, 1);
    assert.equal(chain.adapterResult, undefined);
    assert.equal(chain.adapterRejection?.failureKind, 'TLS_RESULT_REJECTED');
    assertCoreCp06Rejected(chain);
  });
}

for (const protocol of ['TLSv1.1', '']) for (const absence of noAuthorizationErrorCases) {
  test(`normalization D second rejection branch: protocol=${JSON.stringify(protocol)}/${absence.label}`, async () => {
    const { adapter, chain } = await observeBoth(`core-protocol/${protocol || 'empty'}/${absence.label}`, {
      authorizationError: absence.value, changeSocket: (socket) => { socket.protocol = protocol; },
    });
    // Metadata branch accepts a non-null protocol. The unchanged core must reject it.
    assert.equal(adapter.settlement, 'resolved');
    assert.equal(adapter.diagnostics[0]?.failureKind, 'NONE');
    assert.equal(chain.adapterRejection, undefined);
    assert.ok(chain.adapterResult);
    assert.equal(chain.adapterResult.authorized, true);
    assert.equal(chain.adapterResult.authorizationError, null);
    assert.equal(chain.adapterResult.chainVerified, true);
    assert.equal(chain.adapterResult.caSha256, CA_SHA256);
    assert.equal(chain.adapterResult.protocol, protocol);
    assert.equal(chain.adapterResult.servername, DIRECT_POSTGRES_TARGET.hostname);
    assertCoreCp06Rejected(chain);
    assert.equal(chain.coreResult.tlsDiagnostics.secureConnectObserved, true);
    assert.equal(chain.coreResult.tlsDiagnostics.authorizationError, 'NONE');
  });
}

for (const absence of noAuthorizationErrorCases) {
  test(`normalization D CP07 peer guard remains reachable and rejecting with ${absence.label}`, async () => {
    const { adapter, chain } = await observeBoth(`peer-address/${absence.label}`, {
      authorizationError: absence.value, changeSocket: (socket) => { socket.remoteAddress = '8.8.4.4'; },
    });
    assert.equal(adapter.settlement, 'resolved');
    assert.equal(chain.coreResult.ok, false);
    assert.equal(chain.coreResult.failureStage, 'CP07');
    assert.equal(chain.coreResult.tlsDiagnostics.failureKind, 'PEER_RESULT_REJECTED');
    assert.equal(chain.coreResult.tlsDiagnostics.secureConnectObserved, true);
  });
  for (const terminal of ['error', 'close', 'abort'] as const) {
    test(`normalization F: ${terminal} with ${absence.label} cannot invent secureConnect or authorization`, async () => {
      const fixture = { authorizationError: absence.value, authorized: false, terminal };
      const adapter = await observeAdapterFixture(fixture);
      const chain = terminal === 'abort' ? undefined : await observeAdapterToCoreFixture(fixture);
      normalizationObservations.push({ label: `terminal/${terminal}/${absence.label}`, adapter, chain });
      const expected = terminal === 'error' ? 'ERROR_EVENT' : terminal === 'close' ? 'CLOSE_BEFORE_SECURE_CONNECT' : 'ABORTED';
      assert.equal(adapter.settlement, 'rejected');
      assert.equal(adapter.rejection?.failureKind, expected);
      assert.equal(adapter.rejection?.authorizationError, 'NONE');
      assert.equal(adapter.rejection?.authorized, false);
      assert.equal(adapter.rejection?.secureConnectObserved, false);
      assert.equal(adapter.destroyCount, 1);
      assert.equal(adapter.secureConnectListenerCount, 0);
      assert.equal(adapter.closeListenerCount, 0);
      assert.equal(adapter.diagnostics.length, 1);
      if (chain !== undefined) {
        assert.equal(chain.coreResult.ok, false);
        assert.equal(chain.coreResult.failureStage, 'CP06');
        assert.equal(chain.coreResult.tlsDiagnostics.failureKind, expected);
        assert.equal(chain.coreResult.tlsDiagnostics.authorized, false);
        assert.equal(chain.coreResult.tlsDiagnostics.secureConnectObserved, false);
      }
    });
  }
  test(`normalization F: synthetic deadline preserves timeout/abort classification with ${absence.label}`, async () => {
    const chain = await observeAdapterToCoreFixture({
      authorizationError: absence.value, authorized: false, terminal: 'timeout',
    });
    normalizationObservations.push({ label: `terminal/timeout/${absence.label}`, chain });
    assert.equal(chain.coreResult.ok, false);
    assert.equal(chain.coreResult.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
    assert.equal(chain.coreResult.failureStage, 'CP06');
    assert.equal(chain.coreResult.tlsDiagnostics.failureKind, 'ABORTED');
    assert.equal(chain.coreResult.tlsDiagnostics.authorizationError, 'NONE');
    assert.equal(chain.coreResult.tlsDiagnostics.authorized, false);
    assert.equal(chain.coreResult.tlsDiagnostics.secureConnectObserved, false);
  });
}

after(() => {
  const output = process.env.CP06_TEST_OUTPUT_ROOT;
  assert.ok(output, 'CP06_TEST_OUTPUT_ROOT must name the independent validation output directory');
  assert.match(output.replace(/\\/g, '/'), /^C:\/Users\/mateo\/AppData\/Local\/Temp\/.+/i);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'normalization-observed-matrix.json'), `${JSON.stringify({
    evidenceKind: 'SYNTHETIC_OFFLINE_REAL_ADAPTER_AND_PURE_CORE',
    historicalCausalAttribution: 'UNRESOLVED_FROM_AVAILABLE_RAW',
    observations: normalizationObservations,
  }, null, 2)}\n`, { flag: 'wx' });
});
