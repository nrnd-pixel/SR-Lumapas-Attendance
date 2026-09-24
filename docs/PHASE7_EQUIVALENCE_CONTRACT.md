# Phase 7 — v1.0 Equivalence Contract

**Checkpoint:** Phase 7A — Equivalence Contract Freeze  
**Source baseline:** `7c13336afd3338d7a439406405322579dfe86e45`  
**Production site:** `https://srlumapas.netlify.app/` — protected live v0.7  
**Cleanup candidate:** v1.0 on GitHub `main`; not yet promoted to production  
**Live Attendance migration baseline:** `20260920100523 attendance_v20_enrolment_lifecycle_contract`

## Purpose

Phase 7 proves that the cleaned v1.0 changes structure, maintainability, correctness safeguards, reporting consolidation, and access controls without introducing unexplained changes to established Attendance outcomes.

This contract is public-safe. It contains only aggregate counts, schema/API expectations, synthetic-test requirements, and known release exceptions. It must never contain real pupil mappings, teacher credentials, production exports, service-role keys, private tokens, or other secret/private data.

## Release interpretation

The currently published Netlify application is v0.7. The cleanup/release candidate is v1.0 and has intentionally not yet replaced v0.7.

The confirmed password-recovery race reproduced on live v0.7 is **not evidence that the cleaned v1.0 still has the same bug**. The v1.0 line already contains the Phase 2A recovery correction and browser regressions proving recovery priority, confirmation validation, password update, recovery-session sign-out, normal-login return, old-password rejection, new-password acceptance, preserved teacher scope, and no Attendance RPC entry before normal post-reset sign-in.

Phase 7 must nevertheless re-run the current recovery regressions on the exact v1.0 release candidate before pilot.

## Known release exception

Phase 6C gender completeness remains an explicitly tracked data-quality exception:

- 319 active pupils;
- 25 pupils in 3A have known gender: 14 Male / 11 Female;
- 294 pupils across the other 14 classes remain unknown;
- no gender value may be inferred from pupil names or unofficial data;
- total Attendance calculations must remain correct while gender-specific reporting warns when data is incomplete.

Phase 6C does not automatically block Phase 7 provided the exception is carried forward explicitly and no regression converts missing gender into incorrect total Attendance data.

## Protected production invariants

These values are the Phase 7 live read-only release baseline and must remain unchanged unless an explicitly approved data operation has occurred between checks.

| Invariant | Required value |
| --- | ---: |
| Active classes | 15 |
| Active pupils | 319 |
| Active enrolments | 319 |
| Ended enrolments | 0 |
| Student movement rows | 0 |
| 3A registers | 137 |
| 3A attendance records | 3,425 |
| Active pupils with unknown gender | 294 |

## Protected reporting fixtures

### 3A — February 2026

| Measure | Required value |
| --- | ---: |
| Completed registers | 17 |
| Missing registers | 0 |
| Cumulative attendance | 398 |
| Average attendance ratio | 0.9365 |
| Attendance percentage | 93.65% |
| Gender-unknown pupils | 0 |

### 3A — Term 1 2026

| Measure | Required value |
| --- | ---: |
| Completed registers | 45 |
| Missing registers | 0 |
| Cumulative attendance | 1,051 |
| Average attendance ratio | 0.9342 |
| Attendance percentage | 93.42% |

Reporting invariants:

- missing registers are never zero attendance;
- denominators use completed registers and eligible pupil-days;
- enrolment-date eligibility must remain effective;
- historical attendance survives Transfer Out and Move Class;
- population-aware and legacy Whole-Class reporting contracts must remain compatible with their frozen fixtures.

## Browser acceptance contract

Phase 7 must run the complete current Playwright suite on the same exact release-candidate SHA.

Baseline at Phase 7A:

- 65 Chromium tests;
- no skipped/fixme tests;
- no assertion weakening;
- production Supabase requests blocked by the synthetic browser harness.

Coverage that must remain mandatory includes:

- normal login and signed-in refresh;
- Forgot Password redirect contract;
- recovery-link priority over normal startup;
- password confirmation mismatch;
- minimum-password behavior and server weak-password rejection;
- successful password replacement, recovery sign-out, old-password rejection, new-password acceptance, and preserved teacher scope;
- signup/account binding and teacher approval/gate behavior;
- class authorization and zero-assigned-class behavior;
- register load/save/correction behavior;
- correction-reason and audit semantics;
- unchanged legacy status preservation;
- absence-note requirements and non-school-day blocking;
- unsaved-change safeguards;
- stale async-response protection;
- Transfer In / Transfer Out / Move Class browser contracts;
- teacher-management contracts;
- reporting population controls;
- missing-register distinction;
- February/Term 1 fixtures;
- gender-completeness warning;
- CSV/export behavior;
- navigation/composition/UI-helper behavior.

## Repository/backend acceptance contract

The same exact Phase 7 release-candidate SHA must pass:

1. **Phase 0A Integrity** — historical baseline and deterministic cleanup transformations remain provable.
2. **Phase 0B Backend Contract** — repository SQL/API contract remains internally complete.
3. **Phase 1 Playwright** — complete browser regression suite.
4. **Phase 4B1V Local DB Validation** — local reconstructed database and reporting/equivalence verification.
5. **Phase 5A Security Access Validation** — grants, authorization, write boundaries, role semantics, lifecycle and security contract verification.

All repository Attendance public RPC definitions required by the frontend/reporting stack must remain represented in repository SQL. No frontend direct-table access may be introduced.

Historical verifier rule for Phase 7B:

- a verifier whose assertions encode a deliberately superseded migration state must run at the migration boundary it was written to prove, not against the latest schema;
- `attendance_teacher_management_v16_contract.sql` is therefore validated against an isolated stack ending exactly at v16 `20260919005727 attendance_v16_teacher_management_write_boundary`;
- current Phase 4B1V/Phase 5A validation remains latest-v20 validation and uses the post-v17 teacher-role contract for current role semantics;
- historical assertions must not be edited merely to make them pass against later migrations.

## Live read-only backend seal

Before Phase 7 closure, production must be checked read-only for:

- latest Attendance migration version and name;
- protected aggregate counts;
- protected reporting fixtures;
- expected public Attendance RPC signatures and return types;
- expected SECURITY DEFINER / SECURITY INVOKER modes;
- fixed `search_path` on privileged functions;
- client EXECUTE grants;
- Attendance table grants;
- RLS enablement and policy inventory;
- enrolment lifecycle CHECK presence/validation;
- relevant triggers;
- Security Advisor baseline.

Phase 7A Security Advisor baseline:

- `rls_enabled_no_policy`: 2 INFO;
- `anon_security_definer_function_executable`: 4 WARN;
- `authenticated_security_definer_function_executable`: 18 WARN;
- `auth_leaked_password_protection`: 1 WARN.

Advisor findings must not be described as “healthy” merely because the Supabase project status is `ACTIVE_HEALTHY`. Any count change must be explained before release.

## Data/history safety contract

Phase 7 must preserve:

- all existing Attendance history;
- correction audit semantics;
- enrolment-date eligibility;
- class restrictions;
- complete-roster safeguards;
- missing-register safeguards;
- historical eligibility through Transfer Out / Move Class;
- current controlled Browser → RPC → table write boundaries.

No Phase 7 QA operation may mutate production attendance, pupil, movement, teacher-access, Science, or Auth data.

Synthetic/local DB verifiers may write only rollback-isolated synthetic fixtures.

## UI/DOM/API compatibility contract

Phase 7 is not a UI redesign or feature phase.

No DOM selector, frontend RPC payload, backend RPC signature, returned field, browser global/API ownership, Auth redirect, or Netlify configuration change is allowed merely to make the QA suite pass.

If Phase 7 identifies a real defect, stop the QA checkpoint and fix it in a separate focused corrective branch/PR with its own impact map and regression coverage.

## Deployment boundary

The production Netlify site is not Git-linked. A green GitHub release candidate does not prove that the deployed bytes are the tested bytes.

Phase 7 therefore certifies the v1.0 source candidate only. Phase 8 must deploy a controlled pilot/preview from the exact approved SHA and verify that deployed artifact separately before Phase 9 production promotion.

## Phase 7 checkpoint sequence

### 7A — Equivalence Contract Freeze

Freeze this contract and the canonical roadmap. No runtime or production change.

### 7B — Full Automated QA

Run all five current hard gates on one exact candidate SHA. Run current-schema database verifiers against the latest reconstructed v20 stack, and run any deliberately superseded historical verifier at its frozen migration boundary on that same repository SHA. Record exact workflow/job evidence and resolve any unexplained failure without weakening assertions.

### 7C — Live Read-only Equivalence Seal

Verify the production migration/API/security/aggregate/reporting contract without writes. Record only sanitized aggregate evidence.

### 7D — Final Equivalence Review

Review the complete release-candidate diff, known exceptions, CI, live seal, deployment boundary, rollback plan, and Phase 8 handoff.

## Phase 7 exit

Phase 7 passes only when:

- all agreed automated gates pass on one exact candidate SHA;
- there are no skipped/weakened regression assertions;
- all DB verifiers pass;
- live read-only evidence matches the protected contract or every difference is explicitly explained/approved;
- no Science/private-data/secret leakage is introduced;
- Phase 6C remains explicitly tracked if still unresolved;
- the full release-candidate diff is reviewed;
- no unexplained behavioral difference remains.

Only then may Phase 8 pilot work begin, and Phase 8 must not begin automatically.
