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
- Phase 0A's original frozen `index.html` is anchored at merge commit `c578b4240a2bd9899db602fa818bda99bd6ff3cd` with SHA-256 `199d93f81c1cdb1742544f0dbde3f9da2e264b9d2dc16e4ce93cd53140387086`. From Phase 2 onward, the integrity gate must verify that immutable historical baseline while separately syntax-checking the current working frontend; controlled runtime changes must not rewrite the historical baseline.
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

Phase 2A implements the routing/session correction and is merged on the cleanup `main` via PR #8. Browser coverage proves recovery-screen priority, confirmation mismatch rejection, password update, recovery-session sign-out, return to normal login, old-password rejection, new-password acceptance, preservation of teacher class scope, and no Attendance RPC entry until normal post-reset sign-in. Credential-transition checks use the synthetic Auth harness rather than a real production teacher credential; hosted Auth configuration was separately re-verified in Phase 2D. This cleanup work is not itself production promotion.

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
**Status:** Complete.
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
**Status:** Complete and merged on cleanup `main`. Phase 2A password recovery, Phase 2B pending-signup account binding, Phase 2C stale async-response protection, and Phase 2D hosted Auth URL/redirect verification are complete.
**Goal:** Fix known defects before structural cleanup.

Actions:
- Fix confirmed password-recovery routing race.
- Prevent stale async responses from overwriting newer class/date/report selections.
- Replace/harden browser-wide pending teacher-signup `localStorage` so pending state is bound to the correct account/session.
- Re-verify Supabase Auth Site URL and redirect allow-list for `https://srlumapas.netlify.app/`.

Phase 2 checkpoint split:
- **2A — Password recovery correctness:** recovery takes startup priority; confirmation is validated; password is updated; recovery session is signed out; normal sign-in is required afterward. **Complete and merged.**
- **2B — Pending signup account binding:** bind browser-persisted pending signup state to the intended account/session and prevent cross-account reuse on shared devices. **Complete and merged via PR #10.** The pending record is versioned and bound to the Supabase Auth user ID, is written only after successful signup, is read/cleared only for the matching signed-in user, and legacy/unbound state fails closed rather than being attributed to another account. A different account can neither auto-submit, pre-fill from, nor delete another user's pending signup state.
- **2C — Stale async-response protection:** protect attendance, monthly statistics, dashboard, report-option, and Term/YTD rendering from older responses overwriting newer selections. **Complete and merged via PR #12.** The frontend uses per-surface monotonically increasing request serials plus captured selection keys so only the newest matching response may update UI/state. Report class/type/term/as-of changes also invalidate any in-flight rendered report/export state. No RPC, SQL, grant, RLS, DOM-ID, Science, or Netlify configuration change was required.
- **2D — Auth URL/redirect re-verification:** **Complete and merged via PR #14.** User-provided live Supabase Dashboard evidence on 13 September 2026 confirms Site URL `https://srlumapas.netlify.app/` and exactly one Redirect URL `https://srlumapas.netlify.app/**`. These values match the Phase 0B repository record and the current frontend contract, which sends `window.location.origin + '/'` for both signup verification and password recovery. No hosted Auth configuration mutation was required. Current Supabase guidance prefers exact production redirect paths where practical, but narrowing the existing working wildcard is a separate hardening decision rather than a Phase 2 correctness fix. Netlify preview-host redirects remain a later pilot/staging concern.

**Phase 2B acceptance coverage:**
- successful email-confirmation signup stores a versioned pending record bound to the created Auth user ID;
- the same user returning after verification can still auto-submit the exact name/class/role and then clear that user's pending record;
- a failed signup creates no pending record;
- a different unauthorized account on the same browser cannot auto-submit or pre-fill another user's pending data;
- a different account manually submitting its own gate request does not delete another user's pending record;
- an already-authorized different account does not delete another user's pending record;
- legacy/unbound pending state is discarded rather than attributed to the signed-in user;
- no Supabase RPC signature, grant, RLS, table, Science, or Netlify configuration change is required for Phase 2B.

**Phase 2C acceptance coverage:**
- an older attendance class/date response cannot replace a newer roster/banner/selection;
- an A → B → A attendance sequence proves request serials reject the first A response even when its selection key becomes current again;
- older monthly-statistics and admin-dashboard responses cannot replace newer class/month selections;
- older report-option responses cannot repopulate terms for a class the user has already left;
- changing report class/type/term/as-of invalidates rendered report/export state, and an older Term/YTD response cannot replace a newer report;
- the synthetic Supabase browser harness can deterministically hold/release named RPC responses rather than relying on timing sleeps;
- existing recovery, signup isolation, attendance/correction, admin, missing-register, CSV, February 3A, and Term 1 3A assertions remain mandatory;
- no Supabase mutation or backend contract change is required.

**Phase 2D acceptance coverage:**
- fresh hosted Supabase Dashboard evidence confirms Site URL `https://srlumapas.netlify.app/`;
- fresh hosted Supabase Dashboard evidence confirms the sole Redirect URL `https://srlumapas.netlify.app/**`;
- signup verification sends `emailRedirectTo` to the current browser origin root;
- Forgot Password sends `redirectTo` to the current browser origin root;
- the browser redirect contract is asserted dynamically against `window.location.origin + '/'`, so it is not coupled to the Playwright test host;
- no Supabase/Auth setting, RPC, SQL, grant, RLS, Science, Netlify, DOM, production-data, or deployment mutation is required.

**Exit:** no known recovery, stale-response, cross-account pending-signup, or hosted Auth redirect-configuration correctness issue remains in the cleaned build.

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
- Phase 1 regression coverage is complete on cleanup `main`; 34 Chromium tests now cover auth/access, attendance/corrections, admin management, reporting, CSV export, missing-register safeguards, official 3A reporting invariants, password recovery, Phase 2B shared-device signup isolation, six deterministic Phase 2C stale-response races, and the Phase 2D signup/password-reset redirect contract.
- v0.7 live and v1.0 cleanup `main` have diverged by design.
- The password-recovery routing race remains a known behaviour of the protected v0.7 production baseline; the Phase 2A fix is merged into cleanup `main` but must not be treated as production until an explicitly approved promotion.
- The shared-device pending-signup bug remains a known behaviour of the protected v0.7 production baseline; the Phase 2B fix is merged into cleanup `main` but must not be treated as production until an explicitly approved promotion.
- Netlify account-level auto-deploy linkage is not represented in repository files. No explicit production-promotion action was performed as part of Phase 2A, Phase 2B, Phase 2C, or Phase 2D; independently verify the live deployment boundary before any release decision.
- Stale async-response overwrites are guarded on cleanup `main` by request-serial/selection-key checks with deterministic browser coverage. This does not constitute production promotion; v0.7 remains the protected live baseline until an explicitly approved release.
- Fresh Phase 2D live Dashboard evidence confirms the production Site URL/Redirect URL pair still matches the frontend. The wildcard Redirect URL is broader than the exact root path the current frontend requests; leave it unchanged in Phase 2D because no correctness mismatch exists. Review any narrowing or preview-host additions separately with release/pilot scope.

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

**Current checkpoint:** Phase 2 — CORRECTNESS FIXES COMPLETE AND MERGED. Phase 3 has not started.

- Canonical repository: `nrnd-pixel/SR-Lumapas-Attendance` (public).
- Current verified cleanup `main`: `97a17d87863cc8eb6c25263b57c139091c1e7189`.
- PR #14 — `Phase 2D: verify Auth redirect configuration contract` — merged with an expected-head SHA guard at exact verified head `f949407811e170da82052613905ba190fea8c29e`.
- Merge commit: `97a17d87863cc8eb6c25263b57c139091c1e7189`, signed/verified by GitHub, with parents `ee962e793b267e63938133b95df8e36a8439f37a` and `f949407811e170da82052613905ba190fea8c29e`.
- Exact-final-head CI before merge was green: Phase 0A Integrity `34749816234`, Phase 0B Backend Contract `34749816250`, and Phase 1 Playwright `34749816255` with 34/34 Chromium tests in 10.8s, Node `v22.23.2`, npm `10.9.8`, and 0 vulnerabilities.
- Fresh user-provided Supabase Dashboard evidence on 13 September 2026 confirms Site URL `https://srlumapas.netlify.app/` and sole Redirect URL `https://srlumapas.netlify.app/**`; no hosted Auth mutation was required.
- Current frontend requests `window.location.origin + '/'` for signup verification and password recovery, and browser coverage now asserts that exact contract dynamically against the current origin.
- Phase 2D made no runtime, Supabase/Auth configuration, RPC, SQL, grant, RLS, Science, `netlify.toml`, DOM, production-data, or deployment change.
- No explicit production promotion was performed. Netlify account-level auto-deploy linkage remains outside repository evidence and must be independently verified before release.

**Production safeguard:** keep v0.7 live and unchanged during cleanup. Do not treat cleanup `main` as a production release.

**Next action:** STOP before Phase 3. The next engineering action, only after explicit user approval, is a fresh Phase 3 frontend-modularisation impact map from exact current `main`. Do not begin Phase 3 automatically.

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
- **13 Sep 2026:** User approved Phase 1B. Created `cleanup/phase-1b-admin-reporting-playwright` from exact `main` `3acbd8fc0a6bff99afac7868719d8ce69a044d9f` and opened draft PR #6. Added browser coverage for student movements, teacher administration, monthly statistics, dashboard, Term/YTD reports, CSV export, official 3A reporting fixtures, and separate missing-register semantics. After correcting an internal fixture consistency issue and a hidden-selector test-order issue without changing application code or weakening assertions, exact implementation head `3f96b934645ba6f1df743f4bcf9364a1304c7da5` passed all three gates: Playwright run `34735346538` (23 passed), Phase 0A `34735346559`, Phase 0B `34735346539`; npm reported 0 vulnerabilities. PR remains draft/unmerged pending final roadmap-head CI and explicit user merge approval.
- **13 Sep 2026:** Final Phase 1B review re-verified the three-file-only diff, exact-head CI on `cd4633c5deba48fadb153ea66e5141d01a242481`, and absence of review threads/comments. One test-quality gap was found: Transfer Out mocked the preserved-attendance count without asserting the visible preservation response. The admin-management spec was strengthened to assert both Transfer Out preserved-record messaging and Move Class preserved-record/backfill messaging. The roadmap was updated to make exact-current-head CI—not an older embedded SHA—the merge gate. No application, Supabase, Science, Netlify/Auth, or production-data change was made.
- **13 Sep 2026:** Phase 1 completed. PR #6 was re-verified at exact head `4aa3bcc86697ead0935e382fcb1d7ffe8f8b0557`, with exactly three approved files and all three gates green (Playwright `34736212462`: 23/23 passed; Phase 0A `34736212438`; Phase 0B `34736212441`), then merged with an expected-head SHA guard. Verified new `main` at merge commit `a0176fa922ff6d524b2844ff761865081000c5cd`. Live v0.7 and production Supabase remain unchanged. Phase 2 has not started.
- **13 Sep 2026:** Documentation closure PR #7 updated the canonical roadmap to mark Phase 1 complete and Phase 2 not started, then merged into `main` at `9b43a4ce3dd949c37a609c4203654f526ec3b865`. No runtime, backend, Science, Netlify/Auth, deployment, or production-data change.
- **13 Sep 2026:** Phase 2 impact map completed from exact `main` `9b43a4ce3dd949c37a609c4203654f526ec3b865`; user approved Phase 2A only. PR #8 created on `cleanup/phase-2a-password-recovery`. The confirmed recovery race was fixed by giving a recovery link/state priority over normal startup routing and, after a successful password update, signing out the recovery session and returning to normal login. Two former expected-failure recovery tests became mandatory passing assertions. Initial implementation head `0f8645c3fcaa010d6315b24a346c3f19de1b3cf6` passed all 23 Playwright tests and the Phase 0B backend contract; the old Phase 0A current-file checksum guard failed by design because Phase 2 is the first intentional runtime change.
- **13 Sep 2026:** User approved evolution of the Phase 0A integrity gate. Commit `1806fe73e14563811ea5fc4ed6ae25469b652dec` preserves the original v1.0 freeze by verifying the historical `index.html` from baseline merge `c578b4240a2bd9899db602fa818bda99bd6ff3cd` against the original SHA-256, while separately syntax-checking the current frontend.
- **13 Sep 2026:** Phase 2A final acceptance coverage was strengthened without production credentials: the synthetic Auth harness models password replacement, and the recovery browser test proves old-password failure, new-password success, and preserved teacher class scope. Exact PR #8 head `053598a0445b0f3aa3bc17a498c2db37d54834af` passed all three gates: Phase 0A `34738533610`, Phase 0B `34738533605`, and Playwright `34738534139` (23/23, 0 vulnerabilities).
- **13 Sep 2026:** Phase 2A completed. PR #8 was merged with an expected-head SHA guard at exact head `053598a0445b0f3aa3bc17a498c2db37d54834af`. Verified signed merge commit and new cleanup `main` at `f4f141bb46890715eb0c35a692c4bad4e7dd969c`. No Supabase SQL/RPC/grant/RLS, Science, `netlify.toml`, reporting-formula, attendance-history, or production-data change was included. No explicit production promotion was performed. Phase 2B/2C/2D remain unstarted.
- **13 Sep 2026:** Documentation closure PR #9 recorded the merged Phase 2A checkpoint and was merged into `main` at `235fdb4277e20be230ae012b0101176a68c15d5c`. The merge was documentation-only; Phase 2A runtime remained unchanged and Phase 2B/2C/2D remained unstarted.
- **13 Sep 2026:** Phase 2B impact mapping and fresh live RPC verification completed from exact `main` `235fdb4277e20be230ae012b0101176a68c15d5c`. Confirmed that unbound pending-signup `localStorage` could be submitted, pre-filled, or deleted by a different account on a shared browser. Live `attendance_submit_teacher_request` remains bound internally to `auth.uid()` and `attendance_teacher_status` returns `user_id`, so the checkpoint is frontend/test-only with no backend authorization change required.
- **13 Sep 2026:** Phase 2B implemented on `cleanup/phase-2b-pending-signup-binding`: pending signup state is versioned and bound to Auth user ID, written only after successful signup, consumed/cleared only for the matching account, and legacy unbound state fails closed. Browser tests were expanded for same-account verification return, failed signup, cross-account isolation, preservation during manual gate submission, authorized-account isolation, and legacy-state handling. Whole-file `index.html` reconstruction drift was caught during diff review and corrected before PR/CI. Verification remains pending; do not merge or start Phase 2C until exact-head gates are green and explicit approval is given.
- **13 Sep 2026:** Phase 2B completed. PR #10 was re-verified at exact head `136ae88e46ff62a961d684cbb6ed92d705a13033` with exactly three changed files and all three required CI gates green (Phase 0A `34744925819`, Phase 0B `34744925796`, Playwright `34744925879`: 27/27 passed, 0 npm vulnerabilities), then merged with an expected-head SHA guard. Verified signed new cleanup `main` at `41d88be698d1e7bd7cd0eaca1956323d2941290c`, with parents `235fdb4277e20be230ae012b0101176a68c15d5c` and `136ae88e46ff62a961d684cbb6ed92d705a13033`. No backend, Science, `netlify.toml`, attendance-history/reporting, production-data, or explicit production-promotion change was included. Phase 2C/2D remain unstarted.
- **13 Sep 2026:** Documentation closure PR #11 recorded the merged Phase 2B checkpoint and was merged into `main` at `7f1d25307678800e9083c8e519faac60c9883726`. The merge was documentation-only; Phase 2B runtime remained unchanged and Phase 2C/2D remained unstarted.
- **13 Sep 2026:** Phase 2C impact mapping completed from exact signed `main` `7f1d25307678800e9083c8e519faac60c9883726`. Confirmed real stale-response races in `attendance_load_register`, monthly statistics, admin dashboard, report options, and Term/YTD rendering, including a report-options race that could pair an old class ID with newly populated term controls. Fresh live read-only Supabase verification confirmed the five RPC signatures, SECURITY DEFINER modes/authorization checks, and latest Attendance migration `20260906125521 attendance_v12_term_ytd_reporting` remain unchanged; no backend mutation is required.
- **13 Sep 2026:** User approved Phase 2C implementation. Created `cleanup/phase-2c-stale-response-guards` from exact `main` `7f1d25307678800e9083c8e519faac60c9883726`. Added per-surface request serial/selection guards and report-selection invalidation in `index.html`; extended the synthetic Supabase harness with deterministic named deferred RPC releases; added six Playwright race regressions covering attendance date, attendance A → B → A, monthly statistics, dashboard month, report options, and Term→YTD ordering. Immediate base-vs-branch diff review shows `index.html` limited to 47 additions / 6 deletions with no unrelated reconstruction drift. Exact-head CI and final PR review remain pending; do not merge or start Phase 2D until all gates are green and explicit approval is given.
- **13 Sep 2026:** Phase 2C completed. PR #12 was re-verified at exact head `de2499b2c981a681aaf3ce94e34577c80ea70f0a` with exactly five changed files and all three required gates green (Phase 0A `34748002787`; Phase 0B `34748002795`; Playwright `34748002818`: 33/33 passed, Node `v22.23.2`, npm `10.9.8`, 0 vulnerabilities), then merged with an expected-head SHA guard. Verified signed new cleanup `main` at `a8b73bc55cbdeea3b4edd6dace7f505a625f36d2`, with parents `7f1d25307678800e9083c8e519faac60c9883726` and `de2499b2c981a681aaf3ce94e34577c80ea70f0a`. No backend, Science, `netlify.toml`, attendance-history/reporting-formula, production-data, or explicit production-promotion change was included. Phase 2D remains unstarted.
- **13 Sep 2026:** Documentation closure PR #13 recorded the merged Phase 2C checkpoint and was merged into signed cleanup `main` at `ee962e793b267e63938133b95df8e36a8439f37a`. The merge was documentation-only; Phase 2D remained unstarted and no production promotion was performed.
- **13 Sep 2026:** Phase 2D impact/evidence mapping completed from exact signed `main` `ee962e793b267e63938133b95df8e36a8439f37a`. Current frontend signup and password recovery both request `window.location.origin + '/'`. Fresh user-provided Supabase Dashboard evidence confirms hosted Site URL `https://srlumapas.netlify.app/` and sole Redirect URL `https://srlumapas.netlify.app/**`, matching the Phase 0B record and current frontend; no hosted Auth configuration mutation is required. Current Supabase guidance recommends exact production redirect paths where practical, but wildcard narrowing is classified as optional hardening rather than a correctness fix, and Netlify preview-host allow-list design is deferred to pilot/staging scope.
- **13 Sep 2026:** User approved Phase 2D closure. Created `cleanup/phase-2d-auth-redirect-verification` from exact signed `main` `ee962e793b267e63938133b95df8e36a8439f37a` and opened draft PR #14. Test-only head `6829e9976d179bc8f6f4f370f3f0b790178969da` added two redirect-contract assertions with no runtime change and passed all required gates: Phase 0A `34749695923`, Phase 0B `34749695938`, and Playwright `34749696089` with 34/34 Chromium tests in 14.7s, Node `v22.23.2`, npm `10.9.8`, and 0 vulnerabilities. This roadmap update closes Phase 2 on the branch; exact-final-head CI remains mandatory before merge. Do not begin Phase 3 automatically.
- **13 Sep 2026:** Phase 2 completed. PR #14 was re-verified at exact head `f949407811e170da82052613905ba190fea8c29e` with exactly two changed files and all three required gates green (Phase 0A `34749816234`; Phase 0B `34749816250`; Playwright `34749816255`: 34/34 passed in 10.8s, Node `v22.23.2`, npm `10.9.8`, 0 vulnerabilities), then merged with an expected-head SHA guard. Verified signed new cleanup `main` at `97a17d87863cc8eb6c25263b57c139091c1e7189`, with parents `ee962e793b267e63938133b95df8e36a8439f37a` and `f949407811e170da82052613905ba190fea8c29e`. No runtime, backend, hosted Auth, Science, Netlify, production-data, or explicit production-promotion change was included. Phase 3 remains unstarted.
