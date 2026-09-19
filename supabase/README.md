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

## Phase 5B register write boundary and production reconciliation

`migrations/20260918094529_attendance_v14_register_write_boundary.sql` is the
repository source for the Phase 5B register-write hardening. Its SQL bytes are
identical to the reviewed source originally committed as version `20260918082500`;
this reconciliation changes the repository migration version only so it matches
the live Supabase migration ledger.

The approved production application was recorded by Supabase as
`20260918094529 attendance_v14_register_write_boundary`. The migration changes
`public.attendance_save_register(uuid,date,jsonb,text)` to `SECURITY DEFINER`
without rewriting its body, and revokes authenticated INSERT/UPDATE/DELETE on
`attendance.daily_registers` and `attendance.attendance_records` while
retaining authenticated SELECT, service-role CRUD, existing RLS policies, and
actor/audit triggers.

Post-application verification proved the save-register body/ACL/search-path
fingerprint unchanged, unauthorized callers blocked, an assigned teacher's
existing-register replay returned a no-change result, the 137 / 3,425 / 3,425
register-record-audit baseline remained unchanged with zero corrections, and all
four protected Whole-Class/Non-SEN reporting fixtures remained exact. This
repository reconciliation must not apply or reapply v14 to production.


## Phase 5C student movement write boundary and production reconciliation

`migrations/20260918144321_attendance_v15_student_movement_write_boundary.sql`
is the reconciled repository source for the Phase 5C student-movement hardening. Its SQL bytes are identical to the reviewed source originally committed as version `20260918131500`; this reconciliation changes the repository migration version only so it matches the live Supabase migration ledger. The exact SQL blob remains `b3c1c2b904558d1d0fb867f5e71feb2506ceec76`.

The migration preserves the existing public Transfer In / Transfer Out / Move Class
function signatures and JSON return shapes while moving their writes behind a
controlled `SECURITY DEFINER` boundary. Transfer In keeps its existing body and
authorization order. Transfer Out and Move Class add an explicit active-admin
membership guard before privileged enrolment access, then constrain the target
enrolment to a school for which the caller is an active administrator.

After v15 in an isolated/local database, `authenticated` retains SELECT on
`attendance.students`, `attendance.enrolments`, and
`attendance.student_movements` but has no direct INSERT/UPDATE/DELETE on those
tables. Existing RLS policies remain in place as defense in depth, and
`service_role` privileges are unchanged.

`verify/attendance_student_movement_v15_contract.sql` is rollback-only and proves:
direct admin DML is blocked; assigned teachers and unaffiliated authenticated
callers cannot use any of the three movement RPCs; authorized Transfer In writes
student/enrolment/movement state atomically; Transfer Out preserves existing
attendance records; and Move Class preserves old-class attendance while creating
the new eligibility boundary and movement history.

The standard Phase 0B, Phase 4B1V, and Phase 5A workflows reconstruct v15 only in
isolated CI/local Supabase stacks. PR #68 final head
`a2b8da0f4e7eaf49cbc74194e1bbff2d85a851b0` passed all five required gates before
merging. Production application was separately approved and Supabase recorded live
migration `20260918144321 attendance_v15_student_movement_write_boundary`.

Post-application verification confirmed all three movement RPCs are now controlled
`SECURITY DEFINER` functions with fixed empty `search_path`, authenticated/service-role
EXECUTE retained, and no `anon`/`PUBLIC` EXECUTE. Authenticated access to `students`,
`enrolments`, and `student_movements` is now SELECT-only while service-role privileges,
RLS, policies, and existing triggers remain unchanged. Rollback-only live smoke tests
proved direct authenticated DML is blocked; teacher/outsider movement calls are rejected;
and authorized Transfer In, Transfer Out, and Move Class still work through the RPC
boundary. Production data stayed at 319 active pupils, 319 current enrolments, 137
registers, 3,425 attendance rows, 3,425 audit rows, zero movements/corrections, and all
four protected Whole-Class/Non-SEN reporting fixtures remained exact. Security Advisor
added only the expected three authenticated-`SECURITY DEFINER` warnings for the movement
RPCs, with no new anonymous Attendance exposure. This repository reconciliation must
not apply or reapply v15 to production.


## Phase 5D teacher-management write boundary — production applied

`migrations/20260919005727_attendance_v16_teacher_management_write_boundary.sql`
is the reconciled repository source for the production-applied Phase 5D boundary. PR #71
merged approved exact head `37040973da36a88f83cfb27551547758c46c84d1`; after
separate production approval, the exact reviewed SQL was applied once and Supabase
recorded `20260919005727 attendance_v16_teacher_management_write_boundary`.
The prebuilt candidate filename was `20260919090000...`; reconciliation changes only
the filename/reconstruction references and preserves the exact reviewed SQL bytes.

The candidate is intentionally grant-only. Existing coordinated write RPCs
`attendance_admin_review_teacher_request(...)` and
`attendance_admin_set_teacher_active(...)` already run as authenticated-only
`SECURITY DEFINER` functions with fixed empty `search_path`, internal school-admin
authorization, and private teacher-access audit writes. V16 therefore does not
rewrite or alter either RPC. It revokes authenticated INSERT/UPDATE/DELETE on
`attendance.teacher_school_memberships` and
`attendance.teacher_class_assignments` while retaining authenticated SELECT,
existing RLS policies/triggers, and service-role privileges.

`verify/attendance_teacher_management_v16_contract.sql` is rollback-only and proves
all six direct authenticated DML verbs are blocked even for a synthetic school
administrator; assigned-teacher and outsider callers cannot use the admin mutation
RPCs; authorized approval still coordinates signup request, school membership,
class assignment and private audit history; Attendance-only disable/enable still
updates both membership and assignments together and records
`access_disabled`/`access_enabled`; `attendance_teacher_status()` remains
correct; and invoker-mode `attendance_bootstrap()` still works through retained
RLS-scoped SELECT access.

Phase 5D deliberately preserves the current generic `teacher` values in
school memberships and class assignments even when the approved request records
`class_teacher` or `assistant_teacher`. Persisting those assignment roles
authoritatively remains the separate Phase 5E checkpoint.

The Phase 0B, Phase 4B1V, and Phase 5A workflows reconstruct v16 only in isolated
CI/local Supabase stacks. PR #71 final exact head passed Phase 0A `35401645755`,
Phase 0B `35401645844`, Playwright `35401645750` with 60/60 Chromium tests in
23.8s, Phase 4B1V `35401645871`, and Phase 5A `35401645765` before merge.
Production now records live v16 `20260919005727`. Post-apply verification confirms
authenticated INSERT/UPDATE/DELETE is revoked on both teacher-management tables,
while authenticated SELECT, service-role CRUD, RLS/policies/triggers, coordinated
teacher-admin RPC bodies, audit semantics, attendance history, and protected reporting
fixtures remain unchanged. Do not reapply v16 during repository reconciliation.

## Known captured risks — preserved, not fixed here

Phase 0B records the existing live design exactly; Phase 4B1 reporting work does
not broaden into Phase 5 security redesign.

- Phase 5B production v14 has closed authenticated INSERT/UPDATE/DELETE on
  `attendance.daily_registers` and `attendance.attendance_records`; authenticated
  SELECT remains and writes flow through the controlled `attendance_save_register`
  RPC. Direct authenticated writes still remain on other Attendance admin tables
  and are handled separately by Phase 5C-5F.
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
