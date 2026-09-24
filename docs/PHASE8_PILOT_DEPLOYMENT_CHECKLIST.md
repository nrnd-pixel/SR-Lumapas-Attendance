# Phase 8 — Cleaned v1.0 Pilot Deployment Checklist

**Date:** 25 Sep 2026  
**Signed source `main`:** `dc8e29bbf727c1d4dacf9ad7986e28f450b75718`  
**Exact pilot branch:** `pilot/phase-8-cleaned-v1-preview`  
**Pilot branch SHA:** `dc8e29bbf727c1d4dacf9ad7986e28f450b75718`  
**Branch drift:** 0 commits ahead / 0 behind; zero changed files.

## Purpose

Phase 8 is a controlled pilot of the cleaned v1.0 frontend against the already-reviewed production Attendance backend.

The pilot is **not** production promotion.

Protected production v0.7 at `https://srlumapas.netlify.app/` must remain available and unchanged throughout the pilot.

## Pilot deployment boundary

Allowed for Phase 8 pilot:

- deploy the exact pilot branch/SHA to a separate preview/staging Netlify site;
- add only the exact pilot origin to the Supabase Auth Redirect URLs if required for hosted signup/recovery validation;
- use existing production Attendance RPCs and Auth;
- perform read-only navigation/reporting checks;
- perform no-change register saves;
- perform genuine real-world attendance operations by designated users during normal school activity;
- collect user/device feedback.

Not allowed without a separate explicit approval:

- replacing or relinking the production v0.7 site;
- applying a new Supabase migration;
- changing Attendance RPC/table/grant/RLS/policy/trigger definitions;
- changing Science objects;
- changing SMTP, CAPTCHA, password policy, secure-password/current-password settings, or leaked-password protection;
- synthetic pupil transfers, corrections, teacher approvals, or attendance writes merely for test data;
- committing production exports, real pupil datasets, teacher credentials, service-role keys, DB passwords, or private tokens.

## Exact source gate before deployment

Before creating the preview deployment:

1. confirm GitHub `main` still equals `dc8e29bbf727c1d4dacf9ad7986e28f450b75718` or explicitly record any later docs-only main advancement;
2. confirm `pilot/phase-8-cleaned-v1-preview` still points to `dc8e29bbf727c1d4dacf9ad7986e28f450b75718`;
3. compare pilot branch to the signed source and require zero changed runtime/backend files;
4. retain the existing `netlify.toml` unchanged unless a separately reviewed deployment-only change becomes necessary;
5. rerun exact-head integrity, backend-contract and Playwright checks if the pilot branch SHA changes.

## Current runtime/API contract to preserve

Frontend:

- static vanilla JS;
- 171 unique DOM IDs;
- zero duplicate IDs;
- one same-origin application module loader;
- no direct browser table `.from(...)` access;
- Browser → Auth/RPC → Attendance schema boundary.

Production Attendance backend:

- latest Attendance migration: `20260920100523 attendance_v20_enrolment_lifecycle_contract`;
- 21 public Attendance RPCs;
- 18 SECURITY DEFINER / 3 SECURITY INVOKER;
- all exposed DEFINER functions retain fixed empty `search_path`;
- zero authenticated direct-write Attendance tables.

Protected live fingerprint at Phase 8 preflight:

- 15 active classes;
- 319 active pupils;
- 319 current enrolments;
- 0 ended enrolments;
- 0 student-movement rows;
- 3A = 137 registers / 3,425 attendance records;
- attendance audit = 3,425 rows;
- 0 corrected registers;
- 0 audit UPDATE rows;
- 0 audit DELETE rows;
- Feb 2026 Whole Class = 398 / 425 = 0.9365 = 93.65%, 17 completed, 0 missing;
- Term 1 Whole Class = 1,051 / 1,125 = 0.9342 = 93.42%, 45 completed, 0 missing.

## Auth redirect prerequisite

Current cleanup frontend uses the running page origin for:

- forgot-password recovery: `window.location.origin + '/'`;
- teacher signup email confirmation: `window.location.origin + '/'`.

Recorded hosted Auth configuration currently allows production under:

`https://srlumapas.netlify.app/**`

Therefore a separate pilot hostname will require that **exact pilot origin** to be added to Supabase Auth Redirect URLs before real hosted signup/recovery can be validated there.

After Netlify assigns the stable pilot project hostname, add only this exact redirect entry:

`https://<pilot-site>.netlify.app/`

The current frontend always requests the site root as `redirectTo`, so a broad Netlify wildcard is not required for this manual pilot. Use the pilot project's stable primary `.netlify.app` URL for hosted Auth testing rather than ephemeral deploy-specific URLs.

Rules:

- do not replace the production Site URL;
- do not remove the production redirect;
- add only the exact pilot root URL shown above after the real hostname is known;
- capture the pre-change Auth redirect state;
- verify the post-change state;
- remove the pilot redirect after pilot rollback/closure if no longer needed.

The connected Supabase tools do not currently provide an authoritative hosted Auth-config read/write surface for this setting, so Dashboard evidence is required.

## Manual deployment package

Do **not** drag the whole GitHub repository into Netlify.

The signed pilot source root also contains `.github/`, `docs/`, `supabase/`, `tests/`, README files, and the cleanup roadmap. Those files are not needed by the browser runtime and should not be published by the pilot site.

Create a **minimal pre-built pilot folder** from exact pilot SHA `dc8e29bbf727c1d4dacf9ad7986e28f450b75718` containing only:

- `index.html` — exact blob from the pilot SHA;
- `assets/js/` — all 15 JavaScript modules, exact blobs from the pilot SHA;
- `_headers` — deployment-only Netlify header file reproducing the current `netlify.toml` header policy.

The deployment-only `_headers` file should be:

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Cache-Control: no-store
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://rojetehazryfpcxlwtbi.supabase.co wss://rojetehazryfpcxlwtbi.supabase.co https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';
```

Why this packaging is preferred:

- it preserves the exact application/runtime bytes from the reviewed pilot SHA;
- it avoids publishing repository-only QA, SQL, docs and CI material;
- it avoids Git linkage/continuous deployment;
- it preserves the existing response-header policy through Netlify's publish-directory `_headers` mechanism;
- it keeps rollback operational: the pilot project can be disabled/ignored without touching production v0.7.

Before upload, verify the runtime-file hashes/blobs against the pilot SHA and record the package manifest. The generated `_headers` file is a deployment artifact, not a runtime-source change and should not be committed to the pilot branch unless later design explicitly chooses to do so.

## Netlify prerequisite

Most recent authoritative Dashboard evidence recorded in the roadmap states the production site is **not Git-linked**.

Before deployment, confirm in Netlify that:

- the production site remains unlinked from GitHub;
- the new pilot site is a separate site/project created by **Deploy manually / drag and drop**, not by linking this Git repository;
- the upload is the minimal pre-built package described above;
- the pilot site receives its own `.netlify.app` hostname;
- no production domain/alias points to the pilot;
- no automatic production deployment is enabled.

Within the separate pilot Netlify project, a manual upload is that pilot project's published deploy. That is acceptable because the project itself is the staging boundary; it must never carry the production `srlumapas.netlify.app` domain.

No assumption about current Netlify account-level linkage should be made from repository state alone.

## Pilot rollout sequence

### Stage 8A — Deployment smoke/read-only

Use the separate pilot URL.

Verify:

- page loads without console-blocking CSP/network errors;
- normal admin login;
- normal teacher login;
- sign-out;
- class list and assigned-class restriction;
- Attendance panel loads;
- Dashboard loads;
- Monthly Statistics loads;
- Term/YTD Reports load;
- Whole-Class and Non-SEN population switching;
- CSV generation;
- mobile layout at representative phone widths;
- no-change attendance save returns safely without changing history.

Stop on any unexplained difference.

### Stage 8B — Hosted Auth flows

Only after the exact pilot origin is allow-listed.

Verify:

- forgot-password email is generated from the pilot;
- recovery link returns to the pilot origin;
- Set New Password remains visible and is not pre-empted by normal startup routing;
- mismatched confirmation is rejected locally;
- successful recovery updates the password;
- recovery session is signed out;
- user must complete a normal sign-in afterward;
- teacher signup email confirmation returns to the pilot origin;
- pending signup state remains tied to the correct Auth user.

Do not alter the production Site URL or password-policy settings for these tests.

### Stage 8C — Limited real operational pilot

Use only genuine school operations.

Representative users:

- admin;
- at least two teachers from different year levels/classes where practical.

Verify during normal work:

- register load;
- mobile marking;
- save;
- no-change resave;
- class restriction;
- existing missing-register safeguards;
- reporting refresh after legitimate saves;
- practical latency/performance.

Do **not** fabricate correction, transfer, or teacher-management events solely to test them.

If a genuine correction/transfer/approval occurs during the pilot, verify its intended audit/history behavior and record sanitized evidence only.

### Stage 8D — Known async-risk stress checks

These three inherited risks were not silently fixed and must be exercised manually:

1. rapidly refresh/re-enter Student Management so an older `attendance_admin_student_roster` response cannot visibly replace newer state;
2. rapidly refresh/re-enter Teacher Admin around approval/enable-disable activity so older results do not visibly overwrite newer state;
3. repeatedly trigger Check Approval / access checks and confirm an older unauthorized response does not visibly replace a newer authorized app state.

Any reproducible stale-state issue is a pilot finding and must be corrected in a separate focused Phase 8 branch/PR before promotion.

## Evidence to collect

Record only sanitized evidence:

- exact deployed source SHA;
- pilot hostname;
- test date/device/browser;
- user role/class context without credentials;
- pass/fail per pilot scenario;
- console/network errors where relevant, with secrets/tokens removed;
- sanitized aggregate/report result checks;
- any defect reproduction steps;
- rollback action if used.

Never capture or commit:

- access/refresh tokens;
- passwords/PINs;
- service-role keys;
- DB passwords;
- real pupil exports;
- teacher credentials.

## Stop conditions

Stop pilot progression immediately if any of the following occurs:

- pilot source SHA differs unexpectedly;
- production v0.7 is modified or becomes unavailable;
- a new Supabase migration appears unexpectedly;
- protected roster/history/report fixtures drift without an explained real-world operation;
- recovery routes away from Set New Password;
- class authorization is bypassed;
- missing registers are treated as zero attendance;
- audit/history semantics are broken;
- Science objects are unexpectedly changed;
- pilot hostname receives production-domain traffic;
- secret/private data is exposed in logs/repository.

## Rollback

### Frontend/pilot rollback

- disable/delete/ignore the separate pilot site;
- remove any pilot domain alias;
- keep production v0.7 unchanged.

### Auth redirect rollback

- remove only the added pilot redirect entry;
- retain production Site URL and production redirect.

### Backend rollback

No backend change is planned for Phase 8 pilot setup or deployment.

If no backend change occurs, no DB rollback is required.

If a genuine operational write occurred during the pilot, preserve it according to normal attendance/history semantics rather than deleting it simply because the pilot ends.

## Phase 8 exit criteria

Phase 8 is complete only when:

- exact deployed SHA is known;
- representative admin + multi-class teacher pilot is completed;
- recovery flow works on the hosted pilot;
- normal attendance/reporting works on real devices;
- no unexplained protected-fixture drift exists;
- known async-risk areas are exercised;
- all pilot defects are either fixed and re-piloted or explicitly accepted before Phase 9;
- rollback remains clear;
- user explicitly approves moving to Phase 9.

**Current status:** repository setup prepared; deployment has not started.
