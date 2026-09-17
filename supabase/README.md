# Supabase backend baseline — SR Lumapas Attendance

This directory is the **Phase 0B reconstructed source baseline** for the Attendance
portion of the shared Supabase project `SR Lumapas Science Dev`
(project ref `rojetehazryfpcxlwtbi`).

## Safety boundary

The live Attendance app remains on v0.7 while cleanup v1.0 is prepared.

The Phase 0B files are **not a migration to apply to the existing production database**.
`baseline/attendance_v1_schema.sql` intentionally starts with `CREATE SCHEMA`
without `IF NOT EXISTS`; an accidental run against the existing project should
fail immediately instead of silently modifying production.

Later repository migration files under `migrations/` are incremental cleanup-v1.0
schema/function changes. They are source-controlled proposals until their exact PR
head is verified and the live application step is separately approved. Do not
assume a repository migration has been applied merely because it exists on `main`.
The Phase 4B1 v13 reporting migration is the first cleanup migration separately
approved and applied to production; its live version is recorded below.

Do not place any of the following in this public repository:

- real pupil, teacher or attendance datasets;
- historical roster/pilot seed SQL;
- teacher credentials or Auth-user exports;
- database passwords;
- service-role/private API keys;
- private tokens or production exports.

No Science tables or functions are owned by this Attendance baseline/migration set.

## Captured production contract

Phase 0B evidence was captured on 13 September 2026 from the live project.
The numbers below describe that frozen snapshot, not later repository migrations.

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

- `baseline/attendance_v1_schema.sql` — frozen cumulative Phase 0B Attendance
  schema/functions/RLS/grants/indexes/triggers. No production rows.
- `baseline/attendance_v1_reference_data.sql` — only the non-sensitive Attendance
  status codes and absence reasons.
- `baseline/production_migration_history.md` — sanitized migration version/name
  history that has actually been observed in production; private roster/pilot seed
  SQL is intentionally omitted.
- `migrations/` — repository-owned incremental Attendance cleanup migrations after
  the Phase 0B snapshot. A file here is not proof of live application; consult the
  sanitized production migration history for live application state.
- `verify/attendance_contract.sql` — non-mutating catalog assertions to run after
  loading the Phase 0B baseline **and** all repository Attendance migrations.
- `verify/attendance_reporting_population_fixtures.sql` — aggregate-only read-only
  production-equivalence fixtures for Whole-Class and Non-SEN reporting.

## Reconstruction order

Use a **fresh non-production Supabase project/database**:

1. Run `baseline/attendance_v1_schema.sql`.
2. Run `baseline/attendance_v1_reference_data.sql`.
3. Apply repository Attendance files in `migrations/` in filename order.
4. Run `verify/attendance_contract.sql`; every query should return zero rows.
5. Only after structural verification, add synthetic test fixtures for browser
   regression testing. Never copy production pupil/attendance data into a public
   test fixture.

`verify/attendance_reporting_population_fixtures.sql` is tied to the protected
production-derived 3A aggregate fixtures and is intended for controlled read-only
equivalence verification against the appropriate data source. It is not a seed.

The Phase 0B baseline intentionally does not replay the live project's historical
migration chain. Snapshot #2 recorded Attendance migration names including
pupil-roster/pilot seed migrations whose SQL may contain private data.

## Phase 4B1 reporting source and production boundary

`migrations/20260917090547_attendance_v13_shared_reporting_model.sql` is the
repository source for the Phase 4B1 reporting consolidation. Its SQL bytes are the
same reviewed source that originally entered the repository under version
`20260917070000`; Phase 4B1P renames the repository file only so its migration
version matches the live production ledger created by the approved Supabase
application on 17 September 2026.

It introduces:

- internal `attendance.reporting_class_period_facts(...)`, a `STABLE`
  `SECURITY INVOKER` shared calculation engine whose direct execution is revoked
  from `anon`, `authenticated`, and `service_role`;
- uniquely named population-aware public RPCs:
  `attendance_monthly_class_stats_v2`, `attendance_admin_school_dashboard_v2`,
  and `attendance_class_period_report_v2`;
- the existing public reporting RPC signatures as Whole-Class compatibility
  wrappers, preserving current v0.7 callers;
- explicit population keys `whole_class` and `non_sen`; Non-SEN filtering uses
  `include_in_class_stats=true` and never parses free-text `reporting_group`.

Phase 4B1V PR #53 validated the reconstructed baseline plus v13 in an isolated local
Supabase stack before production application. The exact-head local validation
applied both migrations and passed `attendance_contract.sql`, the reporting
population fixture verifier, the shared-engine equivalence verifier, and the public
legacy/v2 API verifier. The standard Phase 0A, Phase 0B, and 53/53 Playwright gates
also passed before PR #53 merged.

Production application was separately approved and then recorded by Supabase as
`20260917090547 attendance_v13_shared_reporting_model`. Post-application checks
confirmed all seven expected reporting functions, the intended invoker/definer and
EXECUTE grant boundaries, exact Whole-Class legacy-wrapper compatibility, all four
protected 3A Whole-Class/Non-SEN fixtures, and all 15 Dashboard classes. No
Attendance table/data migration, Science change, Netlify change, or cleanup-v1.0
frontend deployment was part of that production application.

Supabase's current Data API guidance recommends unique function names rather than
overloading API-exposed database functions, so Phase 4B1 uses `*_v2` names instead
of new overloads of the three legacy RPC names.

## Known captured risks — preserved, not fixed here

Phase 0B records the existing live design exactly; Phase 4B1 reporting work does
not broaden into Phase 5 security redesign.

- `authenticated` currently has direct DML on `attendance.daily_registers` and
  `attendance.attendance_records` subject to class-scoped RLS. This can bypass
  `attendance_save_register` business safeguards inside an authorized class.
  Review/revoke only in the later security phase with regression coverage.
- Signup/approval distinguishes `class_teacher` and `assistant_teacher`, while
  active class assignment authorization currently collapses to generic
  `teacher`/`viewer` roles.
- Password recovery priority/race is a known behaviour of protected live v0.7;
  its cleanup fix is already merged into cleanup `main` but is not production
  until an explicitly approved promotion.

## Reporting invariants

- Missing registers are **not** zero attendance.
- Possible attendance/denominators use completed registers and eligible pupil-days.
- Population filtering applies to both attendance numerator and possible-attendance
  denominator while register existence/completeness remains a class-day fact.
- Protected Whole-Class 3A fixtures:
  - Feb 2026: 398 / 425 = 0.9365 = 93.65%
  - Term 1: 1,051 / 1,125 = 0.9342 = 93.42%
- Protected Non-SEN 3A fixtures:
  - Feb 2026: 392 / 408 = 0.9608 = 96.08%
  - Term 1: 1,036 / 1,080 = 0.9593 = 95.93%

Repository source changes do not themselves modify the live database or deploy the
cleanup frontend.
