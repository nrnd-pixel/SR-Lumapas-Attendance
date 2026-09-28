# Phase 9 Promotion Readiness Checklist

**Date:** 29 Sep 2026  
**Status:** preflight planning only; Phase 9 is **not authorized** and production v0.7 must remain unchanged until Phase 8 exit criteria are satisfied and explicit promotion approval is given.

## 1. Evidence classification

### Repository evidence
- cleanup repository: `nrnd-pixel/SR-Lumapas-Attendance`;
- current repository `main` at this preflight: `0a40f93c5fb71ccd2d8a82c7e8567560746217d8`;
- frozen runtime/release candidate: `fe0b663846f361dc88514076c51d746fda05e5e0`;
- all 17 runtime blobs on current `main` are byte-identical to the frozen `fe0b6638…` runtime;
- verified package artifact: `phase8-pilot-package-fe0b6638`;
- artifact ID: `10943742839`;
- artifact digest: `sha256:ab625a7949ea8d68ccfb40c86732bd8d772bf79205a18f9d9f742721bc2e104b`.

### Live-system evidence
- Attendance migration ledger currently ends at `20260920100523 attendance_v20_enrolment_lifecycle_contract`;
- current read-only fingerprint at this preflight: 15 active classes / 319 active pupils / 319 active enrolments / 0 movement rows / 137 registers / 3,425 attendance records / 3,425 private attendance-audit rows / 0 corrected registers;
- authenticated direct table privileges are SELECT-only across Attendance tables;
- the frontend's 21 Attendance RPC names all exist live;
- live execution boundary for those 21 RPCs is 18 `SECURITY DEFINER` + 3 invoker; only `attendance_signup_options()` is anonymous;
- `attendance_private.attendance_record_audit` remains RLS-disabled but `anon` and `authenticated` lack private-schema USAGE and table SELECT; this remains a known defense-in-depth residual rather than browser exposure.

### User-provided operational evidence
- the Netlify team has exhausted available credits and the refreshed pilot cannot currently be redeployed;
- the production and pilot Netlify projects were previously reported as separate projects;
- production project `srlumapas` was previously shown as not Git-linked;
- the exact pilot origin had previously been added to Supabase Auth Redirect URLs and hosted password recovery passed on the older pilot runtime.

Do not silently promote any user-provided operational fact to current machine-verified evidence. Reconfirm it at the relevant release gate.

## 2. Frozen release candidate

The runtime candidate is intentionally frozen at:

`fe0b663846f361dc88514076c51d746fda05e5e0`

Do not change runtime source while hosting is blocked unless a genuine release blocker is found.

Runtime ownership remains:

- `index.html`;
- 16 JavaScript modules under `assets/js/`;
- no direct browser `.from(...)` table access;
- Browser → controlled RPC → Attendance tables remains the application boundary.

Largest active runtime modules at this checkpoint:

- `attendance-register.js` — about 12 KB;
- `period-reports.js` — about 9.7 KB;
- `student-management.js` — about 7.1 KB;
- `teacher-access.js` — about 7.0 KB.

All 16 runtime modules are part of the active dependency closure; no dormant runtime module was identified.

## 3. Automated QA state

Current Playwright suite:

- 68 tests total;
- 0 skipped tests;
- 0 `fixme` tests;
- 0 focused `.only` tests;
- retries = 0;
- single-worker deterministic Chromium execution;
- one narrow fixed 75 ms wait remains in the synthetic delayed password-recovery event test;
- all other async-race tests use deterministic deferred-RPC control rather than timing sleeps.

Current automated browser matrix is **Desktop Chrome only**. This is not a substitute for the hosted/mobile Phase 8 checks.

The latest fixed-runtime exact-head evidence includes:

- Phase 0A Integrity — PASS;
- Phase 0B Backend Contract — PASS;
- Phase 1 Playwright — 68/68 PASS;
- package-builder verification — PASS.

Repository guardrail note:

- GitHub currently has no repository rulesets;
- therefore explicit branch/PR discipline, exact-head verification, and user merge approval remain required operational controls;
- do not merge or promote directly from an unverified local or branch state.

## 4. Frontend ↔ backend contract

The frontend currently uses 21 Attendance RPC names.

All 21 are present in repository SQL and live:

- baseline repository SQL owns the original 18 RPCs;
- v13 repository SQL owns `attendance_monthly_class_stats_v2`, `attendance_admin_school_dashboard_v2`, and `attendance_class_period_report_v2`.

Before promotion, rerun the repository contract gates and verify no frontend RPC has appeared without matching repository SQL.

## 5. Known non-blocking residuals

These do not authorize delay-free promotion; they must remain visible in the release record:

- Security Advisor: 2 RLS-enabled/no-policy INFO findings;
- Security Advisor: 4 anonymous `SECURITY DEFINER` warnings, only one belonging to Attendance (`attendance_signup_options`);
- Security Advisor: authenticated `SECURITY DEFINER` warnings for the intended controlled Attendance RPC surface;
- leaked-password protection unavailable/disabled on the current Free-plan setup;
- `attendance_private.attendance_record_audit` RLS-disabled but privilege-isolated;
- 294 active pupils still have unknown gender;
- main branch has no rulesets.

Do not mix unrelated security redesign, gender cleanup, or feature work into the production promotion checkpoint.

## 6. Phase 8 blockers that must clear before Phase 9

Phase 9 cannot begin until all of the following are true:

1. **Refreshed pilot hosted**
   - exact `fe0b6638…` package is deployed to the separate pilot site;
   - pilot hostname remains distinct from production;
   - production v0.7 remains available and unchanged.

2. **Hosted auth revalidation**
   - normal admin login works;
   - normal teacher login works;
   - password recovery returns to the pilot;
   - Set New Password keeps startup priority;
   - confirmation mismatch is rejected;
   - successful reset signs out the recovery session;
   - normal sign-in is required afterward.

3. **Hosted async-fix revalidation**
   - Student Management stale-response behavior does not regress;
   - Teacher Admin stale-response behavior does not regress;
   - Check Approval/access routing does not regress when a genuine applicable account state exists.

4. **Hosted read-only smoke**
   - Attendance panel loads existing saved registers;
   - Dashboard loads;
   - Monthly Statistics loads;
   - Whole-Class / Non-SEN switch works;
   - Term/YTD reports load;
   - CSV generation works;
   - mobile layout is usable on a real device or representative phone viewport.

5. **Phase 8C genuine operational pilot**
   - genuine school-day register load/save is completed through the refreshed pilot;
   - no-change re-save is safe;
   - teacher class restriction remains correct;
   - missing-register safeguards remain correct;
   - reporting refresh reflects legitimate saves;
   - no fabricated correction, transfer, approval, or attendance operation is used solely to satisfy QA.

6. **Protected fixtures remain exact**
   - 3A Feb Whole Class: `398/425 = 0.9365 = 93.65%`;
   - 3A Feb Non-SEN: `392/408 = 0.9608 = 96.08%`;
   - 3A Term 1 Whole Class: `1051/1125 = 0.9342 = 93.42%`;
   - 3A Term 1 Non-SEN: `1036/1080 = 0.9593 = 95.93%`;
   - missing registers are never zero attendance.

7. **Explicit user approval**
   - Phase 9 production promotion must be separately and explicitly approved after all evidence above is reviewed.

## 7. Production-promotion preflight

Immediately before promotion, collect a fresh read-only fingerprint:

- current `main` SHA;
- exact release-candidate runtime SHA;
- exact package artifact ID/digest;
- latest live Attendance migration;
- active class/pupil/enrolment/movement counts;
- register/record/audit counts;
- corrected-register count;
- protected 3A report fixtures;
- Security Advisor summary;
- Attendance function/grant/RLS boundary;
- Science object/migration state sufficient to prove no Attendance release drift touched Science.

Reconfirm the production Netlify project before upload:

- project name is `srlumapas`, not the pilot;
- production hostname is `https://srlumapas.netlify.app/`;
- Git-linked auto-deploy state has not changed unexpectedly;
- the previous production deploy remains available as a rollback target;
- no unrelated production-domain alias points at the pilot.

If the previous v0.7 deploy cannot be confirmed as restorable, STOP. Do not promote.

## 8. Production package identity

Use an exact verified runtime package only.

At the current preflight, the intended candidate is:

- runtime source: `fe0b663846f361dc88514076c51d746fda05e5e0`;
- artifact: `phase8-pilot-package-fe0b6638`;
- artifact ID: `10943742839`;
- digest: `sha256:ab625a7949ea8d68ccfb40c86732bd8d772bf79205a18f9d9f742721bc2e104b`.

If runtime bytes change after this checklist, this identity becomes stale and a new package/hash/QA cycle is required.

## 9. Required CI/hard gates before production

Rerun and require success on the exact release candidate / promotion branch state:

- Phase 0A Integrity;
- Phase 0B Backend Contract;
- Phase 1 Playwright;
- Phase 4B1V local reporting DB validation;
- Phase 5A security/access validation;
- Phase 7B historical v16 boundary;
- Phase 8 package verification.

Never weaken assertions, skip failing checks, or treat an old green run as proof for changed runtime bytes.

## 10. Production deployment stop conditions

Stop immediately if any of these appears before or after promotion:

- wrong Netlify project selected;
- exact package identity cannot be verified;
- production v0.7 rollback target cannot be confirmed;
- unexpected Supabase migration;
- production or pilot hostname mismatch;
- recovery routes away from Set New Password;
- teacher class authorization is bypassed;
- attendance history count changes without a legitimate school operation;
- missing register is displayed/calculated as zero attendance;
- protected reporting fixture changes unexpectedly;
- Science migration/object drift is detected;
- secret/private data appears in logs or repository;
- browser console/network failure prevents core app use.

## 11. Post-promotion smoke

Immediately after production replacement:

1. open production in a fresh/incognito browser;
2. verify login page;
3. admin normal login;
4. teacher normal login and class restriction;
5. load an existing saved register read-only;
6. verify Dashboard and Monthly Statistics;
7. verify Whole-Class and Non-SEN populations;
8. verify Term 1 3A protected fixture;
9. verify CSV generation;
10. verify sign-out / sign-in;
11. run password recovery on production only if explicitly included in the promotion smoke and operationally safe;
12. re-query backend fingerprint and explain every legitimate difference.

Do not fabricate attendance/correction/admin writes for smoke testing.

## 12. Rollback

Primary frontend rollback:

- restore the immediately previous verified Netlify production deploy for `srlumapas`;
- do not alter Supabase tables merely to roll back frontend bytes;
- preserve genuine attendance operations already written through controlled RPCs.

Backend rollback:

- none is expected for Phase 9 because the current release candidate introduces no new database migration;
- if the live backend changes before promotion, stop and re-plan rather than assuming this rollback statement still applies.

Auth rollback:

- do not remove the production Site URL or production redirect;
- pilot redirect cleanup, if desired, is a separate post-promotion operation after the pilot is retired.

## 13. Post-success closure

Only after production has remained stable and evidence is reviewed:

- record exact deployed runtime SHA and Netlify deploy identity;
- record post-promotion live fingerprint;
- update this checklist and the cleanup roadmap;
- optionally create a signed GitHub release/tag for the cleaned v1.0 production baseline;
- retire or clearly mark the pilot;
- only then move to Phase 10 feature development after separate approval.

## Current decision

**Do not promote yet.**

The current blocker is operational, not repository correctness: the refreshed `fe0b6638…` pilot package is verified, but Netlify credits currently prevent hosted redeployment and therefore prevent completion of hosted Phase 8 revalidation and Phase 8C.
