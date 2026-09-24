# Phase 7D — Final Equivalence Review

**Date:** 24 Sep 2026  
**Repository review base:** `e85a20e5f797dd9b4d0064455752e2aa383cacbd`  
**Purpose:** final pre-pilot review of the cleaned v1.0 source, automated QA evidence, live read-only seal, known exceptions, deployment boundary, rollback posture, and Phase 8 handoff.

## Result

**PASS — no unexplained cleanup regression or release-blocking equivalence difference was found.**

Phase 7 is complete once this review is merged. Phase 8 remains a separate, explicitly approved pilot/deployment checkpoint and must not start automatically.

## Evidence classification

- **Repository evidence:** current GitHub `main`, frozen Phase 0A baseline, Phase 7 contract, Phase 7C live seal, workflow definitions, frontend modules, Supabase repository source/verifiers, and exact PR/workflow evidence.
- **Live-system evidence:** the merged Phase 7C read-only production seal, latest Attendance migration ledger, protected aggregate/reporting values, PostgreSQL catalog/privilege metadata, lifecycle constraint state, FK-index coverage, and Security Advisor counts.
- **Prior authoritative configuration evidence:** user-provided Supabase/Netlify Dashboard evidence already recorded in the canonical roadmap.
- **Inference:** limited to comparing byte/diff scope and determining whether later documentation/QA changes could alter runtime/backend behavior.

## Exact source state

Current signed repository `main` at review start:

`e85a20e5f797dd9b4d0064455752e2aa383cacbd`

Frozen original v1.0 repository baseline:

`c578b4240a2bd9899db602fa818bda99bd6ff3cd`

Frozen Phase 7 cleanup candidate baseline:

`7c13336afd3338d7a439406405322579dfe86e45`

Final full hard-gate Phase 7B head:

`03413456970ffb00f46ef6194ed25236cce4a3bc`

### Drift check after full hard-gate validation

From `03413456970ffb00f46ef6194ed25236cce4a3bc` to current `main`, only:

- `ATTENDANCE_TECH_DEBT_CLEANUP_ROADMAP.md`
- `docs/PHASE7C_LIVE_READ_ONLY_SEAL.md`

changed.

No application runtime, DOM, Netlify config, Supabase migration/source/verifier SQL, or browser-test source changed after the full Phase 7B hard-gate head.

From the frozen Phase 7 cleanup candidate baseline `7c13336...` to current `main`, all changes are limited to Phase 7 workflows/docs:

- 3 workflow files;
- canonical roadmap;
- Phase 7 equivalence contract;
- Phase 7C live seal.

Therefore the runtime/backend bytes covered by Phase 7B did not drift during Phase 7A–7C closure work.

## Complete cleanup diff review

Compared with the frozen original v1.0 baseline `c578b424...`, current `main` is:

- 377 commits ahead;
- 0 commits behind;
- 63 changed files total.

Diff categories:

- 17 frontend/runtime files;
- 25 Supabase source/migration/fixture/verifier files;
- 12 browser-test files;
- 6 GitHub Actions workflow files;
- 3 cleanup/QA documentation files.

The broad diff is explained by the staged cleanup programme rather than a rewrite.

### Frontend/runtime ownership

Current runtime remains a static vanilla-JS application.

Current ownership split:

- `assets/js/main.js` — composition root and startup wiring.
- `supabase-client.js` — single Supabase client construction.
- `app-state.js` — shared mutable state and request serials.
- `date-helpers.js` — Brunei/date display helpers.
- `ui-helpers.js` — DOM lookup, escaping, grouped class options.
- `auth-session.js` — login/session/recovery/sign-out routing.
- `attendance-register.js` — register load/edit/save/correction behavior.
- `student-management.js` — Transfer In/Out/Move Class UI.
- `teacher-admin.js` — approval and enable/disable administration.
- `teacher-access.js` — signup, pending approval and access gate.
- `statistics.js` — monthly class statistics.
- `admin-dashboard.js` — school dashboard.
- `period-reports.js` — Term/YTD reports and CSV.
- `reporting-population.js` — Whole-Class vs Non-SEN selection.
- `app-bootstrap.js` — post-auth bootstrap.
- `app-navigation.js` — six-panel navigation.

No Attendance-specific Maths-App wrapper chain exists.

### DOM / browser API contract

Current `index.html` contains:

- 171 unique DOM IDs;
- zero duplicate IDs;
- one same-origin application module loader: `./assets/js/main.js`.

Protected entry/screen IDs remain present, including:

- login: `#loginView/#loginForm/#loginBtn/#forgotBtn/#openSignupBtn`;
- signup: `#signupView/#signupForm/#signupName/#signupEmail/#signupPassword/#signupClass/#signupRole/#signupBtn`;
- recovery: `#recoveryView/#recoveryForm/#recoveryBtn`;
- teacher gate: `#teacherGateView/#gateRequestForm/#checkApprovalBtn`;
- app/navigation: `#appView/#mainNav` plus Attendance/Dashboard/Statistics/Reports/Students/Teachers tabs and panels;
- student-management dialogs: `#transferInDialog/#transferOutDialog/#moveClassDialog`.

Current application code uses only the expected direct `window` surfaces identified in this review: `window.addEventListener` and `window.location`.

### Browser → backend boundary

Fresh current-source inspection found:

- zero direct `.from(...)` table access;
- all application data operations remain RPC/Auth based;
- the cleaned frontend references all 21 public Attendance RPCs, including the six population-aware reporting choices selected dynamically.

This matches the preferred Browser → controlled RPC → tables boundary.

## Intentional behavior changes preserved by cleanup

The final candidate intentionally differs from protected live v0.7 in reviewed ways, including:

- password recovery now has priority over normal startup routing;
- recovery validates confirmation, updates password, signs out the recovery session, then requires normal login;
- pending teacher-signup state is bound to the correct Auth user;
- stale-response guards protect the implemented Attendance/statistics/dashboard/report surfaces;
- explicit Whole-Class / Non-SEN reporting population is available while Whole Class remains default;
- teacher assignment roles persist `class_teacher` / `assistant_teacher` authoritatively;
- frontend is modularized without changing stable DOM contracts;
- direct authenticated write access has been progressively closed behind controlled RPC boundaries;
- enrolment lifecycle and FK-index coverage are explicitly constrained/verified.

These are documented cleanup changes, not unexplained equivalence failures.

## Final automated QA evidence

Full hard-gate candidate head:

`03413456970ffb00f46ef6194ed25236cce4a3bc`

Exact-head runs:

- Phase 0A Integrity `35978518239` — PASS.
- Phase 0B Backend Contract `35978518257` — PASS.
- Phase 1 Playwright `35978518244` — PASS.
- Phase 4B1V Local DB Validation `35978518195` — PASS.
- Phase 5A Security Access Validation `35978518253` — PASS.
- Phase 7B Historical v16 Boundary `35978518209` — both jobs PASS.

Playwright result:

- 65/65 Chromium tests passed in 26.5s;
- 0 npm vulnerabilities;
- no skipped/fixme result was reported.

Historical v16 validation preserves the original v16 teacher-management verifier unchanged at its correct migration boundary.

The later Phase 7C docs-only head also passed Phase 0A, Phase 0B and Playwright 65/65, providing an additional no-drift check.

## Live Phase 7C seal

Merged evidence: `docs/PHASE7C_LIVE_READ_ONLY_SEAL.md`.

Production still ends at:

`20260920100523 attendance_v20_enrolment_lifecycle_contract`

Protected live values remain:

- 15 active classes;
- 319 active pupils;
- 319 current enrolments;
- 0 ended enrolments;
- 0 student-movement rows;
- 3A = 137 registers / 3,425 attendance records;
- attendance audit = 3,425 rows;
- 0 corrected registers;
- 0 audit UPDATEs / DELETEs.

Protected reporting remains exact:

- Feb Whole Class: 398 / 425 = 0.9365 = 93.65%, 17 completed, 0 missing.
- Feb Non-SEN: 392 / 408 = 0.9608 = 96.08%, 17 completed, 0 missing.
- Term 1 Whole Class: 1,051 / 1,125 = 0.9342 = 93.42%, 45 completed, 0 missing.
- Term 1 Non-SEN: 1,036 / 1,080 = 0.9593 = 95.93%, 45 completed, 0 missing.

The repository's non-mutating Attendance contract and FK-index verifier both returned zero mismatch rows against production.

## Security/access review

Current live contract remains:

- 21 public Attendance RPCs;
- 18 SECURITY DEFINER / 3 SECURITY INVOKER;
- fixed empty `search_path` on exposed DEFINER functions;
- authenticated and service-role EXECUTE as frozen;
- only `attendance_signup_options()` anonymous;
- no PUBLIC EXECUTE on Attendance RPCs;
- authenticated direct INSERT/UPDATE/DELETE closed across the protected write boundaries;
- v20 lifecycle CHECK present and validated;
- zero lifecycle-shape mismatches.

Security Advisor remains the frozen known baseline:

- 2 `rls_enabled_no_policy` INFO;
- 4 anonymous SECURITY DEFINER WARN;
- 18 authenticated SECURITY DEFINER WARN;
- 1 leaked-password-protection WARN.

No new Science exposure was introduced by cleanup.

## Known exceptions / residual risks

These are retained and explained; they are not Phase 7 blockers.

### 1. Gender completeness

294 of 319 active pupils still have unknown gender.

Phase 6C remains blocked pending an official private source keyed by `student_ref`. Do not infer gender from names and do not commit real mappings to the public repository.

### 2. Private attendance audit RLS

`attendance_private.attendance_record_audit` has RLS disabled.

Fresh Phase 7C checks proved `anon`, `authenticated`, and PUBLIC have no `attendance_private` schema USAGE and no client table privileges on the audit table. This matches the frozen privilege-isolation contract but remains a defense-in-depth item for later review.

### 3. Auth leaked-password protection

Supabase Security Advisor still reports leaked-password protection disabled. The recorded project-plan/configuration evidence treats this as a residual risk/future upgrade option rather than an unapproved cleanup change.

### 4. Three inherited async UI gaps

Current source still does not add request-serial protection to:

- `loadAdminStudents()`;
- `loadAdminTeachers()`;
- overlapping teacher-access / Check Approval status checks.

These were explicitly excluded from Phase 2C and remain tracked inherited UI-race risks. They should be exercised during the pilot rather than silently described as fixed.

### 5. Repository governance

Repository rulesets currently return an empty set.

The connected GitHub integration cannot read the branch-protection endpoint (403), so Phase 7D does not claim independent confirmation of branch-protection state. Continue the established PR-only, explicit-approval, expected-head-SHA discipline.

### 6. Netlify deployment coupling

Most recent authoritative Dashboard evidence recorded in the roadmap shows the production site is not Git-linked, so merging GitHub `main` does not itself promote v1.0.

Phase 7D did not change Netlify configuration. Account-level deployment linkage should be rechecked immediately before the Phase 8 pilot.

## Rollback posture

### Phase 8 pilot rollback

Phase 8 must use a separate preview/staging deployment. Protected production v0.7 must remain unchanged.

Therefore the primary pilot rollback is operational:

- stop/remove/ignore the preview;
- do not point production traffic to it;
- leave the current v0.7 site untouched.

### Backend posture during Phase 8

Production backend is already at reviewed v20 and Phase 7C proves it matches the repository contract.

The Phase 8 pilot must not introduce a new DB migration, Auth policy change, Science change, or production data repair merely to run the cleaned frontend.

Existing migration rollback notes remain in the canonical roadmap. In particular, the v20 lifecycle migration can be rolled back by dropping `attendance_enrolments_lifecycle_status_check`; no v20 row rollback is required.

### Production promotion rollback

Phase 9 must define the exact Netlify/static artifact rollback before replacing v0.7. Promotion remains separately approval-gated.

## Phase 8 handoff

Phase 8 may begin only after this Phase 7D review is merged and the user explicitly approves the pilot.

Pilot source discipline:

1. branch/deploy from the exact signed post-Phase-7 `main`;
2. before deployment, prove runtime/backend source paths remain byte-equivalent to the Phase 7-tested candidate except for approved docs/QA-only files;
3. deploy to an isolated preview/staging URL;
4. do not replace or relink the protected v0.7 production site;
5. do not apply new Supabase migrations or modify Science/Auth configuration.

Representative pilot checks should include:

- normal admin/teacher login and sign-out;
- forgot-password reset link stays on Set New Password;
- mismatched recovery passwords reject safely;
- successful reset signs out recovery session and requires normal login;
- assigned-class restriction;
- mobile register load/save;
- no-change save;
- correction reason/audit behavior;
- missing-register behavior;
- Transfer In / Transfer Out / Move Class;
- Dashboard and monthly statistics;
- Whole-Class and Non-SEN reporting;
- Term/YTD and CSV;
- teacher approval/enable/disable;
- student roster refresh and teacher-admin refresh under repeated/rapid actions;
- repeated Check Approval actions;
- practical mobile responsiveness/performance.

Pilot evidence must identify the exact deployed source SHA and must not contain real pupil datasets, credentials, service-role keys, or production exports.

## Phase 7 exit decision

All agreed Phase 7 exit conditions are satisfied:

- automated hard gates passed;
- no weakened/skipped regression assertion is identified;
- current DB verifiers passed at their correct migration boundaries;
- live read-only evidence matches the protected contract;
- no Science/private-data/secret leakage was introduced;
- Phase 6C remains explicitly tracked;
- full cleanup/release-candidate diff has been reviewed;
- no unexplained behavioral difference remains.

**Phase 7 final status: PASS / complete, pending merge of this documentation-only review.**

**Phase 8 status: not started.**
