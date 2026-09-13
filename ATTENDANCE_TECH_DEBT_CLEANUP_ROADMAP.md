# SR Lumapas Attendance App — Technical-Debt Cleanup Roadmap

**Status:** Active working reference  
**Live site:** https://srlumapas.netlify.app/  
**Live version:** v0.7  
**Cleanup baseline:** v1.0  
**Last updated:** 13 September 2026

## Purpose

This file is the canonical source-of-truth roadmap for the Attendance App cleanup. Its canonical repository location is `nrnd-pixel/SR-Lumapas-Attendance/ATTENDANCE_TECH_DEBT_CLEANUP_ROADMAP.md` on GitHub `main`. At the start of every Attendance cleanup session, fetch this file from GitHub and check whether an active cleanup PR contains a newer copy. Update the roadmap in the same working branch/PR whenever the baseline, risks, phase status, acceptance criteria, or release plan materially change. A separate ChatGPT Project Source upload is not required once this file is merged.

## Core rules

- Treat the Attendance App as a working production system.
- Keep v0.7 live and unchanged while v1.0 is cleaned up.
- Do not rewrite from scratch.
- Preserve behaviour unless a change is explicit.
- Work in small, reversible checkpoints.
- Impact-map before coding.
- Add real browser regression coverage before structural refactors.
- Prefer Browser → controlled RPC → tables as the application boundary.
- Do not combine major refactoring, security redesign, UI redesign, and new feature work in one checkpoint.
- Do not promote/merge without explicit approval after verification.

## Current baseline evidence

- 15 active classes.
- 319 active pupils.
- 3A historical baseline: 137 registers / 3,425 attendance records.
- v1.0 frontend package contains `index.html`, `netlify.toml`, and `README.txt`.
- v1.0 `index.html`: about 1,178 lines / 84.6 KB.
- Frontend is currently a single embedded ES-module.
- 171 unique DOM IDs; no duplicate IDs found in the audited v1.0 source.
- 18 unique Attendance RPCs are called by v1.0 and all 18 currently exist in the live backend.
- No direct browser table access was found in v1.0; the frontend uses RPCs.
- No Attendance-specific global wrapper chain was found.
- No repository-side SQL definitions, Playwright suite, or verifier suite are included in the original v1.0 ZIP.
- GitHub Actions integrity CI is now merged on `main` as `.github/workflows/phase0a-integrity.yml`; the Phase 0B backend-contract workflow is also merged as `.github/workflows/phase0b-backend-contract.yml`.
- The prior Maths App protocol concepts such as `validateStudentAccess`, `finishPractice`, `cloud.rpc`, `MutationObserver`, `shuffle`, `config.js`, and `v40-release.js` are **not applicable** to Attendance unless they later appear in the repository.

## Confirmed production bug to fix in cleanup

### Password-recovery routing race — CONFIRMED

Observed behaviour:

Forgot Password → reset email → reset link → recovery form briefly appears → app routes directly to Admin/Teacher screen.

Cause:

`PASSWORD_RECOVERY` shows the recovery form, but startup also calls `getSession()`. The recovery link creates a valid session, so normal session routing calls `enterApp()` and overwrites the recovery screen.

Required cleaned behaviour:

Forgot Password → reset email → reset link → stay on Set New Password → enter/confirm new password → update password → sign out recovery session → return to normal login → sign in using new password.

Acceptance coverage must prove:
- normal login still works;
- normal refresh while signed in still works;
- reset link stays on recovery screen;
- mismatched passwords are rejected;
- successful reset signs out the recovery session;
- old password fails;
- new password works;
- teacher/admin permissions and class assignments are preserved.

## Roadmap

### Phase 0A — Freeze canonical frontend baseline
**Status:** Complete.
**Goal:** Establish the exact v1.0 source before any functional change.

Actions:
- Put exact v1.0 source into a canonical Git repository.
- Commit it unchanged.
- Record exact `main` SHA.
- Preserve v1.0 ZIP/hash and Netlify config.
- Record DOM/API baseline and known-good data/report fixtures.

**Exit:** v1.0 frontend is reproducible from version control with zero functional changes.

### Phase 0B — Reconstruct backend source
**Status:** Complete.
**Goal:** Make the Attendance Supabase backend reproducible.

Actions:
- Capture Attendance schema, tables, functions, RPCs, grants, RLS, Auth redirect settings, and migrations under version control.
- Verify every active frontend RPC has a matching repository SQL definition.
- Record current production data-count fixtures separately from migrations.

**Exit:** backend structure can be recreated without reverse-engineering the live project.

### Phase 1 — Regression safety net
**Status:** In progress — Phase 1A complete; Phase 1B not started.
**Goal:** Protect current behaviour before refactoring.

Required real browser scenarios:
- teacher sign in/sign out;
- forgot-password recovery;
- teacher signup → email verification → Pending Approval;
- admin approve/reject and Attendance-only enable/disable;
- teacher sees assigned class only; admin sees all classes;
- load/save daily register;
- Mark All Present and exception editing;
- no-change save creates no false correction;
- correction requires reason and audits only changed pupils;
- Transfer In / Transfer Out / Move Class;
- monthly statistics;
- admin school dashboard;
- Term/YTD reports;
- CSV export.

**Exit:** core workflows pass repeatably in automated browser tests.

### Phase 2 — Correctness fixes
**Goal:** Fix known defects before structural cleanup.

Actions:
- Fix confirmed password-recovery routing race.
- Prevent stale async responses from overwriting newer class/date/report selections.
- Replace/harden browser-wide pending teacher-signup `localStorage` so pending state is bound to the correct account/session.
- Re-verify Supabase Auth Site URL and redirect allow-list for `https://srlumapas.netlify.app/`.

**Exit:** no known recovery, stale-response, or cross-account pending-signup correctness issue remains.

### Phase 3 — Frontend modularisation
**Goal:** Remove the single-file frontend bottleneck without changing behaviour.

Target ownership:
- config/environment;
- Supabase API client;
- auth/password recovery;
- shared state;
- shared UI helpers;
- attendance/corrections;
- student management;
- teacher access;
- statistics;
- admin dashboard;
- Term/YTD reports/export.

Actions:
- split ownership into maintained modules;
- preserve stable DOM contracts;
- manage Supabase JS dependency reproducibly;
- reduce inline JS/CSS enough to support a tighter CSP later.

**Exit:** equivalent browser behaviour with clear module ownership.

### Phase 4 — Reporting consolidation
**Goal:** Prevent formula drift across reports.

Actions:
- centralise school-day, eligible-pupil-day, register-completion, and attendance-counting logic;
- make Monthly, Dashboard, Term, and YTD reporting reuse shared calculation logic;
- preserve missing-register safeguards;
- preserve transfer-aware denominators.

**Exit:** one calculation model drives all reporting surfaces.

### Phase 5 — Security and access cleanup
**Goal:** Make the trust boundary explicit and minimal.

Actions:
- review every public Attendance RPC and `SECURITY DEFINER` function;
- keep privileged functions only where needed and verify internal authorization;
- clarify/reduce direct authenticated table-write privileges if RPC-only writes are intended;
- review private audit-table RLS and document intentional exceptions;
- persist `class_teacher` / `assistant_teacher` authoritatively instead of collapsing to generic `teacher`;
- review password policy and leaked-password protection;
- document intentionally anonymous signup-options access.

**Exit:** application access model is explicit and verified.

### Phase 6 — Performance and data-model cleanup
**Goal:** Remove smaller backend debt before wider rollout.

Actions:
- add appropriate covering indexes for currently unindexed Attendance foreign keys;
- do not remove “unused” indexes just because pilot traffic is low;
- formalise consistency between enrolment `active`, `end_date`, and `enrolment_status`;
- complete gender data from an official source only.

**Exit:** no obvious schema/index/data-quality debt blocks scale.

### Phase 7 — Full equivalence QA
**Goal:** Prove cleanup changed structure, not established outcomes.

Actions:
- run targeted tests after each checkpoint;
- run full browser/regression and hard-gate suites;
- compare known-good report fixtures;
- verify roster, teacher access, corrections, student movements, historical counts, and reporting equivalence;
- review full diff before promotion.

**Exit:** all agreed equivalence checks pass with no unexplained differences.

### Phase 8 — Pilot cleaned build
Deploy a safe preview/staging build and test with admin plus teachers from multiple year levels. Collect real feedback on login, mobile attendance, corrections, reports, and performance.

**Exit:** representative pilot is stable.

### Phase 9 — Promote cleaned version
Verify exact release candidate, backend compatibility, rollback path, tests, CI/hard gates, and diff. Promote only after explicit approval.

**Exit:** cleaned build replaces v0.7 and becomes the production baseline.

### Phase 10 — Resume feature development
Recommended order:
1. CCA annual setup and roster foundation.
2. CCA Saturday attendance.
3. Separate CCA statistics/dashboard.
4. Year-end promotion/rollover.
5. Remaining official attendance statistic once confirmed.
6. Further reporting/export refinement.

## Risk register

### Immediate
- Fresh Phase 0B evidence confirms authenticated direct DML is granted on `attendance.daily_registers` and `attendance.attendance_records` within RLS-accessible classes. This preserves class scoping but can bypass `attendance_save_register` completeness, correction-reason, and register correction-count safeguards. Preserve the live state in Phase 0B; redesign/revoke only in the later security phase with regression coverage.
- Production migration history includes Attendance pupil-roster/pilot seed migrations. Their historical SQL must **not** be copied into the public repository because it may contain real pupil/attendance data. Record only sanitized version/name metadata and recreate the current structure from the live structural snapshot.
- Phase 1A now establishes real Chromium browser coverage for critical auth/access and attendance/correction flows; admin-management and reporting browser coverage remains incomplete until Phase 1B.
- v0.7 live and v1.0 development have diverged.
- Confirmed password-recovery routing race.
- Potential stale async-response overwrites.
- Pending signup state is too loosely stored for shared-device use.

### Medium-term
- v1.0 single-file frontend is too large for safe continued growth.
- Reporting logic is duplicated across large RPCs.
- Teacher active assignment role semantics are weaker than signup role semantics.
- Public RPC / `SECURITY DEFINER` surface needs maintained verification.
- Runtime CDN/inline JS/CSS reduce reproducibility and CSP strength.
- Attendance and Science share one Supabase project, increasing operational coupling.

### Lower priority / data debt
- Several foreign keys lack covering indexes.
- Some indexes appear unused but production traffic is still too small for removal decisions.
- 294 of 319 pupils currently lack gender values.
- Enrolment `active`, `end_date`, and `enrolment_status` need formal consistency rules.

## Reference QA fixtures

### 3A February 2026
- Pupils: 25
- School days: 17
- Male cumulative: 214
- Female cumulative: 184
- Total cumulative: 398
- Possible attendance: 425
- Average attendance ratio: 0.9365
- Attendance percentage: 93.65%

### 3A Term 1 2026
- Registers: 45/45
- Cumulative attendance: 1,051
- Average attendance ratio: 0.9342
- Attendance percentage: 93.42%

Core rule:

`average attendance ratio = cumulative attendance / possible attendance`

`attendance % = average attendance ratio × 100`

For transfers, use eligible pupil-days. Missing registers must never be treated as zero attendance.

## Current status

**Current checkpoint:** Phase 1A — COMPLETE. Playwright browser-regression foundation is merged to `main`. Phase 1B and Phase 2 have not started.

- Canonical repository: `nrnd-pixel/SR-Lumapas-Attendance` (public).
- Persistent roadmap is canonical at repository-root `ATTENDANCE_TECH_DEBT_CLEANUP_ROADMAP.md` on GitHub `main`; future sessions should fetch it directly and also check active cleanup PRs for a newer roadmap copy.
- Verified current `main` SHA after Phase 1A merge: `c3c2068f428156a1071f4961f810bebdcbf597bd`.
- PR #4 — `Phase 1A: add Playwright regression foundation` — merged successfully on 13 Sep 2026 from exact head `08e10ed7952e1e21adaafcf458d89f75e56b75ef` using an expected-head SHA guard.
- Final pre-merge exact-head CI was green:
  - `Phase 1 Playwright` run `34734060261` — success.
  - `Phase 0A Integrity` run `34734060259` — success.
  - `Phase 0B Backend Contract` run `34734060265` — success.
- Phase 1A runs the real frozen `index.html` in Chromium while intercepting only the Supabase ESM import with a synthetic client. Production Supabase requests are blocked and asserted absent.
- The frozen production frontend remains unchanged; no DOM, Supabase SQL, Science, Netlify, Auth configuration, or production-data change was made by Phase 1A.
- Playwright 1.63.0 is pinned; GitHub Actions `npm install` reported 0 vulnerabilities on the final head.
- Chromium executes 12 tests with one worker; all 12 complete successfully under Playwright expected-failure semantics.
- Passing baseline coverage includes normal teacher login/logout, signed-in refresh, teacher/admin class scope, signup/email-verification return to Pending Approval, password mismatch validation, first register save, Mark All Present, exception editing, unchanged saved-register behaviour, correction-reason/payload behaviour, unsaved-change protection, and mobile overflow smoke coverage.
- The confirmed password-recovery startup race and current successful-reset-to-app behaviour remain encoded with full desired assertions using explicit `test.fail(...)` expected-failure markers. They are not skipped and the assertions are not weakened; Phase 2 must remove those markers and make the same tests pass normally.
- Phase 1B still needs browser coverage for admin student management, teacher approval/enable-disable flows, monthly statistics, admin school dashboard, Term/YTD reporting, CSV export, and reporting invariants.

**Production safeguard:** keep v0.7 live and unchanged during cleanup.

**Next action:** STOP at the Phase 1A completion gate. Begin Phase 1B only after explicit user approval. Do not begin Phase 2 automatically.

**Recommended thinking effort:** High.

## Change log

- **10 Sep 2026:** Initial cleanup roadmap created.
- **12 Sep 2026:** Rebased roadmap on audited v1.0 source and Attendance-specific engineering rules; split Phase 0 into frontend Git baseline and backend reconstruction; marked Maths-specific wrapper/loader checks as not applicable to Attendance; reclassified password-recovery routing race as confirmed production behaviour and added explicit acceptance criteria.
- **12 Sep 2026:** Created public canonical GitHub repository `nrnd-pixel/SR-Lumapas-Attendance`; recorded initial `main` SHA `5f4608613afefdba81c2bba4c7c8133b5fcf33f5`; froze exact v1.0 frontend on `cleanup/phase-0a-freeze-v1.0`; verified source integrity; opened draft PR #1 for review. No deployment or functional change.
- **12 Sep 2026:** Added minimal Phase 0A integrity CI at `.github/workflows/phase0a-integrity.yml`; PR #1 moved to head `c8963f78d6edf9dd770ac50a355fe6ce85525f1a` with four added files. GitHub Actions run `34676963624` completed successfully. Removed obsolete risk stating that no canonical Git/main baseline existed. User has approved merge, but PR #1 remains unmerged pending final exact-head verification.
- **12 Sep 2026:** Phase 0A completed. Re-verified PR #1 head `c8963f78d6edf9dd770ac50a355fe6ce85525f1a` and green integrity CI, marked the PR ready for review, and merged with an expected-head SHA guard. Verified current `main` at merge commit `c578b4240a2bd9899db602fa818bda99bd6ff3cd`. No deployment or runtime behaviour change. Phase 0B not started.
- **12 Sep 2026:** Phase 0B discovery started from verified `main` `c578b4240a2bd9899db602fa818bda99bd6ff3cd`; created `cleanup/phase-0b-backend-source` at the exact same SHA. Re-verified the 18-RPC frontend contract and confirmed the repository still has no Attendance SQL source. No backend SQL was written or applied; fresh live Supabase structural capture remains required before reconstruction.
- **13 Sep 2026:** Phase 0B fresh live structural snapshot captured from `SR Lumapas Science Dev` (`rojetehazryfpcxlwtbi`) and reconciled with frozen v1.0. Snapshot contains 423 metadata rows: 18 tables, 163 columns, 94 constraints, 57 indexes, 13 triggers, 50 RLS policies, and 25 functions. All 18 frontend RPC names match live public Attendance RPCs exactly. Documented confirmed direct-DML bypass risk and class/assistant-teacher role-semantic mismatch. No SQL written or applied.
- **13 Sep 2026:** Phase 0B snapshot #2 captured: 39 migration-history rows (31 Attendance, 8 Science), 13 Attendance codes, and 6 absence reasons. Identified production roster/pilot seed migrations that must not be copied into the public repository and creator-identity metadata that is unnecessary for reconstruction. Re-verified Git `main` and the Phase 0B branch both at `c578b4240a2bd9899db602fa818bda99bd6ff3cd`. Proposed a sanitized cumulative baseline layout; no SQL committed or applied.
- **13 Sep 2026:** Captured Supabase Auth URL configuration: Site URL `https://srlumapas.netlify.app/`, allowed Redirect URL `https://srlumapas.netlify.app/**`. This matches frontend `window.location.origin + '/'` redirects. Phase 0B evidence capture is complete; implementation remains unstarted pending approval.
- **13 Sep 2026:** Phase 0B backend-source checkpoint implemented on clean head `ad532b719e5c5a7cacbc3f3ce705b601ac5bb37b`. Temporary staging history was normalized away; final branch is one commit ahead of `main` with exactly six approved files. Draft PR #2 opened. Exact-head CI green: Phase 0B Backend Contract run `34732039528` and Phase 0A Integrity run `34732039525`. PR remains unmerged pending explicit user approval.
- **13 Sep 2026:** Phase 0B completed. PR #2 was re-verified at exact head `ad532b719e5c5a7cacbc3f3ce705b601ac5bb37b`, with exactly six approved files and both Phase 0A/Phase 0B CI gates green, then marked ready and merged with an expected-head SHA guard. Verified current `main` at merge commit `71bfd7dc9b6a14fd6c80021ba034e0ead8edc2e2`; merged tree contains the backend baseline/verification files and no temporary staging artifacts. No live Supabase or frontend changes. Phase 1 not started.
- **13 Sep 2026:** User approved the persistent GitHub roadmap and subsequent Phase 1A Playwright foundation. Created documentation branch `docs/persistent-cleanup-roadmap` from exact `main` `71bfd7dc9b6a14fd6c80021ba034e0ead8edc2e2`. The root roadmap file will become canonical across future chats once merged; Phase 1A remains unstarted until that documentation PR is merged and verified.
- **13 Sep 2026:** Persistent roadmap PR #3 merged with expected head `7f3f7ebc137e8142b94b0d0e6df0337fdc68adce`; verified new `main` at `ffcdb460b991c5873f22a97ac8767a2826c077a0`. Repository-root `ATTENDANCE_TECH_DEBT_CLEANUP_ROADMAP.md` is now canonical across future sessions. Created `cleanup/phase-1a-playwright-foundation` from that exact SHA and began only the previously approved browser-regression foundation; no production/runtime change.
- **13 Sep 2026:** Phase 1A browser foundation implemented in draft PR #4. Initial Playwright 1.55.0 run passed 12 browser tests but npm reported 2 high-severity dependency vulnerabilities; upgraded the test-only dependency to current stable Playwright 1.63.0 after checking npm. Exact head `8176f45ea9c9c503f26647b00cf3e5dd6003cd06` then passed Phase 1 Playwright run `34733865915`, Phase 0A run `34733865920`, and Phase 0B run `34733865914`; npm audit reported 0 vulnerabilities. No frontend or live-system change.
- **13 Sep 2026:** Phase 1A completed. PR #4 was re-verified at exact head `08e10ed7952e1e21adaafcf458d89f75e56b75ef`, with exactly eight approved files and all three CI gates green, then marked ready and merged with an expected-head SHA guard. Verified current `main` at merge commit `c3c2068f428156a1071f4961f810bebdcbf597bd`. The Playwright browser-regression foundation is now on `main`; live v0.7 and production Supabase remain unchanged. Phase 1B and Phase 2 have not started.
