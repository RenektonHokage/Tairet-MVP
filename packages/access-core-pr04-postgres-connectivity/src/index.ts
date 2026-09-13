import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as dnsPromises } from 'node:dns';
import { promises as fs } from 'node:fs';
import { createConnection, isIP, type Socket } from 'node:net';
import { platform } from 'node:os';
import { connect as connectTls, type TLSSocket } from 'node:tls';
import { startTlsWithConnector } from './tlsAdapter';

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

const WINDOWS_ROUTE_EXECUTABLE = Object.freeze({
  path: 'C:\\Windows\\System32\\route.exe',
  realPath: 'C:\\Windows\\System32\\ROUTE.EXE',
  sizeBytes: 49_152,
  sha256: '79a71edb01e35dcac272bffc400383286c14b8090c61687603fc51ad7999e5c9',
});
const WINDOWS_ROUTE_ARGS = Object.freeze(['PRINT', '-4'] as const);
const WINDOWS_ROUTE_MAX_OUTPUT_BYTES = 1024 * 1024;

type WindowsRouteFailure =
  | 'CATALOG_ACQUISITION_FAILURE'
  | 'PERMISSION_ACCESS_FAILURE'
  | 'SCHEMA_FAILURE'
  | 'NO_MATCH'
  | 'AMBIGUOUS';

type WindowsRouteRecord = Readonly<{
  gateway: string;
  metric: number;
  netmask: string;
  network: string;
  prefixLength: number;
  sourceAddress: string;
}>;

type RouteExecutableIdentity = Readonly<{
  device: string;
  inode: string;
  linkCount: number;
  path: string;
  realPath: string;
  regularFile: true;
  reparse: false;
  sha256: string;
  sizeBytes: number;
}>;

type RouteIdentityResult =
  | Readonly<{ ok: true; identity: RouteExecutableIdentity }>
  | Readonly<{ ok: false; classification: 'CATALOG_ACQUISITION_FAILURE' | 'PERMISSION_ACCESS_FAILURE' }>;

type RouteProcessSpec = Readonly<{
  args: readonly ['PRINT', '-4'];
  cwd: 'C:\\Windows\\System32';
  executable: 'C:\\Windows\\System32\\route.exe';
  shell: false;
  stdin: 'ignore';
}>;

type RouteProcessResult =
  | Readonly<{ ok: true; stdout: Uint8Array }>
  | Readonly<{ ok: false; classification: 'CATALOG_ACQUISITION_FAILURE' | 'PERMISSION_ACCESS_FAILURE' }>;

type RouteCatalogDependencies = Readonly<{
  runProcess: (spec: RouteProcessSpec, signal: AbortSignal) => Promise<RouteProcessResult>;
  validateExecutable: () => Promise<RouteIdentityResult>;
}>;

type RouteCatalogAcquisition =
  | Readonly<{
      ok: true;
      executableIdentity: RouteExecutableIdentity;
      routes: readonly WindowsRouteRecord[];
      validationCount: 2;
    }>
  | Readonly<{
      ok: false;
      classification: 'CATALOG_ACQUISITION_FAILURE' | 'PERMISSION_ACCESS_FAILURE' | 'SCHEMA_FAILURE';
      validationCount: 0 | 1 | 2;
    }>;

type RouteCatalogInspection =
  | Readonly<{
      candidateCount: number;
      classification: 'VALID_SELECTED_ROUTE';
      executableIdentity: RouteExecutableIdentity;
      selected: WindowsRouteRecord;
      validationCount: 2;
    }>
  | Readonly<{
      candidateCount: number;
      classification: WindowsRouteFailure;
      validationCount: 0 | 1 | 2;
    }>;

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

function isAccessFailure(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EACCES' || code === 'EPERM';
}

function normalizeWindowsPath(value: string): string {
  return value.replaceAll('/', '\\').replace(/\\+$/u, '').toLowerCase();
}

function strictIpv4ToNumber(value: string): number | undefined {
  const parts = value.split('.');
  if (parts.length !== 4) return undefined;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return undefined;
    const octet = Number.parseInt(part, 10);
    if (!Number.isSafeInteger(octet) || octet < 0 || octet > 255) return undefined;
    octets.push(octet);
  }
  return (
    ((octets[0] as number) * 0x1000000 +
      (octets[1] as number) * 0x10000 +
      (octets[2] as number) * 0x100 +
      (octets[3] as number)) >>>
    0
  );
}

function prefixLengthFromNetmask(mask: number): number | undefined {
  const inverted = (~mask) >>> 0;
  if ((inverted & ((inverted + 1) >>> 0)) !== 0) return undefined;
  let prefixLength = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    if (((mask >>> bit) & 1) === 0) break;
    prefixLength += 1;
  }
  return prefixLength;
}

function looksLikeIpv4Field(value: string | undefined): boolean {
  return value !== undefined && /^[0-9]+(?:\.[0-9]+){3}$/u.test(value);
}

function parseWindowsRoutePrint(stdout: Uint8Array):
  | Readonly<{ ok: true; routes: readonly WindowsRouteRecord[] }>
  | Readonly<{ ok: false; classification: 'SCHEMA_FAILURE' }> {
  if (stdout.byteLength === 0 || stdout.byteLength > WINDOWS_ROUTE_MAX_OUTPUT_BYTES) {
    return { ok: false, classification: 'SCHEMA_FAILURE' };
  }
  const text = Buffer.from(stdout).toString('latin1');
  if (text.includes('\0')) return { ok: false, classification: 'SCHEMA_FAILURE' };

  type RouteSection = 'UNPROVEN' | 'ACTIVE' | 'PERSISTENT' | 'TERMINAL';
  const routes: WindowsRouteRecord[] = [];
  let section: RouteSection = 'UNPROVEN';
  let persistentBoundarySeen = false;
  let persistentMaterialSeen = false;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (/^={8,}$/u.test(line)) {
      if (section === 'ACTIVE') {
        section = 'PERSISTENT';
        persistentBoundarySeen = true;
      } else if (section === 'PERSISTENT') {
        section = 'TERMINAL';
      }
      continue;
    }
    if (line.length === 0) continue;

    const tokens = line.split(/\s+/u);
    const destinationToken = tokens[0];
    const netmaskToken = tokens[1];
    const sourceToken = tokens[tokens.length - 2];
    const metricToken = tokens[tokens.length - 1];
    const routeLike =
      looksLikeIpv4Field(destinationToken) ||
      looksLikeIpv4Field(netmaskToken);

    if (section === 'PERSISTENT') {
      persistentMaterialSeen = true;
      continue;
    }
    if (section === 'TERMINAL') {
      if (routeLike) return { ok: false, classification: 'SCHEMA_FAILURE' };
      continue;
    }
    if (!routeLike) continue;
    if (tokens.length < 5) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }
    if (
      destinationToken === undefined ||
      netmaskToken === undefined ||
      sourceToken === undefined ||
      metricToken === undefined
    ) return { ok: false, classification: 'SCHEMA_FAILURE' };

    const destination = strictIpv4ToNumber(destinationToken);
    const netmask = strictIpv4ToNumber(netmaskToken);
    const source = strictIpv4ToNumber(sourceToken);
    if (destination === undefined || netmask === undefined || source === undefined) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }
    const prefixLength = prefixLengthFromNetmask(netmask);
    if (prefixLength === undefined || ((destination & netmask) >>> 0) !== destination) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }
    if (!/^(?:0|[1-9][0-9]*)$/u.test(metricToken)) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }
    const metric = Number.parseInt(metricToken, 10);
    if (!Number.isSafeInteger(metric) || metric < 0) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }

    const gatewayTokens = tokens.slice(2, -2);
    if (gatewayTokens.length === 0) return { ok: false, classification: 'SCHEMA_FAILURE' };
    const gateway = gatewayTokens.join(' ');
    if (
      gateway.length > 128 ||
      /[\u0000-\u001f\u007f]/u.test(gateway) ||
      (gateway.includes('.') && strictIpv4ToNumber(gateway) === undefined)
    ) {
      return { ok: false, classification: 'SCHEMA_FAILURE' };
    }

    routes.push({
      gateway,
      metric,
      netmask: netmaskToken,
      network: destinationToken,
      prefixLength,
      sourceAddress: sourceToken,
    });
    section = 'ACTIVE';
  }
  return routes.length === 0 || !persistentBoundarySeen || !persistentMaterialSeen
    ? { ok: false, classification: 'SCHEMA_FAILURE' }
    : { ok: true, routes };
}

function routeRecordKey(route: WindowsRouteRecord): string {
  return [
    route.network,
    route.netmask,
    route.gateway,
    route.sourceAddress,
    String(route.metric),
  ].join('|');
}

function selectWindowsRoute(
  routes: readonly WindowsRouteRecord[],
  address: string,
):
  | Readonly<{ candidateCount: number; classification: 'VALID_SELECTED_ROUTE'; selected: WindowsRouteRecord }>
  | Readonly<{ candidateCount: number; classification: 'NO_MATCH' | 'AMBIGUOUS' | 'SCHEMA_FAILURE' }> {
  const target = strictIpv4ToNumber(address);
  if (target === undefined) return { candidateCount: 0, classification: 'SCHEMA_FAILURE' };
  const candidates = routes.filter((route) => {
    const network = strictIpv4ToNumber(route.network);
    const netmask = strictIpv4ToNumber(route.netmask);
    return network !== undefined && netmask !== undefined && ((target & netmask) >>> 0) === network;
  });
  if (candidates.length === 0) return { candidateCount: 0, classification: 'NO_MATCH' };

  const bestPrefixLength = Math.max(...candidates.map((route) => route.prefixLength));
  const prefixCandidates = candidates.filter((route) => route.prefixLength === bestPrefixLength);
  const bestMetric = Math.min(...prefixCandidates.map((route) => route.metric));
  const equalRank = prefixCandidates.filter((route) => route.metric === bestMetric);
  const distinct = [...new Map(equalRank.map((route) => [routeRecordKey(route), route])).values()];
  if (distinct.length !== 1) {
    return { candidateCount: candidates.length, classification: 'AMBIGUOUS' };
  }
  return {
    candidateCount: candidates.length,
    classification: 'VALID_SELECTED_ROUTE',
    selected: distinct[0] as WindowsRouteRecord,
  };
}

function sameExecutableIdentity(
  left: RouteExecutableIdentity,
  right: RouteExecutableIdentity,
): boolean {
  return (
    normalizeWindowsPath(left.path) === normalizeWindowsPath(right.path) &&
    normalizeWindowsPath(left.realPath) === normalizeWindowsPath(right.realPath) &&
    left.sizeBytes === right.sizeBytes &&
    left.sha256 === right.sha256 &&
    left.regularFile === right.regularFile &&
    left.reparse === right.reparse &&
    left.device === right.device &&
    left.inode === right.inode
  );
}

async function validateWindowsRouteExecutable(): Promise<RouteIdentityResult> {
  try {
    const before = await fs.lstat(WINDOWS_ROUTE_EXECUTABLE.path);
    const realPath = await fs.realpath(WINDOWS_ROUTE_EXECUTABLE.path);
    const bytes = await fs.readFile(WINDOWS_ROUTE_EXECUTABLE.path);
    const after = await fs.lstat(WINDOWS_ROUTE_EXECUTABLE.path);
    const regularFile = before.isFile() && after.isFile();
    const reparse =
      before.isSymbolicLink() ||
      after.isSymbolicLink() ||
      normalizeWindowsPath(realPath) !== normalizeWindowsPath(WINDOWS_ROUTE_EXECUTABLE.realPath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const stableDuringRead =
      before.dev === after.dev &&
      before.ino === after.ino &&
      before.size === after.size &&
      before.mtimeMs === after.mtimeMs;
    if (
      !regularFile ||
      reparse ||
      !stableDuringRead ||
      after.size !== WINDOWS_ROUTE_EXECUTABLE.sizeBytes ||
      sha256 !== WINDOWS_ROUTE_EXECUTABLE.sha256
    ) {
      return { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' };
    }
    return {
      ok: true,
      identity: {
        device: String(after.dev),
        inode: String(after.ino),
        linkCount: after.nlink,
        path: WINDOWS_ROUTE_EXECUTABLE.path,
        realPath,
        regularFile: true,
        reparse: false,
        sha256,
        sizeBytes: after.size,
      },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      classification: isAccessFailure(error)
        ? 'PERMISSION_ACCESS_FAILURE'
        : 'CATALOG_ACQUISITION_FAILURE',
    };
  }
}

const WINDOWS_ROUTE_PROCESS_SPEC: RouteProcessSpec = Object.freeze({
  args: WINDOWS_ROUTE_ARGS,
  cwd: 'C:\\Windows\\System32',
  executable: WINDOWS_ROUTE_EXECUTABLE.path,
  shell: false,
  stdin: 'ignore',
});

function runWindowsRouteProcess(
  spec: RouteProcessSpec,
  signal: AbortSignal,
): Promise<RouteProcessResult> {
  if (signal.aborted) {
    return Promise.resolve({ ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' });
  }
  return new Promise<RouteProcessResult>((resolve) => {
    const child = spawn(spec.executable, [...spec.args], {
      cwd: spec.cwd,
      detached: false,
      shell: spec.shell,
      stdio: [spec.stdin, 'pipe', 'ignore'],
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    let terminationFailure: RouteProcessResult | undefined;
    const finish = (result: RouteProcessResult): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = (): void => {
      if (settled) return;
      terminationFailure = { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' };
      child.kill();
    };
    child.stdout.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      outputBytes += bytes.byteLength;
      if (outputBytes > WINDOWS_ROUTE_MAX_OUTPUT_BYTES) {
        terminationFailure = { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' };
        child.kill();
        return;
      }
      chunks.push(bytes);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        classification: isAccessFailure(error)
          ? 'PERMISSION_ACCESS_FAILURE'
          : 'CATALOG_ACQUISITION_FAILURE',
      });
    });
    child.once('close', (code) => {
      if (terminationFailure !== undefined) {
        finish(terminationFailure);
        return;
      }
      if (code !== 0) {
        finish({ ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' });
        return;
      }
      finish({ ok: true, stdout: Buffer.concat(chunks) });
    });
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const WINDOWS_ROUTE_DEPENDENCIES: RouteCatalogDependencies = Object.freeze({
  runProcess: runWindowsRouteProcess,
  validateExecutable: validateWindowsRouteExecutable,
});

async function acquireWindowsRouteCatalog(
  signal: AbortSignal,
  dependencies: RouteCatalogDependencies,
): Promise<RouteCatalogAcquisition> {
  let before: RouteIdentityResult;
  try {
    before = await dependencies.validateExecutable();
  } catch {
    return { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE', validationCount: 0 };
  }
  if (!before.ok) return { ...before, validationCount: 0 };

  let processResult: RouteProcessResult;
  try {
    processResult = await dependencies.runProcess(WINDOWS_ROUTE_PROCESS_SPEC, signal);
  } catch {
    processResult = { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE' };
  }

  let after: RouteIdentityResult;
  try {
    after = await dependencies.validateExecutable();
  } catch {
    return { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE', validationCount: 1 };
  }
  if (!after.ok) return { ...after, validationCount: 1 };
  if (!sameExecutableIdentity(before.identity, after.identity)) {
    return { ok: false, classification: 'CATALOG_ACQUISITION_FAILURE', validationCount: 2 };
  }
  if (!processResult.ok) return { ...processResult, validationCount: 2 };

  const parsed = parseWindowsRoutePrint(processResult.stdout);
  if (!parsed.ok) return { ...parsed, validationCount: 2 };
  return {
    ok: true,
    executableIdentity: after.identity,
    routes: parsed.routes,
    validationCount: 2,
  };
}

function inspectAcquiredWindowsRoute(
  acquisition: RouteCatalogAcquisition,
  address: string,
): RouteCatalogInspection {
  if (!acquisition.ok) {
    return { candidateCount: 0, ...acquisition };
  }
  const selected = selectWindowsRoute(acquisition.routes, address);
  if (selected.classification !== 'VALID_SELECTED_ROUTE') {
    return { ...selected, validationCount: acquisition.validationCount };
  }
  return {
    ...selected,
    executableIdentity: acquisition.executableIdentity,
    validationCount: acquisition.validationCount,
  };
}

async function inspectWindowsRouteCatalog(
  address: string,
  signal: AbortSignal,
  dependencies: RouteCatalogDependencies = WINDOWS_ROUTE_DEPENDENCIES,
): Promise<RouteCatalogInspection> {
  return inspectAcquiredWindowsRoute(
    await acquireWindowsRouteCatalog(signal, dependencies),
    address,
  );
}

function projectWindowsRoute(
  address: string,
  family: 4 | 6,
  acquisition: RouteCatalogAcquisition,
): Readonly<{
  address: string;
  family: 4 | 6;
  usable: boolean;
  metric?: number;
  interfaceName?: string;
  sourceAddress?: string;
}> {
  if (family !== 4) return { address, family, usable: false };
  const inspected = inspectAcquiredWindowsRoute(acquisition, address);
  if (inspected.classification !== 'VALID_SELECTED_ROUTE') {
    return { address, family, usable: false };
  }
  return {
    address,
    family,
    metric: inspected.selected.metric,
    sourceAddress: inspected.selected.sourceAddress,
    usable: true,
  };
}

export const __windowsRouteCatalogTest = Object.freeze({
  boundExecutable: Object.freeze({
    ...WINDOWS_ROUTE_EXECUTABLE,
    linkCount: 2,
    regularFile: true,
    reparse: false,
  }),
  inspect: inspectWindowsRouteCatalog,
  processSpec: WINDOWS_ROUTE_PROCESS_SPEC,
});

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

const startLiveTls: CredentialFreeNetworkAdapters['startTls'] = (input) =>
  startTlsWithConnector(input, connectTls);

function createLiveAdapters(): CredentialFreeNetworkAdapters {
  let windowsRouteCatalog: Promise<RouteCatalogAcquisition> | undefined;
  return {
    readFile: (path) => fs.readFile(path),
    resolveDns: ({ hostname, signal }) => resolveLiveDns(hostname, signal),
    inspectRoute: async ({ address, family, signal }) => {
      if (signal.aborted) return { address, family, usable: false };
      if (platform() === 'win32') {
        if (family !== 4) return { address, family, usable: false };
        windowsRouteCatalog ??= acquireWindowsRouteCatalog(signal, WINDOWS_ROUTE_DEPENDENCIES);
        return projectWindowsRoute(address, family, await windowsRouteCatalog);
      }
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
