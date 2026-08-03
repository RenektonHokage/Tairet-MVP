'use strict';

const crypto = require('crypto');
const net = require('net');
const path = require('path');
const { serialize } = require(path.resolve(__dirname, '../../../vendor/pg-protocol/dist/serializer.js'));
const { Parser } = require(path.resolve(__dirname, '../../../vendor/pg-protocol/dist/parser.js'));
const { beginScram, continueScram, finalizeScram } = require('./scram');

class ProtocolClientError extends Error {
  constructor(code, detail = '', cause = null) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'ProtocolClientError';
    this.code = code;
    this.cause = cause;
  }
}

class ProtocolClient {
  constructor(config) {
    this.config = { port: 5432, connectTimeoutMs: 10000, ...config };
    this.connectionId = crypto.randomBytes(8).toString('hex');
    this.physicalConnectionCount = 0;
    this.queryCount = 0;
    this.reconnectCount = 0;
    this.retryCount = 0;
    this.operationKinds = [];
    this.closed = false;
    this.ready = false;
    this.parser = new Parser();
    this.pending = null;
    this.startupPending = null;
    this.backendKey = null;
  }

  async connect() {
    if (this.socket || this.physicalConnectionCount !== 0) throw new ProtocolClientError('AUTOMATIC_RECONNECT_PROHIBITED');
    this.physicalConnectionCount += 1;
    this.socket = net.createConnection({ host: this.config.host, port: this.config.port });
    this.socket.setNoDelay(true);
    this.socket.on('data', (chunk) => this.parser.parse(chunk, (message) => this.onMessage(message)));
    this.socket.on('error', (error) => this.failPending(new ProtocolClientError('SOCKET_ERROR', error.message, error)));
    this.socket.on('close', () => {
      this.closed = true;
      if (!this.ready || this.pending) this.failPending(new ProtocolClientError('CONNECTION_CLOSED_WITH_UNCERTAIN_STATE'));
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProtocolClientError('CONNECT_TIMEOUT')), this.config.connectTimeoutMs);
      this.socket.once('connect', () => {
        clearTimeout(timer);
        this.startupPending = { resolve, reject, error: null };
        const startup = { user: this.config.user, database: this.config.database, application_name: this.config.applicationName || 'tairet-atomic-executor-v1' };
        if (this.config.readOnly) startup.options = '-c default_transaction_read_only=on';
        this.socket.write(serialize.startup(startup));
      });
    });
    return this;
  }

  onMessage(message) {
    if (message.name === 'authenticationCleartextPassword') {
      if (this.config.password == null) return this.failPending(new ProtocolClientError('PASSWORD_REQUIRED_BUT_NOT_CONFIGURED'));
      this.socket.write(serialize.password(this.config.password));
      return;
    }
    if (message.name === 'authenticationMD5Password') {
      if (this.config.password == null) return this.failPending(new ProtocolClientError('PASSWORD_REQUIRED_BUT_NOT_CONFIGURED'));
      const inner = crypto.createHash('md5').update(`${this.config.password}${this.config.user}`).digest('hex');
      const response = `md5${crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), message.salt])).digest('hex')}`;
      this.socket.write(serialize.password(response));
      return;
    }
    if (message.name === 'authenticationSASL') {
      try {
        if (this.config.password == null) throw new ProtocolClientError('PASSWORD_REQUIRED_BUT_NOT_CONFIGURED');
        if (!message.mechanisms.includes('SCRAM-SHA-256')) throw new ProtocolClientError('UNSUPPORTED_AUTHENTICATION_METHOD', message.mechanisms.join(','));
        this.scram = beginScram(this.config.user);
        this.socket.write(serialize.sendSASLInitialResponseMessage('SCRAM-SHA-256', this.scram.clientFirstMessage));
      } catch (error) { this.failPending(error); }
      return;
    }
    if (message.name === 'authenticationSASLContinue') {
      try { this.socket.write(serialize.sendSCRAMClientFinalMessage(continueScram(this.scram, this.config.password, message.data))); }
      catch (error) { this.failPending(error); }
      return;
    }
    if (message.name === 'authenticationSASLFinal') {
      try { finalizeScram(this.scram, message.data); this.scram = null; }
      catch (error) { this.failPending(error); }
      return;
    }
    if (message.name === 'backendKeyData') this.backendKey = { processID: message.processID, secretKey: message.secretKey };
    const target = this.pending || this.startupPending;
    if (!target) return;
    if (message.name === 'error') {
      target.error = message;
      return;
    }
    if (this.pending) {
      if (message.name === 'rowDescription') this.pending.fields = message.fields.map((field) => field.name);
      else if (message.name === 'dataRow') {
        const row = {};
        message.fields.forEach((value, index) => { row[this.pending.fields[index]] = value == null ? null : value.toString('utf8'); });
        this.pending.currentRows.push(row);
      } else if (message.name === 'commandComplete') {
        this.pending.results.push({ command: message.text, rows: this.pending.currentRows });
        this.pending.currentRows = [];
      }
    }
    if (message.name === 'readyForQuery') {
      this.ready = true;
      const completed = this.pending || this.startupPending;
      this.pending = null;
      this.startupPending = null;
      if (completed.error) completed.reject(new ProtocolClientError('POSTGRES_ERROR', `${completed.error.code || ''} ${completed.error.message || ''}`.trim(), completed.error));
      else completed.resolve(completed.results || []);
    }
  }

  failPending(error) {
    const target = this.pending || this.startupPending;
    this.pending = null;
    this.startupPending = null;
    if (target) target.reject(error);
  }

  operation(buffer, kind) {
    if (!this.socket || this.closed) return Promise.reject(new ProtocolClientError('CONNECTION_NOT_OPEN'));
    if (this.pending) return Promise.reject(new ProtocolClientError('CONCURRENT_QUERY_PROHIBITED'));
    this.ready = false;
    this.queryCount += 1;
    this.operationKinds.push(kind);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, error: null, kind, fields: [], currentRows: [], results: [] };
      this.socket.write(buffer);
    });
  }

  simpleQuery(sql) {
    if (typeof sql !== 'string') throw new TypeError('simple query must be text');
    return this.operation(serialize.query(sql), 'simple-query');
  }

  extendedQuery(sql, values) {
    if (!Array.isArray(values) || values.some((value) => value != null && typeof value !== 'string' && !Buffer.isBuffer(value))) throw new TypeError('extended query parameters must be string, Buffer, or null');
    const buffer = Buffer.concat([
      serialize.parse({ text: sql }),
      serialize.bind({ values }),
      serialize.describe({ type: 'P' }),
      serialize.execute(),
      serialize.sync(),
    ]);
    return this.operation(buffer, 'extended-parameterized-query');
  }

  async close() {
    if (!this.socket || this.closed) return;
    await new Promise((resolve) => {
      this.socket.once('close', resolve);
      this.socket.end(serialize.end());
      setTimeout(() => { if (!this.closed) this.socket.destroy(); }, 1000).unref();
    });
  }

  destroyUncertain() {
    if (this.socket && !this.closed) this.socket.destroy();
  }

  invariantEvidence() {
    return {
      connectionId: this.connectionId,
      physicalConnectionCount: this.physicalConnectionCount,
      reconnectCount: this.reconnectCount,
      retryCount: this.retryCount,
      queryCount: this.queryCount,
      operationKinds: [...this.operationKinds],
      automaticRetry: false,
      automaticReconnect: false,
    };
  }
}

function lastRows(results) {
  for (let i = results.length - 1; i >= 0; i -= 1) if (results[i].rows.length) return results[i].rows;
  return [];
}

module.exports = { ProtocolClient, ProtocolClientError, lastRows };
