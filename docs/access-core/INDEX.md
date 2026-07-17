# Access Core — Context Index

## Purpose

This is the minimum-reading map for Access Core work. It prevents current state, stable decisions, authorization, validation, and history from competing in one document.

Start with the repository guardrails in [`AGENTS.md`](../../AGENTS.md), then choose only the route needed for the task.

## Minimum reading routes

| Question | Read | Do not infer |
| --- | --- | --- |
| What is present, deployed, active, authoritative, or authorized? | [`CURRENT_STATE.md`](CURRENT_STATE.md) | Production from `main`; authorization from capability |
| What stable rules must not change accidentally? | [`INVARIANTS.md`](INVARIANTS.md) | Current activation or next work from an invariant |
| What is closed, eligible, blocked, or awaiting a gate? | [`ROADMAP.md`](ROADMAP.md) | Authorization from roadmap eligibility alone |
| What validation exists now or is planned? | [`TEST_MATRIX.md`](TEST_MATRIX.md) | Planned tooling as implemented tooling |
| How should an authorized slice be executed? | Its single file under `exec-plans/active/` | Authority beyond the current prompt and plan |
| What exactly closed in a previous slice? | The matching file under [`exec-plans/completed/`](exec-plans/completed/9E.5B3B4P.md) | Current runtime state from historical evidence |

Do not read all completed checkpoints unless the task requires historical reconstruction.

## Source precedence by category

1. **Implemented contract:** migrations, code, tests, then docs.
2. **Deployment:** verified runtime and migration ledger, deployed configuration, repository capability, then docs.
3. **Authorization:** current human instruction, current state plus roadmap, then active plan.
4. **Decisions:** invariants, their implementation, then completed checkpoints.
5. **History:** commits, checkpoints/historical docs, then conversations.

When categories conflict, retain both facts with their evidence level and stop only if the conflict affects the requested action.

## Evidence vocabulary

- `VERIFIED_REPOSITORY`: directly verified in the local repository.
- `VERIFIED_RUNTIME`: directly verified in the relevant runtime or migration ledger.
- `REPORTED`: current human-supplied operational information.
- `UNKNOWN`: evidence not available.

Operational state must separately identify repository capability, deployment, activation, authority, and authorization.

## Canonical documents

- [`CURRENT_STATE.md`](CURRENT_STATE.md): compact operational cut with evidence.
- [`INVARIANTS.md`](INVARIANTS.md): stable contracts and safety rules.
- [`ROADMAP.md`](ROADMAP.md): sequencing, eligibility, authorization, cutover, and rollout gates.
- [`TEST_MATRIX.md`](TEST_MATRIX.md): validation surfaces available now and planned for V1B.
- `exec-plans/active/`: one authorized execution plan at a time; the directory exists only when a plan is active.
- `exec-plans/completed/`: compact closure records.

## Historical and reference sources

Use these only for their stated scope:

- [`ACCESS_CORE_ARCHITECTURE.md`](../payments/ACCESS_CORE_ARCHITECTURE.md): architecture and motivation; not current operational state.
- [`ACCESS_CORE_IMPLEMENTATION_PLAN.md`](../payments/ACCESS_CORE_IMPLEMENTATION_PLAN.md): historical implementation ledger through its documented cut.
- [`ACCESS_ENTRIES_QR_EMAIL_PLAN.md`](../payments/ACCESS_ENTRIES_QR_EMAIL_PLAN.md): historical entries/QR/direct-email design.
- [`STATUS.md`](../audits/STATUS.md) and [`HARDENING_ROADMAP.md`](../audits/HARDENING_ROADMAP.md): legacy hardening program, not current Access Core status.
- [`SOURCE_OF_TRUTH.md`](../../SOURCE_OF_TRUTH.md): historical MVP baseline, partially superseded.

Historical documents remain evidence for their own cuts. Their titles do not grant precedence over this category map.

## Completed durable-email checkpoints

- [`9E.5B2H`](exec-plans/completed/9E.5B2H.md)
- [`9E.5B3B1`](exec-plans/completed/9E.5B3B1.md)
- [`9E.5B3B2`](exec-plans/completed/9E.5B3B2.md)
- [`9E.5B3B3`](exec-plans/completed/9E.5B3B3.md)
- [`9E.5B3B4P`](exec-plans/completed/9E.5B3B4P.md)

## Update discipline

- Update current state only when one of its five dimensions changes or new evidence changes a label.
- Update invariants only through an explicit technical decision.
- Update roadmap when eligibility, authorization, or a gate changes.
- Move an active plan to completed only after the sensitive slice is closed with its final commit and evidence.
