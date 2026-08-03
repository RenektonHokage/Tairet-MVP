'use strict';

const REQUIRED_EVENTS = Object.freeze([
  'BEGIN',
  'TIMEOUTS',
  'PAYLOAD_SIMPLE_QUERY',
  'IN_TRANSACTION_VERIFIER',
  'LEDGER_PARAMETERIZED_INSERT',
  'LEDGER_REREAD',
  'EFFECT_REREAD',
  'COMMIT',
  'MUTATION_CONNECTION_CLOSED',
  'POST_COMMIT_READ_ONLY_VERIFIER',
  'COMPLETE',
]);

class InvariantGuardError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'InvariantGuardError'; this.code = code; }
}

class StageInvariantGuard {
  constructor(mutationConnectionId) {
    if (!mutationConnectionId) throw new InvariantGuardError('MUTATION_CONNECTION_ID_REQUIRED');
    this.mutationConnectionId = mutationConnectionId;
    this.cursor = 0;
    this.events = [];
  }

  record(event, evidence = {}) {
    const expected = REQUIRED_EVENTS[this.cursor];
    if (event !== expected) throw new InvariantGuardError('STAGE_OPERATION_ORDER_VIOLATION', `expected ${expected}, received ${event}`);
    if (event === 'BEGIN') {
      if (evidence.connectionId !== this.mutationConnectionId || evidence.physicalConnectionCount !== 1) throw new InvariantGuardError('ONE_PHYSICAL_CONNECTION_VIOLATION');
      if (evidence.retryCount !== 0 || evidence.reconnectCount !== 0) throw new InvariantGuardError('AUTOMATIC_RETRY_OR_RECONNECT_PROHIBITED');
    }
    if (event === 'PAYLOAD_SIMPLE_QUERY' && evidence.operationKind !== 'simple-query') throw new InvariantGuardError('PAYLOAD_NOT_SIMPLE_QUERY');
    if (event === 'LEDGER_PARAMETERIZED_INSERT' && evidence.operationKind !== 'extended-parameterized-query') throw new InvariantGuardError('LEDGER_NOT_PARAMETERIZED');
    if (event === 'POST_COMMIT_READ_ONLY_VERIFIER') {
      if (evidence.readOnly !== true) throw new InvariantGuardError('POST_COMMIT_NOT_READ_ONLY');
      if (!evidence.connectionId || evidence.connectionId === this.mutationConnectionId) throw new InvariantGuardError('POST_COMMIT_CONNECTION_NOT_INDEPENDENT');
    }
    this.events.push({ event, evidence });
    this.cursor += 1;
    return this;
  }

  evidence() {
    return { pass: this.cursor === REQUIRED_EVENTS.length, requiredEvents: [...REQUIRED_EVENTS], observedEvents: this.events, mutationConnectionId: this.mutationConnectionId };
  }
}

module.exports = { REQUIRED_EVENTS, InvariantGuardError, StageInvariantGuard };
