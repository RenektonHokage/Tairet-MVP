import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as dnsPromises } from 'node:dns';
import { promises as fs } from 'node:fs';
import { createConnection, isIP, type Socket } from 'node:net';
import { platform } from 'node:os';
import { connect as connectTls, type TLSSocket } from 'node:tls';

import {
  DIRECT_POSTGRES_TARGET,
  runDirectPostgresPreflight,
  type CredentialFreeNetworkAdapters,
  type DirectPostgresPreflightOptions,
  type DirectPostgresPreflightResult,
  type DirectPostgresStage,
} from './directPostgresPreflight';
import {
  createPostgresSslRequest,
  requirePostgresSslResponse,
  writeCanonicalPostgresSslRequest,
} from './postgresSslRequest';

export {
  DIRECT_POSTGRES_TARGET,
  createPostgresSslRequest,
  requirePostgresSslResponse,
  runDirectPostgresPreflight,
};
export type {
  CredentialFreeNetworkAdapters,
  DirectPostgresPreflightOptions,
  DirectPostgresPreflightResult,
  DirectPostgresStage,
};

type LiveConnection = {
  socket: Socket | TLSSocket;
};

function fixedError(code: string): Error {
  return new Error(code);
}

function isDnsNoData(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ENODOMAIN';
}

async function resolveLiveDns(
  hostname: string,
  signal: AbortSignal,
): Promise<Readonly<{
  queriedHostname: string;
  resolver: readonly string[];
  records: readonly Readonly<{ address: string; family: 4 | 6; ttl: number }>[];
}>> {
  const resolver = new dnsPromises.Resolver();
  const onAbort = (): void => resolver.cancel();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const resolve4 = async (): Promise<readonly Readonly<{ address: string; family: 4; ttl: number }>[]> => {
      try {
        const answers = await resolver.resolve4(hostname, { ttl: true });
        return answers.map((answer) => ({ address: answer.address, family: 4, ttl: answer.ttl }));
      } catch (error: unknown) {
        if (isDnsNoData(error)) return [];
        throw fixedError('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
      }
    };
    const resolve6 = async (): Promise<readonly Readonly<{ address: string; family: 6; ttl: number }>[]> => {
      try {
        const answers = await resolver.resolve6(hostname, { ttl: true });
        return answers.map((answer) => ({ address: answer.address, family: 6, ttl: answer.ttl }));
      } catch (error: unknown) {
        if (isDnsNoData(error)) return [];
        throw fixedError('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
      }
    };
    const [ipv4, ipv6] = await Promise.all([resolve4(), resolve6()]);
    return {
      queriedHostname: hostname,
      resolver: resolver.getServers(),
      records: [...ipv4, ...ipv6],
    };
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function runReadOnlyProcess(
  executable: string,
  args: readonly string[],
  signal: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const child = execFile(
      executable,
      [...args],
      { encoding: 'utf8', maxBuffer: 32 * 1024, windowsHide: true },
      (error, stdout) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if (error !== null) reject(fixedError('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE'));
        else resolve(stdout);
      },
    );
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(fixedError('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function inspectWindowsRoute(
  address: string,
  family: 4 | 6,
  signal: AbortSignal,
): Promise<Readonly<{
  address: string;
  family: 4 | 6;
  usable: boolean;
  metric?: number;
  interfaceName?: string;
  sourceAddress?: string;
}>> {
  const executable = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const script =
    "$ErrorActionPreference='Stop';" +
    '$route=Find-NetRoute -RemoteIPAddress $args[0] -ErrorAction Stop | Select-Object -First 1;' +
    "if($null -eq $route){throw 'NO_ROUTE'};" +
    '[ordered]@{InterfaceIndex=$route.InterfaceIndex;InterfaceAlias=$route.InterfaceAlias;' +
    'SourceAddress=$route.IPAddress;RouteMetric=$route.RouteMetric}|ConvertTo-Json -Compress';
  try {
    const stdout = await runReadOnlyProcess(
      executable,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script, address],
      signal,
    );
    const parsed = JSON.parse(stdout) as {
      InterfaceAlias?: unknown;
      InterfaceIndex?: unknown;
      RouteMetric?: unknown;
      SourceAddress?: unknown;
    };
    const interfaceIndex = Number(parsed.InterfaceIndex);
    const metric = Number(parsed.RouteMetric);
    return {
      address,
      family,
      usable: Number.isInteger(interfaceIndex) && interfaceIndex > 0,
      ...(Number.isSafeInteger(metric) && metric >= 0 ? { metric } : {}),
      ...(typeof parsed.InterfaceAlias === 'string'
        ? { interfaceName: parsed.InterfaceAlias.slice(0, 128) }
        : {}),
      ...(typeof parsed.SourceAddress === 'string'
        ? { sourceAddress: parsed.SourceAddress.slice(0, 128) }
        : {}),
    };
  } catch {
    return { address, family, usable: false };
  }
}

async function inspectLinuxRoute(
  address: string,
  family: 4 | 6,
): Promise<Readonly<{
  address: string;
  family: 4 | 6;
  usable: boolean;
  metric?: number;
  interfaceName?: string;
}>> {
  try {
    if (family === 4) {
      const table = await fs.readFile('/proc/net/route', 'utf8');
      const matches = table
        .split(/\r?\n/u)
        .slice(1)
        .map((line) => line.trim().split(/\s+/u))
        .filter(
          (fields) =>
            fields.length >= 8 &&
            fields[1] === '00000000' &&
            fields[7] === '00000000' &&
            (Number.parseInt(fields[3] ?? '0', 16) & 1) === 1,
        )
        .map((fields) => ({
          interfaceName: fields[0] ?? '',
          metric: Number.parseInt(fields[6] ?? '', 10),
        }))
        .filter((route) => Number.isSafeInteger(route.metric) && route.metric >= 0)
        .sort((left, right) => left.metric - right.metric || left.interfaceName.localeCompare(right.interfaceName));
      const selected = matches[0];
      return selected === undefined
        ? { address, family, usable: false }
        : { address, family, usable: true, ...selected };
    }

    const table = await fs.readFile('/proc/net/ipv6_route', 'utf8');
    const matches = table
      .split(/\r?\n/u)
      .map((line) => line.trim().split(/\s+/u))
      .filter(
        (fields) =>
          fields.length >= 10 &&
          fields[0] === '00000000000000000000000000000000' &&
          fields[1] === '00' &&
          (Number.parseInt(fields[8] ?? '0', 16) & 1) === 1,
      )
      .map((fields) => ({
        interfaceName: fields[9] ?? '',
        metric: Number.parseInt(fields[5] ?? '', 16),
      }))
      .filter((route) => Number.isSafeInteger(route.metric) && route.metric >= 0)
      .sort((left, right) => left.metric - right.metric || left.interfaceName.localeCompare(right.interfaceName));
    const selected = matches[0];
    return selected === undefined
      ? { address, family, usable: false }
      : { address, family, usable: true, ...selected };
  } catch {
    return { address, family, usable: false };
  }
}

function asLiveConnection(value: unknown): LiveConnection {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('socket' in value) ||
    !((value as LiveConnection).socket instanceof Object)
  ) {
    throw fixedError('PRODUCTION_CONNECTION_CONTRACT_FAILED');
  }
  return value as LiveConnection;
}

function connectLiveTcp(input: Readonly<{
  address: string;
  family: 4 | 6;
  port: number;
  signal: AbortSignal;
}>): Promise<Readonly<{
  connection: unknown;
  remoteAddress: string;
  remoteFamily: 4 | 6;
  remotePort: number;
}>> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: input.address, family: input.family, port: input.port });
    let settled = false;
    const cleanup = (): void => {
      socket.removeListener('connect', onConnect);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      input.signal.removeEventListener('abort', onAbort);
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(fixedError('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE'));
    };
    const onAbort = (): void => fail();
    const onError = (): void => fail();
    const onClose = (): void => fail();
    const onConnect = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.setNoDelay(true);
      socket.on('error', () => undefined);
      const remoteAddress = socket.remoteAddress;
      const remotePort = socket.remotePort;
      const remoteFamily = socket.remoteFamily === 'IPv4' ? 4 : socket.remoteFamily === 'IPv6' ? 6 : 0;
      if (remoteAddress === undefined || remotePort === undefined || remoteFamily === 0) {
        socket.destroy();
        reject(fixedError('PRODUCTION_REMOTE_ADDRESS_MISMATCH'));
        return;
      }
      resolve({
        connection: { socket } satisfies LiveConnection,
        remoteAddress,
        remoteFamily,
        remotePort,
      });
    };
    socket.once('connect', onConnect);
    socket.once('error', onError);
    socket.once('close', onClose);
    input.signal.addEventListener('abort', onAbort, { once: true });
  });
}

function exchangeLiveSslRequest(input: Readonly<{
  connection: unknown;
  request: Uint8Array;
  signal: AbortSignal;
}>): Promise<Uint8Array> {
  const socket = asLiveConnection(input.connection).socket;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      input.signal.removeEventListener('abort', onAbort);
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(fixedError('PRODUCTION_TLS_REQUIRED'));
    };
    const onAbort = (): void => fail();
    const onError = (): void => fail();
    const onClose = (): void => fail();
    const onData = (data: Buffer): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.from(data));
    };
    socket.once('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
    input.signal.addEventListener('abort', onAbort, { once: true });
    try {
      writeCanonicalPostgresSslRequest(input.request, (request) => {
        socket.write(request, (error?: Error | null) => {
          if (error) fail();
        });
      });
    } catch {
      fail();
    }
  });
}

function startLiveTls(input: Readonly<{
  connection: unknown;
  ca: Uint8Array;
  caSha256: string;
  servername: string;
  minimumVersion: 'TLSv1.2';
  rejectUnauthorized: true;
  signal: AbortSignal;
}>): Promise<Readonly<{
  authorized: boolean;
  authorizationError: string | null;
  caSha256: string;
  chainVerified: boolean;
  hostnameVerified: boolean;
  peerAddress: string;
  peerFamily: 4 | 6;
  peerPort: number;
  protocol: string;
  servername: string;
  cipher?: string;
  peerCertificateSha256?: string;
}>> {
  const connection = asLiveConnection(input.connection);
  return new Promise((resolve, reject) => {
    const socket = connectTls({
      ca: Buffer.from(input.ca),
      minVersion: input.minimumVersion,
      rejectUnauthorized: input.rejectUnauthorized,
      servername: input.servername,
      socket: connection.socket as Socket,
    });
    connection.socket = socket;
    let settled = false;
    const cleanup = (): void => {
      socket.removeListener('secureConnect', onSecureConnect);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      input.signal.removeEventListener('abort', onAbort);
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(fixedError('PRODUCTION_TLS_IDENTITY_MISMATCH'));
    };
    const onAbort = (): void => fail();
    const onError = (): void => fail();
    const onClose = (): void => fail();
    const onSecureConnect = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.on('error', () => undefined);
      const remoteAddress = socket.remoteAddress;
      const remotePort = socket.remotePort;
      const peerFamily = socket.remoteFamily === 'IPv4' ? 4 : socket.remoteFamily === 'IPv6' ? 6 : 0;
      const protocol = socket.getProtocol();
      if (remoteAddress === undefined || remotePort === undefined || peerFamily === 0 || protocol === null) {
        socket.destroy();
        reject(fixedError('PRODUCTION_TLS_IDENTITY_MISMATCH'));
        return;
      }
      const peer = socket.getPeerCertificate(true);
      const cipher = socket.getCipher().name;
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

function createLiveAdapters(): CredentialFreeNetworkAdapters {
  return {
    readFile: (path) => fs.readFile(path),
    resolveDns: ({ hostname, signal }) => resolveLiveDns(hostname, signal),
    inspectRoute: async ({ address, family, signal }) => {
      if (signal.aborted) return { address, family, usable: false };
      if (platform() === 'win32') return inspectWindowsRoute(address, family, signal);
      if (platform() === 'linux') return inspectLinuxRoute(address, family);
      return { address, family, usable: false };
    },
    connectTcp: connectLiveTcp,
    exchangeSslRequest: exchangeLiveSslRequest,
    startTls: startLiveTls,
    closeConnection: async (value) => {
      if (value === undefined) return;
      const connection = asLiveConnection(value);
      if (!connection.socket.destroyed) connection.socket.destroy();
    },
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
  };
}

function parseLiveArguments(args: readonly string[]): Readonly<{
  caPath: string;
  caSha256: string;
  timeoutMs: number;
}> {
  if (args[0] !== '--live-direct-preflight') {
    throw fixedError('PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
  }
  const values = new Map<string, string>();
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      (key !== '--ca-path' && key !== '--ca-sha256' && key !== '--timeout-ms') ||
      values.has(key)
    ) {
      throw fixedError('PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
    }
    values.set(key, value);
  }
  if (values.size !== 3) throw fixedError('PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
  const timeoutMs = Number(values.get('--timeout-ms'));
  if (!Number.isSafeInteger(timeoutMs)) throw fixedError('PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
  return {
    caPath: values.get('--ca-path') as string,
    caSha256: values.get('--ca-sha256') as string,
    timeoutMs,
  };
}

async function main(): Promise<void> {
  const parsed = parseLiveArguments(process.argv.slice(2));
  const result = await runDirectPostgresPreflight({
    ...parsed,
    adapters: createLiveAdapters(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 2;
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('{"classification":"PRODUCTION_CONNECTION_CONTRACT_FAILED"}\n');
    process.exitCode = 2;
  });
}
