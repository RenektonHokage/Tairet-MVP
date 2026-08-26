import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import {
  createPostgresSslRequest,
  requirePostgresSslResponse,
} from './postgresSslRequest';

const APPROVED_CA_PATH =
  'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-production-ca-acquisition-fd54f57f\\official-source\\prod-ca-2021.crt';
const APPROVED_CA_SHA256 =
  '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const APPROVED_CA_SIZE = 1367;
const APPROVED_CA_AUTHORITY_ID =
  'TAIRET_ACCESS_CORE_PRODUCTION_CA_AUTHORITY_V1_OMTEYCTMRGAHAVGFAODW_807025AD50D4ED21';
const EXACT_TIMEOUT_MS = 10_000;

export const DIRECT_POSTGRES_TARGET = Object.freeze({
  projectRef: 'omteyctmrgahavgfaodw',
  hostname: 'db.omteyctmrgahavgfaodw.supabase.co',
  port: 5432,
  routeType: 'DIRECT_ONLY' as const,
});

export type DirectPostgresStage =
  | 'CP01'
  | 'CP02'
  | 'CP03'
  | 'CP04'
  | 'CP05'
  | 'CP06'
  | 'CP07'
  | 'CP08';

type AddressFamily = 4 | 6;

type IanaIpv4SpecialPurposePrefix = Readonly<{
  network: number;
  prefixLength: number;
  globallyReachable: boolean | null;
}>;

function strictIpv4ToUint32(address: string): number | undefined {
  if (isIP(address) !== 4) return undefined;
  const octets = address.split('.').map(Number) as [number, number, number, number];
  return (
    octets[0] * 0x1000000 +
    octets[1] * 0x10000 +
    octets[2] * 0x100 +
    octets[3]
  ) >>> 0;
}

function ipv4PrefixMask(prefixLength: number): number {
  return prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
}

function ianaIpv4SpecialPurposePrefix(
  cidr: string,
  globallyReachable: boolean | null,
): IanaIpv4SpecialPurposePrefix {
  const [address, rawPrefixLength] = cidr.split('/');
  const prefixLength = Number(rawPrefixLength);
  const network = address === undefined ? undefined : strictIpv4ToUint32(address);
  if (
    network === undefined ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 32 ||
    ((network & ipv4PrefixMask(prefixLength)) >>> 0) !== network
  ) {
    throw new Error('INVALID_FROZEN_IANA_IPV4_SPECIAL_PURPOSE_PREFIX');
  }
  return Object.freeze({ network, prefixLength, globallyReachable });
}

const IANA_IPV4_SPECIAL_PURPOSE_PREFIXES = Object.freeze([
  ianaIpv4SpecialPurposePrefix('0.0.0.0/8', false),
  ianaIpv4SpecialPurposePrefix('0.0.0.0/32', false),
  ianaIpv4SpecialPurposePrefix('10.0.0.0/8', false),
  ianaIpv4SpecialPurposePrefix('100.64.0.0/10', false),
  ianaIpv4SpecialPurposePrefix('127.0.0.0/8', false),
  ianaIpv4SpecialPurposePrefix('169.254.0.0/16', false),
  ianaIpv4SpecialPurposePrefix('172.16.0.0/12', false),
  ianaIpv4SpecialPurposePrefix('192.0.0.0/24', false),
  ianaIpv4SpecialPurposePrefix('192.0.0.0/29', false),
  ianaIpv4SpecialPurposePrefix('192.0.0.8/32', false),
  ianaIpv4SpecialPurposePrefix('192.0.0.9/32', true),
  ianaIpv4SpecialPurposePrefix('192.0.0.10/32', true),
  ianaIpv4SpecialPurposePrefix('192.0.0.170/32', false),
  ianaIpv4SpecialPurposePrefix('192.0.0.171/32', false),
  ianaIpv4SpecialPurposePrefix('192.0.2.0/24', false),
  ianaIpv4SpecialPurposePrefix('192.31.196.0/24', true),
  ianaIpv4SpecialPurposePrefix('192.52.193.0/24', true),
  ianaIpv4SpecialPurposePrefix('192.88.99.0/24', null),
  ianaIpv4SpecialPurposePrefix('192.88.99.2/32', null),
  ianaIpv4SpecialPurposePrefix('192.168.0.0/16', false),
  ianaIpv4SpecialPurposePrefix('192.175.48.0/24', true),
  ianaIpv4SpecialPurposePrefix('198.18.0.0/15', false),
  ianaIpv4SpecialPurposePrefix('198.51.100.0/24', false),
  ianaIpv4SpecialPurposePrefix('203.0.113.0/24', false),
  ianaIpv4SpecialPurposePrefix('224.0.0.0/4', false),
  ianaIpv4SpecialPurposePrefix('233.252.0.0/24', false),
  ianaIpv4SpecialPurposePrefix('240.0.0.0/4', false),
  ianaIpv4SpecialPurposePrefix('255.255.255.255/32', false),
]);

export function isGloballyReachableIpv4(address: string): boolean {
  const value = strictIpv4ToUint32(address);
  if (value === undefined) return false;

  let matchedPrefixLength = -1;
  let matchedReachability: boolean | null = true;
  for (const entry of IANA_IPV4_SPECIAL_PURPOSE_PREFIXES) {
    const mask = ipv4PrefixMask(entry.prefixLength);
    if (
      entry.prefixLength > matchedPrefixLength &&
      ((value & mask) >>> 0) === entry.network
    ) {
      matchedPrefixLength = entry.prefixLength;
      matchedReachability = entry.globallyReachable;
    }
  }
  return matchedReachability === true;
}

type FailureClassification =
  | 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE'
  | 'PRODUCTION_CA_AUTHORITY_MISMATCH'
  | 'PRODUCTION_CONNECTION_CONTRACT_FAILED'
  | 'PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED'
  | 'PRODUCTION_REMOTE_ADDRESS_MISMATCH'
  | 'PRODUCTION_TARGET_MISMATCH'
  | 'PRODUCTION_TLS_IDENTITY_MISMATCH'
  | 'PRODUCTION_TLS_REQUIRED';

export type CredentialFreeNetworkAdapters = Readonly<{
  readFile(path: string): Promise<Uint8Array>;
  resolveDns(input: Readonly<{
    hostname: string;
    signal: AbortSignal;
  }>): Promise<Readonly<{
    queriedHostname: string;
    resolver: readonly string[];
    records: readonly Readonly<{
      address: string;
      family: AddressFamily;
      ttl: number;
    }>[];
  }>>;
  inspectRoute(input: Readonly<{
    address: string;
    family: AddressFamily;
    signal: AbortSignal;
  }>): Promise<Readonly<{
    address: string;
    family: AddressFamily;
    usable: boolean;
    metric?: number;
    interfaceName?: string;
    sourceAddress?: string;
  }>>;
  connectTcp(input: Readonly<{
    address: string;
    family: AddressFamily;
    port: number;
    signal: AbortSignal;
  }>): Promise<Readonly<{
    connection: unknown;
    remoteAddress: string;
    remoteFamily: AddressFamily;
    remotePort: number;
  }>>;
  exchangeSslRequest(input: Readonly<{
    connection: unknown;
    request: Uint8Array;
    signal: AbortSignal;
  }>): Promise<Uint8Array>;
  startTls(input: Readonly<{
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
    peerFamily: AddressFamily;
    peerPort: number;
    protocol: string;
    servername: string;
    cipher?: string;
    peerCertificateSha256?: string;
  }>>;
  closeConnection(connection: unknown | undefined): Promise<void>;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(timer: unknown): void;
}>;

export type DirectPostgresPreflightOptions = Readonly<{
  adapters: CredentialFreeNetworkAdapters;
  caPath: string;
  caSha256: string;
  timeoutMs: number;
}>;

export type DirectPostgresPreflightResult = Readonly<{
  ok: boolean;
  classification: 'DIRECT_POSTGRES_PREFLIGHT_PASS' | FailureClassification;
  failureStage?: DirectPostgresStage;
  target: typeof DIRECT_POSTGRES_TARGET;
  ca: Readonly<{
    authorityId: string;
    sha256: string;
    size: number;
  }>;
  stages: readonly DirectPostgresStage[];
  dns?: Readonly<{
    resolver: readonly string[];
    records: readonly Readonly<{
      address: string;
      family: AddressFamily;
      ttl: number;
    }>[];
  }>;
  selectedRoute?: Readonly<{
    address: string;
    family: AddressFamily;
    metric: number;
  }>;
  tls?: Readonly<{
    authorized: true;
    cipher?: string;
    peerAddress: string;
    peerCertificateSha256?: string;
    protocol: 'TLSv1.2' | 'TLSv1.3';
    servername: string;
  }>;
  counters: Readonly<{
    authenticationAttemptCount: 0;
    closeControlCount: 1;
    credentialAccessCount: 0;
    databaseMutationCount: 0;
    fallbackCount: 0;
    liveNetworkActionCount: number;
    psqlInvocationCount: 0;
    retryCount: 0;
    sqlMessageCount: 0;
    startupMessageCount: 0;
  }>;
}>;

class PreflightFailure extends Error {
  constructor(
    readonly classification: FailureClassification,
    readonly stage?: DirectPostgresStage,
  ) {
    super(classification);
    this.name = 'PreflightFailure';
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeIpv4(address: string): string {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  const octets = address.split('.').map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  const normalized = octets.join('.');
  if (isIP(normalized) !== 4) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  return normalized;
}

function ipv6Words(address: string): number[] {
  if (address.includes('%') || address.includes('.')) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  const normalized = address.toLowerCase();
  const halves = normalized.split('::');
  if (halves.length > 2) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }

  const parseHalf = (half: string): number[] => {
    if (half === '') return [];
    return half.split(':').map((part) => {
      if (!/^[0-9a-f]{1,4}$/.test(part)) {
        throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
      }
      return Number.parseInt(part, 16);
    });
  };

  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  if (halves.length === 1) {
    if (left.length !== 8) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
    }
    return left;
  }

  const missing = 8 - left.length - right.length;
  if (missing < 1) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  return [...left, ...Array<number>(missing).fill(0), ...right];
}

function compressIpv6(words: readonly number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;

  for (let index = 0; index <= words.length; index += 1) {
    if (index < words.length && words[index] === 0) {
      if (currentStart < 0) currentStart = index;
      continue;
    }
    if (currentStart >= 0) {
      const length = index - currentStart;
      if (length > bestLength && length >= 2) {
        bestStart = currentStart;
        bestLength = length;
      }
      currentStart = -1;
    }
  }

  if (bestStart < 0) return words.map((word) => word.toString(16)).join(':');
  const left = words.slice(0, bestStart).map((word) => word.toString(16)).join(':');
  const right = words
    .slice(bestStart + bestLength)
    .map((word) => word.toString(16))
    .join(':');
  if (left === '' && right === '') return '::';
  if (left === '') return `::${right}`;
  if (right === '') return `${left}::`;
  return `${left}::${right}`;
}

function normalizeIpv6(address: string): { address: string; words: number[] } {
  if (isIP(address) !== 6) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  const words = ipv6Words(address);
  return { address: compressIpv6(words), words };
}

function requirePublicAddress(address: string, family: AddressFamily): string {
  if (family === 4) {
    const normalized = normalizeIpv4(address);
    const [a, b] = normalized.split('.').map(Number) as [number, number, number, number];
    const prohibited =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224;
    if (prohibited) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
    }
    return normalized;
  }

  const normalized = normalizeIpv6(address);
  const bytes = normalized.words.flatMap((word) => [word >>> 8, word & 0xff]);
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const uniqueLocal = (bytes[0]! & 0xfe) === 0xfc;
  const linkLocal = bytes[0] === 0xfe && (bytes[1]! & 0xc0) === 0x80;
  const multicast = bytes[0] === 0xff;
  const ipv4Mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (allZero || loopback || uniqueLocal || linkLocal || multicast || ipv4Mapped) {
    throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
  }
  return normalized.address;
}

function normalizeRecords(
  records: readonly Readonly<{ address: string; family: AddressFamily; ttl: number }>[],
): readonly Readonly<{ address: string; family: AddressFamily; ttl: number }>[] {
  const normalized = new Map<string, { address: string; family: AddressFamily; ttl: number }>();
  for (const record of records) {
    if ((record.family !== 4 && record.family !== 6) || !Number.isInteger(record.ttl) || record.ttl < 0) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
    }
    const address = requirePublicAddress(record.address, record.family);
    const key = `${record.family}:${address}`;
    const existing = normalized.get(key);
    normalized.set(key, {
      address,
      family: record.family,
      ttl: existing === undefined ? record.ttl : Math.min(existing.ttl, record.ttl),
    });
  }
  return [...normalized.values()].sort(
    (left, right) => left.family - right.family || left.address.localeCompare(right.address, 'en'),
  );
}

function normalizePeerAddress(address: string, family: AddressFamily): string {
  try {
    return family === 4 ? normalizeIpv4(address) : normalizeIpv6(address).address;
  } catch {
    throw new PreflightFailure('PRODUCTION_REMOTE_ADDRESS_MISMATCH');
  }
}

function sanitizeResolver(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => /^[\x20-\x7e]{1,256}$/.test(value)))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );
}

function requireClosedOptions(options: DirectPostgresPreflightOptions): void {
  const allowed = new Set(['adapters', 'caPath', 'caSha256', 'timeoutMs']);
  if (Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw new PreflightFailure('PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
  }
  if (
    options.caPath !== APPROVED_CA_PATH ||
    options.caSha256 !== APPROVED_CA_SHA256 ||
    options.timeoutMs !== EXACT_TIMEOUT_MS
  ) {
    throw new PreflightFailure('PRODUCTION_CA_AUTHORITY_MISMATCH');
  }
}

function requireAdapters(adapters: CredentialFreeNetworkAdapters): void {
  const methods: readonly (keyof CredentialFreeNetworkAdapters)[] = [
    'readFile',
    'resolveDns',
    'inspectRoute',
    'connectTcp',
    'exchangeSslRequest',
    'startTls',
    'closeConnection',
    'setTimer',
    'clearTimer',
  ];
  if (methods.some((method) => typeof adapters[method] !== 'function')) {
    throw new TypeError('CREDENTIAL_FREE_NETWORK_ADAPTERS_INCOMPLETE');
  }
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('PREFLIGHT_DEADLINE_EXCEEDED'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new Error('PREFLIGHT_DEADLINE_EXCEEDED'));
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function classifyUnknownFailure(
  error: unknown,
  stage: DirectPostgresStage | undefined,
  aborted: boolean,
): PreflightFailure {
  if (error instanceof PreflightFailure) return error;
  if (aborted || stage === 'CP01' || stage === 'CP02' || stage === 'CP03' || stage === 'CP04') {
    return new PreflightFailure('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE', stage);
  }
  if (stage === 'CP05') return new PreflightFailure('PRODUCTION_TLS_REQUIRED', stage);
  if (stage === 'CP06' || stage === 'CP07') {
    return new PreflightFailure('PRODUCTION_TLS_IDENTITY_MISMATCH', stage);
  }
  return new PreflightFailure('PRODUCTION_CONNECTION_CONTRACT_FAILED', stage);
}

export async function runDirectPostgresPreflight(
  options: DirectPostgresPreflightOptions,
): Promise<DirectPostgresPreflightResult> {
  requireAdapters(options.adapters);
  const adapters = options.adapters;
  const stages: DirectPostgresStage[] = [];
  const controller = new AbortController();
  let timer: unknown;
  let connection: unknown;
  let currentStage: DirectPostgresStage | undefined;
  let failure: PreflightFailure | undefined;
  let caBytes = Buffer.alloc(0);
  let records: readonly Readonly<{ address: string; family: AddressFamily; ttl: number }>[] = [];
  let resolver: readonly string[] = [];
  let selectedRoute: { address: string; family: AddressFamily; metric: number } | undefined;
  let tlsResult: DirectPostgresPreflightResult['tls'];

  const enter = (stage: DirectPostgresStage): void => {
    currentStage = stage;
    stages.push(stage);
  };

  try {
    requireClosedOptions(options);
    caBytes = Buffer.from(await adapters.readFile(options.caPath));
    if (caBytes.byteLength !== APPROVED_CA_SIZE || sha256(caBytes) !== APPROVED_CA_SHA256) {
      throw new PreflightFailure('PRODUCTION_CA_AUTHORITY_MISMATCH');
    }

    timer = adapters.setTimer(() => controller.abort(), EXACT_TIMEOUT_MS);

    enter('CP01');
    enter('CP02');
    const dns = await abortable(
      adapters.resolveDns({ hostname: DIRECT_POSTGRES_TARGET.hostname, signal: controller.signal }),
      controller.signal,
    );
    if (dns.queriedHostname !== DIRECT_POSTGRES_TARGET.hostname) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP02');
    }

    records = normalizeRecords(dns.records);
    resolver = sanitizeResolver(dns.resolver);

    enter('CP03');
    const ipv4RecordCount = records.filter((record) => record.family === 4).length;
    const ipv6RecordCount = records.filter((record) => record.family === 6).length;
    if (ipv4RecordCount === 0) {
      throw new PreflightFailure('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE', 'CP03');
    }
    if (ipv6RecordCount !== 0) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP03');
    }
    if (records.some((record) => !isGloballyReachableIpv4(record.address))) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP03');
    }

    const usableRoutes: { address: string; family: AddressFamily; metric: number }[] = [];
    for (const record of records) {
      const route = await abortable(
        adapters.inspectRoute({
          address: record.address,
          family: record.family,
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (
        route.family !== record.family ||
        normalizePeerAddress(route.address, route.family) !== record.address
      ) {
        throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP03');
      }
      if (route.usable) {
        const metric = route.metric ?? Number.MAX_SAFE_INTEGER;
        if (!Number.isSafeInteger(metric) || metric < 0) {
          throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP03');
        }
        usableRoutes.push({ address: record.address, family: record.family, metric });
      }
    }
    usableRoutes.sort(
      (left, right) =>
        left.metric - right.metric ||
        left.family - right.family ||
        left.address.localeCompare(right.address, 'en'),
    );
    selectedRoute = usableRoutes[0];
    if (selectedRoute === undefined) {
      throw new PreflightFailure('DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE', 'CP03');
    }
    if (
      selectedRoute.family !== 4 ||
      !records.some(
        (record) => record.family === 4 && record.address === selectedRoute?.address,
      ) ||
      !isGloballyReachableIpv4(selectedRoute.address)
    ) {
      throw new PreflightFailure('PRODUCTION_TARGET_MISMATCH', 'CP03');
    }

    enter('CP04');
    const tcp = await abortable(
      adapters.connectTcp({
        address: selectedRoute.address,
        family: selectedRoute.family,
        port: DIRECT_POSTGRES_TARGET.port,
        signal: controller.signal,
      }),
      controller.signal,
    );
    connection = tcp.connection;
    if (
      connection === undefined ||
      connection === null ||
      tcp.remoteFamily !== selectedRoute.family ||
      normalizePeerAddress(tcp.remoteAddress, tcp.remoteFamily) !== selectedRoute.address ||
      tcp.remotePort !== DIRECT_POSTGRES_TARGET.port
    ) {
      throw new PreflightFailure('PRODUCTION_REMOTE_ADDRESS_MISMATCH', 'CP04');
    }

    enter('CP05');
    const response = await abortable(
      adapters.exchangeSslRequest({
        connection,
        request: createPostgresSslRequest(),
        signal: controller.signal,
      }),
      controller.signal,
    );
    try {
      requirePostgresSslResponse(response);
    } catch {
      throw new PreflightFailure('PRODUCTION_TLS_REQUIRED', 'CP05');
    }

    enter('CP06');
    const tls = await abortable(
      adapters.startTls({
        connection,
        ca: caBytes,
        caSha256: APPROVED_CA_SHA256,
        servername: DIRECT_POSTGRES_TARGET.hostname,
        minimumVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        signal: controller.signal,
      }),
      controller.signal,
    );
    if (
      !tls.authorized ||
      tls.authorizationError !== null ||
      !tls.chainVerified ||
      tls.caSha256 !== APPROVED_CA_SHA256 ||
      (tls.protocol !== 'TLSv1.2' && tls.protocol !== 'TLSv1.3') ||
      tls.servername !== DIRECT_POSTGRES_TARGET.hostname
    ) {
      throw new PreflightFailure('PRODUCTION_TLS_IDENTITY_MISMATCH', 'CP06');
    }

    enter('CP07');
    const normalizedPeer = normalizePeerAddress(tls.peerAddress, tls.peerFamily);
    const peerIsResolved = records.some(
      (record) => record.family === tls.peerFamily && record.address === normalizedPeer,
    );
    if (
      !tls.hostnameVerified ||
      !peerIsResolved ||
      tls.peerFamily !== selectedRoute.family ||
      normalizedPeer !== selectedRoute.address ||
      tls.peerPort !== DIRECT_POSTGRES_TARGET.port
    ) {
      throw new PreflightFailure('PRODUCTION_TLS_IDENTITY_MISMATCH', 'CP07');
    }
    tlsResult = {
      authorized: true,
      ...(tls.cipher === undefined ? {} : { cipher: tls.cipher }),
      peerAddress: normalizedPeer,
      ...(tls.peerCertificateSha256 === undefined
        ? {}
        : { peerCertificateSha256: tls.peerCertificateSha256 }),
      protocol: tls.protocol,
      servername: tls.servername,
    };
  } catch (error: unknown) {
    failure = classifyUnknownFailure(error, currentStage, controller.signal.aborted);
  } finally {
    enter('CP08');
    try {
      await adapters.closeConnection(connection);
    } catch {
      failure = new PreflightFailure('PRODUCTION_CONNECTION_CONTRACT_FAILED', 'CP08');
    }
    if (timer !== undefined) adapters.clearTimer(timer);
    caBytes.fill(0);
  }

  const liveNetworkActionCount = stages.filter((stage) => stage !== 'CP08').length;
  return {
    ok: failure === undefined,
    classification: failure?.classification ?? 'DIRECT_POSTGRES_PREFLIGHT_PASS',
    ...(failure?.stage === undefined ? {} : { failureStage: failure.stage }),
    target: DIRECT_POSTGRES_TARGET,
    ca: {
      authorityId: APPROVED_CA_AUTHORITY_ID,
      sha256: APPROVED_CA_SHA256,
      size: APPROVED_CA_SIZE,
    },
    stages,
    ...(records.length === 0 ? {} : { dns: { records, resolver } }),
    ...(selectedRoute === undefined ? {} : { selectedRoute }),
    ...(tlsResult === undefined ? {} : { tls: tlsResult }),
    counters: {
      authenticationAttemptCount: 0,
      closeControlCount: 1,
      credentialAccessCount: 0,
      databaseMutationCount: 0,
      fallbackCount: 0,
      liveNetworkActionCount,
      psqlInvocationCount: 0,
      retryCount: 0,
      sqlMessageCount: 0,
      startupMessageCount: 0,
    },
  };
}
