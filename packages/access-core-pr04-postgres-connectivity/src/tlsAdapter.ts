import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type { Socket } from 'node:net';
import type { ConnectionOptions, TLSSocket } from 'node:tls';
import type { CredentialFreeNetworkAdapters } from './directPostgresPreflight';
import { observeTlsDiagnostics, TlsDiagnosticError, type TlsFailureKind } from './tlsDiagnostics';

/** Narrow extraction; connector is mandatory so importing this module performs no I/O. */
export function startTlsWithConnector(
  input: Parameters<CredentialFreeNetworkAdapters['startTls']>[0],
  connectTls: (options: ConnectionOptions) => TLSSocket,
): ReturnType<CredentialFreeNetworkAdapters['startTls']> {
  if (typeof input.connection !== 'object' || input.connection === null ||
      !('socket' in input.connection) || !((input.connection as { socket: unknown }).socket instanceof Object)) {
    throw new Error('PRODUCTION_CONNECTION_CONTRACT_FAILED');
  }
  const connection = input.connection as { socket: Socket | TLSSocket };
  return new Promise((resolve, reject) => {
    let socket: TLSSocket;
    try {
      socket = connectTls({
        ca: Buffer.from(input.ca),
        minVersion: input.minimumVersion,
        rejectUnauthorized: input.rejectUnauthorized,
        servername: input.servername,
        socket: connection.socket as Socket,
      });
    } catch (error: unknown) {
      const diagnostic = observeTlsDiagnostics({
        failureKind: 'CONNECT_THROW', error, socketAvailable: false, secureConnectObserved: false,
      });
      input.onDiagnostics?.(diagnostic);
      reject(new TlsDiagnosticError(diagnostic));
      return;
    }
    connection.socket = socket;
    let settled = false;
    let secureConnectObserved = false;
    const observe = (failureKind: TlsFailureKind, error?: unknown) => {
      const diagnostic = observeTlsDiagnostics({
        failureKind, error, socketAvailable: true,
        authorized: socket.authorized, authorizationError: socket.authorizationError,
        secureConnectObserved,
      });
      input.onDiagnostics?.(diagnostic);
      return diagnostic;
    };
    const cleanup = (): void => {
      socket.removeListener('secureConnect', onSecureConnect);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      input.signal.removeEventListener('abort', onAbort);
    };
    const fail = (kind: TlsFailureKind, error?: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      const diagnostic = observe(kind, error);
      socket.destroy();
      reject(new TlsDiagnosticError(diagnostic));
    };
    const onAbort = (): void => fail('ABORTED');
    const onError = (error: unknown): void => fail('ERROR_EVENT', error);
    const onClose = (): void => fail('CLOSE_BEFORE_SECURE_CONNECT');
    const onSecureConnect = (): void => {
      if (settled) return;
      secureConnectObserved = true;
      settled = true;
      cleanup();
      socket.on('error', () => undefined);
      const remoteAddress = socket.remoteAddress;
      const remotePort = socket.remotePort;
      const peerFamily = socket.remoteFamily === 'IPv4' ? 4 : socket.remoteFamily === 'IPv6' ? 6 : 0;
      const protocol = socket.getProtocol();
      if (remoteAddress === undefined || remotePort === undefined || peerFamily === 0 || protocol === null) {
        const diagnostic = observe('TLS_RESULT_REJECTED');
        socket.destroy();
        reject(new TlsDiagnosticError(diagnostic));
        return;
      }
      const peer = socket.getPeerCertificate(true);
      const cipher = socket.getCipher().name;
      observe('NONE');
      resolve({
        authorized: socket.authorized,
        authorizationError: socket.authorizationError === undefined ? null : 'TLS_AUTHORIZATION_ERROR',
        caSha256: input.caSha256,
        chainVerified: socket.authorized && socket.authorizationError === undefined,
        hostnameVerified: socket.authorized && socket.authorizationError === undefined,
        peerAddress: remoteAddress,
        peerFamily,
        peerPort: remotePort,
        protocol,
        servername: input.servername,
        ...(cipher === '' ? {} : { cipher }),
        ...(peer.raw === undefined
          ? {}
          : { peerCertificateSha256: createHash('sha256').update(peer.raw).digest('hex') }),
      });
    };
    socket.once('secureConnect', onSecureConnect);
    socket.once('error', onError);
    socket.once('close', onClose);
    input.signal.addEventListener('abort', onAbort, { once: true });
  });
}
