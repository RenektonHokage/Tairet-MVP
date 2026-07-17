# AGENTS.md — Tairet

## Purpose

Durable operating map for this repository. Access Core state, decisions, roadmap, validation, and checkpoints live under [`docs/access-core/`](docs/access-core/INDEX.md).

Read the minimum route required by the task. Do not load every historical document by default.

## Source precedence

Use category precedence; no document is authoritative for every question.

- **Implemented contract:** migrations, code, and tests; then documentation.
- **Deployed state:** verified runtime and migration ledger; then deployed configuration; then repository capability; then documentation. Never infer production from `main`.
- **Authorization:** current human instruction; then `CURRENT_STATE.md` and `ROADMAP.md`; then an active execution plan. Repository capability is not authorization.
- **Decisions and invariants:** `INVARIANTS.md`; then migrations, code, and tests that materialize them; then closed checkpoints.
- **History:** commits; then completed checkpoints and historical documents; then conversations.

If an invariant conflicts with implemented behavior, describe the implementation as fact and stop before changing the decision.

## Evidence labels

Operational assertions use one of these labels:

- `VERIFIED_REPOSITORY`: established from the local repository.
- `VERIFIED_RUNTIME`: established from the relevant runtime or migration ledger.
- `REPORTED`: supplied by a current human instruction but not independently verified.
- `UNKNOWN`: not established by available evidence.

Always distinguish capability in the repository, deployment, activation, operational authority, and authorized work.

## ASK and CODE

`ASK` is discovery, contract extraction, risk analysis, or planning. It does not authorize edits or implementation.

`CODE` requires an explicit scope. Before editing:

1. verify repository root, branch, base commit, tracked worktree, and staging;
2. read the minimum canonical documents and the active plan, if any;
3. identify allowed and forbidden paths;
4. stop if the requested outcome requires a wider surface.

During CODE, do not redefine closed contracts, mix unrelated sensitive surfaces, or make opportunistic fixes.

## Scope and safety

- Touch only authorized paths.
- Do not reset, restore, checkout, stash, merge, or rebase to hide a mismatch.
- Do not apply migrations, change remote state, or change production without explicit authority.
- Do not expose secrets, credentials, payment data, private email addresses, buyer PII, or full access/check-in tokens in files, prompts, logs, or reports.
- Preserve legacy and durable flows until an authorized cutover changes authority.
- Do not reopen a closed decision without new evidence and an explicit technical decision.

## Agents and prompts

Use one principal agent by default. Use subagents only for independent surfaces with non-overlapping files and decisions. The principal agent owns integration, evidence classification, gates, and the final report.

Prompts for sensitive work should contain:

- `Goal`
- `Read`
- `Constraints`
- `Done when`

Repeat task-critical restrictions in the prompt.

## Validation, review, and push

- Run focused validation while implementing.
- Run the complete applicable suite once for each exact candidate changeset.
- Bind review evidence to the exact base and changeset identity.
- Reuse review gates only when the changeset is byte-for-byte identical.
- If any path, mode, byte, or base changes after review, create a new changeset identity and rerun applicable gates.
- A push is mechanical only when the reviewed commit and changeset are unchanged and the remote has not advanced. Pushing never authorizes semantic changes.
- Keep reports compact: outcome, changed paths, validations, residual risk, and next authorized action.

## Contextual stops

Use these stops only when their condition affects the requested task:

- `SCOPE_EXPANSION_REQUIRED`: completion requires paths, systems, or decisions outside the authorized scope.
- `REPOSITORY_STATE_MISMATCH`: root, branch, base, tracked worktree, staging, protected artifacts, or expected hashes differ.
- `REMOTE_ADVANCED`: a remote-sensitive action depends on a remote ref that advanced beyond the reviewed base.
- `PRODUCTION_STATE_UNKNOWN`: the task must assert or modify production but runtime or migration-ledger evidence is missing. This does not automatically block authorized local, reversible work.
- `TECHNICAL_DECISION_REQUIRED`: safe completion requires a new or changed product/architecture decision.

Do not use a stop for unrelated unknowns.

## Documentation maintenance

- Update `CURRENT_STATE.md` after a product closure, deployment/activation change, authority change, or authorization change.
- Update `ROADMAP.md` when eligibility, sequencing, or gates change.
- Update `INVARIANTS.md` only for deliberate stable decisions.
- Create a completed checkpoint after each remotely closed sensitive slice; do not paste full logs.
- Keep volatile checkout data, stashes, untracked files, detailed roadmaps, and architecture out of this file.
