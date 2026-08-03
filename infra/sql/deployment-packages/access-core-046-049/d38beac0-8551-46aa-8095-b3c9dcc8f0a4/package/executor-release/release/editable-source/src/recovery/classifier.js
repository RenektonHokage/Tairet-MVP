'use strict';

const RECOVERY = Object.freeze({
  ALREADY_APPLIED_VERIFIED: 'ALREADY_APPLIED_VERIFIED',
  NOT_APPLIED_VERIFIED: 'NOT_APPLIED_VERIFIED',
  AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED: 'AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED',
  AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK: 'AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK',
  HARD_STOP_SPLIT_STATE: 'HARD_STOP_SPLIT_STATE',
  HARD_STOP_INCOMPATIBLE_STATE: 'HARD_STOP_INCOMPATIBLE_STATE',
});

function classifyRecovery({ ledger, effects, predecessorExact, ambiguousCommit = false }) {
  if (!['absent', 'exact', 'incompatible'].includes(ledger) || !['absent', 'exact', 'partial', 'incompatible'].includes(effects)) throw new TypeError('invalid recovery evidence');
  if (ledger === 'incompatible' || effects === 'incompatible' || effects === 'partial') return RECOVERY.HARD_STOP_INCOMPATIBLE_STATE;
  if ((ledger === 'exact') !== (effects === 'exact')) return RECOVERY.HARD_STOP_SPLIT_STATE;
  if (ledger === 'exact' && effects === 'exact') return ambiguousCommit ? RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED : RECOVERY.ALREADY_APPLIED_VERIFIED;
  if (ledger === 'absent' && effects === 'absent' && predecessorExact) return ambiguousCommit ? RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK : RECOVERY.NOT_APPLIED_VERIFIED;
  return RECOVERY.HARD_STOP_INCOMPATIBLE_STATE;
}

const RECONCILE_LEDGER_ONLY_POLICY = Object.freeze({ enabled: false, ordinaryExecutorPath: false, requiresSeparateHumanAuthorization: true, requiresSeparateCommandSurface: true });

module.exports = { RECOVERY, RECONCILE_LEDGER_ONLY_POLICY, classifyRecovery };
