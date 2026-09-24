# Phase 7C — Live Read-only Equivalence Seal

**Date:** 24 Sep 2026  
**Repository checkpoint:** `71ba744fc23598e11bf98b4efc028c52cc185162`  
**Scope:** Production Attendance read-only verification only. No writes, no Auth changes, no Science changes, no Netlify changes.

## Evidence classification

- **Repository evidence:** `docs/PHASE7_EQUIVALENCE_CONTRACT.md`, `supabase/verify/attendance_contract.sql`, and `supabase/verify/attendance_fk_index_v19_contract.sql` from the signed repository checkpoint above.
- **Live-system evidence:** Supabase migration ledger, PostgreSQL catalog metadata, sanitized Attendance aggregates/reporting outputs, table/function privilege checks, lifecycle constraint state, trigger/policy inventory, and Security Advisor results.
- **Inference:** limited to comparing live results with the frozen repository contract. No production behavior was inferred from names or private pupil data.

## Live migration seal

Latest Attendance migration remains:

`20260920100523 attendance_v20_enrolment_lifecycle_contract`

No newer Attendance migration is present.

## Protected aggregate/history seal

Sanitized live aggregates remain exactly:

- 15 active classes.
- 319 active pupils.
- 319 current enrolments.
- 0 ended enrolments.
- 0 student-movement rows.
- 294 active pupils with unknown gender — unchanged Phase 6C known data-quality exception.
- Class 3A: 137 registers / 3,425 attendance records.
- Attendance audit: 3,425 rows.
- 0 corrected registers.
- correction-count sum = 0.
- 0 audit UPDATE rows.
- 0 audit DELETE rows.

No pupil names, identifiers, credentials, or production exports are recorded here.

## Protected reporting fixtures

### 3A February 2026 — Whole Class

- cumulative attendance: 398
- possible attendance: 425
- average ratio: 0.9365
- attendance percentage: 93.65%
- completed registers: 17
- missing registers: 0

### 3A February 2026 — Non-SEN

- cumulative attendance: 392
- possible attendance: 408
- average ratio: 0.9608
- attendance percentage: 96.08%
- completed registers: 17
- missing registers: 0

### 3A Term 1 2026 — Whole Class

- cumulative attendance: 1,051
- possible attendance: 1,125
- average ratio: 0.9342
- attendance percentage: 93.42%
- completed registers: 45
- missing registers: 0

### 3A Term 1 2026 — Non-SEN

- cumulative attendance: 1,036
- possible attendance: 1,080
- average ratio: 0.9593
- attendance percentage: 95.93%
- completed registers: 45
- missing registers: 0

Missing registers remain distinct from zero attendance.

## Repository/live contract cross-check

The repository's non-mutating `supabase/verify/attendance_contract.sql` was executed directly against production and returned **zero mismatch rows**.

The read-only `supabase/verify/attendance_fk_index_v19_contract.sql` was also executed against production and returned **zero uncovered foreign-key rows**.

## Public RPC/API seal

Production exposes exactly 21 public Attendance RPCs with the frozen signatures and JSONB return types.

Security modes remain:

- 18 `SECURITY DEFINER`
- 3 `SECURITY INVOKER`

For every exposed `SECURITY DEFINER` Attendance RPC:

- fixed empty `search_path` remains present;
- `authenticated` EXECUTE remains present;
- `service_role` EXECUTE remains present;
- no PUBLIC EXECUTE exists.

Only `attendance_signup_options()` remains executable by `anon`, as intentionally frozen.

## Table grants / RLS / policies / triggers

- Authenticated direct INSERT/UPDATE/DELETE remains revoked across the protected Attendance write boundaries verified by the repository contract.
- The frozen RLS-enabled table set matches production.
- Policy inventory matches the expected Attendance contract.
- Relevant Attendance triggers remain present, including `attendance_record_audit`, record/register stamping, enrolment/student/class/term/settings/school touch triggers, and teacher membership/assignment touch triggers.
- The v20 enrolment lifecycle CHECK `attendance_enrolments_lifecycle_status_check` exists and is validated.
- Live lifecycle-shape mismatches: 0.

## Private audit-table residual design note

`attendance_private.attendance_record_audit` has RLS disabled. This is not new drift: the frozen contract intentionally excludes it from the RLS-enabled set and instead requires privilege isolation.

Fresh live checks confirm:

- `anon` has no `attendance_private` schema USAGE;
- `authenticated` has no `attendance_private` schema USAGE;
- PUBLIC has no `attendance_private` schema USAGE;
- neither `anon` nor `authenticated` has SELECT/INSERT/UPDATE/DELETE on `attendance_private.attendance_record_audit`.

This therefore matches the frozen Phase 7 contract, but remains a consciously retained defense-in-depth residual risk. Phase 7C does not alter it.

## Security Advisor seal

The Security Advisor baseline is unchanged:

- `rls_enabled_no_policy`: 2 INFO
- `anon_security_definer_function_executable`: 4 WARN
- `authenticated_security_definer_function_executable`: 18 WARN
- `auth_leaked_password_protection`: 1 WARN

The four anonymous SECURITY DEFINER findings remain one intentional Attendance RPC plus three Science RPCs. No Science object was modified.

## Phase 7C result

**PASS — no unexplained live/repository equivalence difference was found.**

The seal is read-only. No application code, DOM contract, RPC definition, SQL migration, grant, RLS policy, trigger, Auth setting, Science object, Netlify setting, or production row was changed.

Phase 7D — Final Equivalence Review remains a separate checkpoint and must not start automatically.
