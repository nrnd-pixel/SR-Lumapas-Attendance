# Phase 9 — Promotion and Rollback Readiness

**Checkpoint type:** documentation / QA analysis only  
**Verified GitHub main:** `0a40f93c5fb71ccd2d8a82c7e8567560746217d8`  
**Frozen cleaned-v1.0 runtime candidate:** `fe0b663846f361dc88514076c51d746fda05e5e0`  
**Verified package:** `phase8-pilot-package-fe0b6638`  
**Artifact ID:** `10943742839`  
**Artifact digest:** `sha256:ab625a7949ea8d68ccfb40c86732bd8d772bf79205a18f9d9f742721bc2e104b`  
**Prepared:** 29 September 2026

## Scope

This checkpoint does not change application runtime, DOM, RPCs, SQL, grants, RLS, SECURITY DEFINER functions, Auth configuration, Science objects, Netlify configuration, production data, or the protected production v0.7 site.

It closes the non-runtime release-readiness audit requested after Phase 8D2 and defines the Phase 9 promotion/rollback gate. The runtime candidate must remain frozen unless a genuine release blocker is found.

## Verified live/backend baseline

Fresh read-only Supabase verification on 29 September 2026 confirms:

- latest Attendance migration: `20260920100523 attendance_v20_enrolment_lifecycle_contract`;
- 15 active classes;
- 319 active pupils;
- 3A: 137 registers;
- 3A: 3,425 attendance records;
- 3A: 3,425 attendance audit rows;
- 0 corrected registers;
- authenticated access on reviewed core tables is SELECT-only after the Phase 5 write-boundary work;
- 50 Attendance RLS policies remain present;
- public Attendance function inventory is currently 21 functions: 18 SECURITY DEFINER and 3 SECURITY INVOKER.

The shared Supabase project also continues to contain Science objects. A Supabase table-list advisory flags four `private.science_*` tables with RLS disabled. This is outside the Attendance cleanup scope and must not be changed as part of Phase 9; it should remain a separately owned Science security review item.

## 68-test suite audit

The exact Phase 8D2 Playwright run `36355556660` passed **68/68** in 29.3s using one Chromium worker.

| Spec | Tests | Skip | Only | Expected-fail / Fixme | Explicit wait |
| --- | ---: | ---: | ---: | ---: | ---: |
| `admin-management.spec.mjs` | 11 | 0 | 0 | 0 | 0 |
| `attendance.spec.mjs` | 10 | 0 | 0 | 0 | 0 |
| `auth-access.spec.mjs` | 23 | 0 | 0 | 0 | 1 × 75 ms |
| `composition-root.spec.mjs` | 2 | 0 | 0 | 0 | 0 |
| `navigation.spec.mjs` | 1 | 0 | 0 | 0 | 0 |
| `reporting-population.spec.mjs` | 7 | 0 | 0 | 0 | 0 |
| `reporting.spec.mjs` | 12 | 0 | 0 | 0 | 0 |
| `ui-helpers.spec.mjs` | 2 | 0 | 0 | 0 | 0 |
| **Total** | **68** | **0** | **0** | **0** | **1** |

Playwright configuration is deterministic by default:

- `fullyParallel: false`;
- `workers: 1`;
- `retries: 0`;
- per-test timeout 20 seconds;
- expectation timeout 5 seconds;
- Chromium only;
- trace retained on failure and screenshot only on failure.

### Timing/flakiness review

The suite contains no test-level retry overrides, `.only`, skips, fixmes, expected failures, `networkidle` waits, or forced clicks.

The race regressions use the synthetic deferred-RPC harness plus `expect.poll()`; the three Phase 8D regressions do not rely on sleeps. Two admin race tests and the Check Approval race test use a double `requestAnimationFrame` only after a deferred response is deliberately released, to allow the browser render queue to settle before asserting that stale state did not overwrite the newer state.

One timing smell remains in `auth-access.spec.mjs`: the recovery-priority test schedules a synthetic `PASSWORD_RECOVERY` event after 25 ms and then waits 75 ms before re-asserting that the recovery screen still owns startup. It is not currently a release blocker because the test asserts the final state and has remained green, but replacing the fixed wait with a harness-observable event/condition is recommended in a later test-maintenance checkpoint.

## Coverage strengths

The browser suite directly covers the established release-critical contracts:

- login, signed-in refresh and sign-out;
- signup, email-verification return, Pending Approval, account-bound pending signup state and rejected-request correction;
- password recovery priority, confirmation mismatch, server weak-password handling, successful old/new-password transition, sign-out failure handling, and preserved teacher scope;
- class/admin access boundaries and zero-class behavior;
- first register save, Mark All Present, exception editing, no-change save, corrections, legacy codes, OTHER-note validation, non-school day protection and unsaved-change guards;
- Transfer In, Transfer Out and Move Class payload/history semantics;
- teacher approval/rejection and Attendance enable/disable;
- Student Management, Teacher Admin and Check Approval stale-response races;
- monthly statistics, missing-register safeguards, gender-incomplete warning, dashboard, Term/YTD reporting, population selection, report invalidation and CSV export;
- official 3A February and Term 1 fixtures;
- mobile horizontal-overflow smoke coverage;
- HTML escaping, class grouping and composition-root/navigation behavior;
- production Supabase traffic blocked by the synthetic harness.

## Coverage gaps / residual QA risk

These are not current release blockers by themselves, but Phase 9 should account for them:

1. **Hosted exact-candidate validation is incomplete.** The separate pilot still runs old runtime `dc8e29bb…`. Because Netlify credits are exhausted, the exact `fe0b663…` package has not been redeployed or hosted-revalidated. Phase 8C genuine attendance must not be performed on the old pilot.
2. **Browser matrix is Chromium-only.** There is a mobile viewport smoke test, but no Firefox/WebKit project and no real iOS/Android browser/device matrix.
3. **Browser tests use a synthetic Supabase/Auth harness.** This is intentional and protects production, but hosted Auth redirects, real network policy/CSP behavior, and real RPC/backend integration still require the Phase 8/Phase 9 hosted and live-read-only gates.
4. **No production correction exists.** Production has 0 corrected registers, so correction UPDATE/audit semantics remain proven by synthetic/local DB/browser fixtures rather than a live historical correction.
5. **Gender remains incomplete for many pupils.** This is a known data-quality exception and must not be inferred or silently repaired during release.
6. **Shared-project Science security advisory remains outside scope.** Do not mix Science remediation into Attendance promotion.

## CI and hard-gate audit

Current repository workflows:

| Workflow | PR trigger | Path-filtered | Manual dispatch | Main purpose |
| --- | --- | --- | --- | --- |
| Phase 0A Integrity | Yes | No | Yes | frozen baseline, modularisation history and current frontend integrity |
| Phase 0B Backend Contract | Yes | No | Yes | repository backend-source/API contract |
| Phase 1 Playwright | Yes | No | Yes | 68-test Chromium regression suite |
| Phase 4B1V Local DB Validation | Yes | **Yes** | Yes | reporting/database reconstruction and equivalence |
| Phase 5A Security Access Validation | Yes | **Yes** | Yes | local security/write-boundary/access contracts through v20 |
| Phase 7B Historical v16 Boundary | Yes | **Yes** | Yes | historical reporting/security boundary preservation |
| Phase 8 Pilot Package | Yes | **Yes** | Yes | exact frozen runtime package assembly only |

All third-party GitHub Actions currently used by these workflows are pinned to immutable commit SHAs. The Phase 8 package workflow has `contents: read` only, no Supabase/Netlify secrets and no deploy step.

### Important Phase 9 CI implication

Phase 4B1V, Phase 5A, Phase 7B and Phase 8 package workflows are path-filtered. A promotion-only or documentation-only PR can therefore be green without automatically running every database/security hard gate.

For Phase 9, do **not** infer full hard-gate coverage from ordinary PR checks. Before promotion, manually dispatch the path-filtered database/security workflows against the exact promotion candidate SHA/ref and record the successful run IDs. If the promotion ref cannot be selected directly by workflow_dispatch, create a release branch pinned to the exact candidate and dispatch against that branch without changing runtime bytes.

## Runtime ownership and large/dormant module audit

The cleaned frontend contains 16 JavaScript modules. The largest active modules are:

| Module | Approx. bytes | Lines | Ownership |
| --- | ---: | ---: | --- |
| `attendance-register.js` | 12,021 | 233 | register load/edit/save/correction |
| `period-reports.js` | 9,627 | 129 | Term/YTD report rendering/export |
| `student-management.js` | 7,113 | 74 | roster and pupil movements |
| `teacher-access.js` | 7,024 | 139 | signup/gate/access routing |
| `main.js` | 5,426 | 111 | composition root / wiring |
| `admin-dashboard.js` | 4,933 | 63 | school dashboard |
| `teacher-admin.js` | 4,731 | 53 | teacher approval/access admin |
| `statistics.js` | 4,297 | 46 | monthly statistics |

No dormant runtime JavaScript module was found in the current 16-module tree: `main.js` imports all feature boundaries directly or through the active navigation/bootstrap graph, and every non-root module has at least one active inbound import. There is therefore no release-readiness benefit in deleting or merging modules before promotion.

The largest module, `attendance-register.js`, is still modest at 233 lines and has dedicated browser coverage for its critical correction and eligibility behavior. Further splitting before Phase 9 would add risk without a concrete release benefit.

## Release-readiness classification

### Immediate

- **Phase 8 hosted-exact-candidate gate is incomplete.** The frozen candidate is packaged and verified but not deployed to the pilot because Netlify credits are exhausted.
- **Phase 9 is not yet authorized.** Promotion must remain blocked until the exact-candidate hosted requirement is either completed as designed or the user explicitly approves a documented release-plan change after reviewing the risk.
- **Full hard-gate execution must be explicit.** The path-filtered local DB/security workflows must be manually dispatched on the exact promotion candidate before production promotion.

### Medium-term

- replace the single fixed 75 ms recovery-test wait with a harness-observable condition;
- consider Firefox/WebKit or real-device smoke coverage if broader browser support becomes an operational requirement;
- maintain review of the public Attendance SECURITY DEFINER surface as migrations evolve;
- keep runtime CDN/inline-style CSP/reproducibility debt separate from release promotion unless it becomes a concrete blocker.

### Low-priority / no action before Phase 9

- no current runtime module is dormant;
- no large-module refactor is justified before promotion;
- incomplete pupil gender data remains an explicitly known data-quality item;
- Science security findings belong to a separate Science-owned review and must not be altered in the Attendance release.

# Phase 9 promotion checklist

## A. Freeze and identify the promotion candidate

- [ ] Confirm GitHub `main` SHA and record it.
- [ ] Confirm runtime candidate remains exactly `fe0b663846f361dc88514076c51d746fda05e5e0`, unless a separately approved release-blocker fix created a new candidate.
- [ ] Confirm no runtime file changed after the candidate without a new full 68-test and hard-gate cycle.
- [ ] Confirm the exact package artifact ID/digest and that the artifact has not expired.
- [ ] Review `git diff`/compare from protected v0.7 source checkpoint to cleaned v1.0 candidate and confirm every intended behavior change is documented.
- [ ] Confirm production Netlify project is still not Git-linked and no automatic deploy path can bypass the approval gate.

## B. Complete Phase 8 exit evidence

- [ ] Deploy the exact frozen candidate package to a separate pilot/staging site—not production.
- [ ] Record the exact deployed SHA/package digest.
- [ ] Re-run hosted login and password recovery against the exact candidate.
- [ ] Re-exercise Student Management refresh, Teacher Admin refresh, and Check Approval race-sensitive surfaces.
- [ ] Run Stage 8A read-only smoke on representative admin/teacher/mobile flows.
- [ ] Perform Phase 8C genuine attendance only on the exact candidate and only for real school operations.
- [ ] Confirm no unexplained reporting, access, performance or data-history difference.
- [ ] Record pilot feedback and unresolved issues.
- [ ] Confirm Phase 8 exit is explicitly approved.

## C. Re-run exact-candidate automated gates

- [ ] Phase 0A Integrity — PASS.
- [ ] Phase 0B Backend Contract — PASS.
- [ ] Phase 1 Playwright — **68/68 PASS**, retries 0, no skipped/only/fixme/expected-fail tests.
- [ ] Phase 4B1V Local DB Validation — manually dispatch on the exact candidate and PASS.
- [ ] Phase 5A Security Access Validation — manually dispatch on the exact candidate and PASS.
- [ ] Phase 7B Historical v16 Boundary — manually dispatch on the exact candidate and PASS.
- [ ] Re-run any release/package workflow needed to prove the exact deploy payload.
- [ ] Record run IDs, exact head SHA and any artifact digest in the release record.

## D. Re-verify production backend immediately before promotion

Read-only only:

- [ ] latest Attendance migration remains v20 `20260920100523`;
- [ ] 15 active classes;
- [ ] 319 active pupils;
- [ ] 3A = 137 registers / 3,425 attendance records / 3,425 audit rows;
- [ ] 0 corrected registers unless a genuine correction occurred after this checkpoint;
- [ ] no unexpected Attendance migration appeared;
- [ ] protected reporting fixtures remain exact where the current date/data state allows direct comparison;
- [ ] no unexplained grant/RLS/SECURITY DEFINER drift;
- [ ] Science objects are not changed by the Attendance release.

If any count legitimately changes because of real school operations, reconcile and document the change rather than forcing the old number.

## E. Rollback readiness before touching production

- [ ] Identify the current production v0.7 Netlify deploy as the rollback target and record its deploy identifier/date.
- [ ] Verify the production project can republish/restore that exact previous deploy or an independently preserved v0.7 package.
- [ ] Confirm rollback requires no DB rollback because the promotion is frontend-only against already-live Attendance v20.
- [ ] Confirm any genuine attendance writes made after promotion must be preserved; rollback must not delete valid operational history.
- [ ] Keep production Auth Site URL/redirect unchanged unless a separately approved release step requires modification.
- [ ] Define rollback triggers: login/recovery failure, class-scope leak, register save/correction failure, missing-register/reporting regression, unexpected production requests/errors, or major mobile usability failure.
- [ ] Ensure the person performing promotion has access to Netlify and the previous production deploy before starting.

## F. Production promotion

Only after explicit user approval:

- [ ] Verify the exact production upload is byte-identical to the approved release package.
- [ ] Manually promote/deploy to the protected production site.
- [ ] Do not link the repository or enable continuous deployment as part of this release unless separately approved.
- [ ] Record production deployment identifier/time and exact candidate SHA/package digest.

## G. Immediate post-promotion smoke

Use read-only checks first:

- [ ] production login;
- [ ] signed-in refresh;
- [ ] teacher class scope;
- [ ] admin class scope/tabs;
- [ ] monthly statistics;
- [ ] dashboard;
- [ ] Term/YTD report;
- [ ] CSV export;
- [ ] mobile layout;
- [ ] Forgot Password → Set New Password remains stable.

Then, during normal genuine school use:

- [ ] first real attendance load/save behaves normally;
- [ ] no false correction is offered for unchanged saved registers;
- [ ] any genuine correction requires a reason and preserves audit semantics;
- [ ] missing registers remain missing—not zero attendance.

## H. Rollback if a release blocker appears

- [ ] Stop further promotion/testing writes.
- [ ] Republish/restore the recorded v0.7 production deploy/package.
- [ ] Do not roll back Attendance v20 database migrations solely because the frontend is rolled back; v0.7 already operates against the live backend boundary.
- [ ] Preserve all genuine operational attendance/history written during the incident window.
- [ ] Re-run production login/read-only reporting smoke on restored v0.7.
- [ ] Record the defect, exact failing production SHA/deploy, rollback deploy and affected workflows.
- [ ] Fix only in a new focused branch/PR; require browser regression coverage and full release gates before another promotion attempt.

## Current decision

**Not ready for Phase 9 promotion yet.** The repository/runtime candidate and package are technically well defined, the 68-test suite is clean, and no new runtime-code blocker was found in this audit. The remaining release gate is operational: the exact `fe0b663…` candidate has not been refreshed on the hosted pilot because Netlify credits are exhausted, so Phase 8 exit evidence is incomplete.

Do not use the old `dc8e29bb…` pilot for Phase 8C genuine attendance and do not promote production until the exact-candidate pilot/release gate is resolved and explicit approval is given.
