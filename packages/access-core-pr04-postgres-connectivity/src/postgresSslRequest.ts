import { Buffer } from 'node:buffer';

const POSTGRES_SSL_REQUEST_PACKET_LENGTH = 8;
const POSTGRES_SSL_REQUEST_CODE = 80877103;
const POSTGRES_SSL_SUPPORTED_RESPONSE = 0x53;

/** Allocates PostgreSQL's fixed int32 length and request code from private scalar authority. */
export function createPostgresSslRequest(): Buffer {
  const request = Buffer.alloc(POSTGRES_SSL_REQUEST_PACKET_LENGTH);
  request.writeUInt32BE(POSTGRES_SSL_REQUEST_PACKET_LENGTH, 0);
  request.writeUInt32BE(POSTGRES_SSL_REQUEST_CODE, 4);
  return request;
}

function requireCanonicalPostgresSslRequest(request: Uint8Array): void {
  const candidate = Buffer.from(request);
  if (
    candidate.byteLength !== POSTGRES_SSL_REQUEST_PACKET_LENGTH ||
    candidate.readUInt32BE(0) !== POSTGRES_SSL_REQUEST_PACKET_LENGTH ||
    candidate.readUInt32BE(4) !== POSTGRES_SSL_REQUEST_CODE
  ) {
    throw new Error('PRODUCTION_TLS_REQUIRED');
  }
}

/**
 * Validates caller bytes and gives the writer a new scalar-derived canonical
 * request synchronously, leaving no mutable shared byte authority.
 */
export function writeCanonicalPostgresSslRequest(
  request: Uint8Array,
  write: (canonicalRequest: Buffer) => void,
): void {
  requireCanonicalPostgresSslRequest(request);
  write(createPostgresSslRequest());
}

/**
 * Accepts only PostgreSQL's single-byte `S` response. `N`, extra bytes, and
 * truncated responses all fail closed before TLS or a StartupMessage.
 */
export function requirePostgresSslResponse(byte: number | Uint8Array): void {
  let value: number;

  if (typeof byte === 'number') {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new Error('PRODUCTION_TLS_REQUIRED');
    }
    value = byte;
  } else {
    if (byte.byteLength !== 1) {
      throw new Error('PRODUCTION_TLS_REQUIRED');
    }
    value = byte[0] as number;
  }

  if (value !== POSTGRES_SSL_SUPPORTED_RESPONSE) {
    throw new Error('PRODUCTION_TLS_REQUIRED');
  }
}
