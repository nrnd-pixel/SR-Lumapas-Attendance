# Supabase backend baseline — SR Lumapas Attendance

This directory is the **Phase 0B reconstructed source baseline** for the Attendance
portion of the shared Supabase project `SR Lumapas Science Dev`
(project ref `rojetehazryfpcxlwtbi`).

## Safety boundary

The live Attendance app remains on v0.7 while cleanup v1.0 is prepared.

These files are **not a migration to apply to the existing production database**.
`baseline/attendance_v1_schema.sql` intentionally starts with `CREATE SCHEMA`
without `IF NOT EXISTS`; an accidental run against the existing project should
fail immediately instead of silently modifying production.

Do not place any of the following in this public repository:

- real pupil, teacher or attendance datasets;
- historical roster/pilot seed SQL;
- teacher credentials or Auth-user exports;
- database passwords;
- service-role/private API keys;
- private tokens or production exports.

No Science tables or functions are owned by this baseline.

## Captured production contract

Phase 0B evidence was captured on 13 September 2026 from the live project.

- 2 Attendance schemas: `attendance`, `attendance_private`
- 18 tables
- 163 columns
- 94 constraints
- 30 non-constraint indexes
- 13 triggers
- 50 RLS policies
- 25 functions total
- 18 public frontend RPCs
- 13 Attendance status codes
- 6 absence reasons

Supabase Auth URL configuration:

- Site URL: `https://srlumapas.netlify.app/`
- Redirect allow-list: `https://srlumapas.netlify.app/**`

The frontend uses `window.location.origin + '/'` for signup and password-recovery
redirects; Phase 0B does not change that configuration.

## Files

- `baseline/attendance_v1_schema.sql` — current cumulative Attendance schema,
  functions, RLS, grants, indexes and triggers. No production rows.
- `baseline/attendance_v1_reference_data.sql` — only the non-sensitive Attendance
  status codes and absence reasons.
- `baseline/production_migration_history.md` — sanitized Attendance migration
  version/name history; production roster seed SQL is intentionally omitted.
- `verify/attendance_contract.sql` — non-mutating catalog assertions to run on a
  reconstructed database after loading the baseline.

## Reconstruction order

Use a **fresh non-production Supabase project/database**:

1. Run `baseline/attendance_v1_schema.sql`.
2. Run `baseline/attendance_v1_reference_data.sql`.
3. Run `verify/attendance_contract.sql`.
4. Only after structural verification, add synthetic test fixtures for browser
   regression testing. Never copy production pupil/attendance data into a public
   test fixture.

The cumulative baseline intentionally does not replay the live project's
historical migration chain. Snapshot #2 recorded 31 Attendance migration names,
including pupil-roster/pilot seed migrations whose SQL may contain private data.

## Known captured risks — preserved, not fixed here

Phase 0B records the existing live design exactly; it does not redesign it.

- `authenticated` currently has direct DML on `attendance.daily_registers` and
  `attendance.attendance_records` subject to class-scoped RLS. This can bypass
  `attendance_save_register` business safeguards inside an authorized class.
  Review/revoke only in the later security phase with regression coverage.
- Signup/approval distinguishes `class_teacher` and `assistant_teacher`, while
  active class assignment authorization currently collapses to generic
  `teacher`/`viewer` roles.
- Password recovery priority/race is a known frontend correctness bug and belongs
  to Phase 2, not this backend source-freeze checkpoint.

## Reporting invariants to protect in later runtime tests

- Missing registers are **not** zero attendance.
- Possible attendance/denominators use completed registers and eligible pupil-days.
- Known 3A fixtures must remain equivalent when reporting work begins:
  - Feb 2026: cumulative 398, ratio 0.9365, 93.65%
  - Term 1: cumulative 1,051, ratio 0.9342, 93.42%

Phase 0B source capture itself makes no live database or deployment change.
