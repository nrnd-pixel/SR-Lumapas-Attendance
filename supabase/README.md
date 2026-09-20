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

## Phase 5E teacher assignment-role persistence — production applied

`migrations/20260919015041_attendance_v17_teacher_role_persistence.sql` is the
reconciled repository source for the production-applied Phase 5E migration. The
reviewed repository candidate was originally version `20260919013000`; after
separate explicit approval, those exact SQL bytes were applied once and Supabase
recorded live migration
`20260919015041 attendance_v17_teacher_role_persistence`. Repository/live
reconciliation changes only the filename and reconstruction references; the Git
blob remains `9f127e3615fae3e8a508b636435e6035d9fea560`.

The migration keeps school-level membership roles generic (`admin`, `teacher`,
`viewer`) and preserves existing class-access behavior. It expands only the
`teacher_class_assignments.role` domain so class assignments can store
`class_teacher` and `assistant_teacher` alongside legacy `teacher` /
`viewer` values. The existing
`attendance_admin_review_teacher_request(...)` signature, SECURITY DEFINER mode,
fixed empty `search_path`, internal school-admin authorization, audit writes, and
JSON return contract are preserved; its class-assignment write now stores the
already-validated approved assignment type instead of collapsing it to
`teacher`.

The migration includes a conservative historical backfill: only a generic
`teacher` class-assignment row with an exact user/class match to approved signup
history and exactly one distinct approved assignment type is updated. Unmatched
legacy/admin assignments and ambiguous histories remain unchanged.

`verify/attendance_teacher_role_v17_contract.sql` is rollback-only and proves
both authoritative teacher types persist, generic school membership remains
unchanged, legacy `teacher` / `viewer` assignments remain valid and retain
class access, `attendance_teacher_status()` exposes the persisted assignment
role, enable/disable preserves it, approval audit semantics remain intact, and
the Phase 5D direct authenticated DML boundary stays closed.

The Phase 4B1V and Phase 5A local workflows reconstruct v17 after v16 and run
the v17 verifier at the final schema state. The historical v16 verifier remains
source-controlled evidence of the pre-Phase-5E contract.

Post-production verification confirmed exactly one historical assignment changed
from generic `teacher` to `class_teacher`, leaving one unmatched legacy/admin
assignment as generic `teacher`; there were zero ambiguous or remaining eligible
backfill candidates. School memberships, authenticated SELECT-only table access,
service-role CRUD, RLS/policy/trigger counts, enable/disable semantics, teacher
audit aggregates, and the 137 / 3,425 / 3,425 attendance-history baseline remained
unchanged. Protected reporting population and shared-engine equivalence checks
returned zero mismatches, and rollback-scoped live status/bootstrap checks confirmed
the backfilled teacher retained class access and now reports `class_teacher`.
The repository v17 verifier itself uses synthetic local fixture IDs and therefore
is not run verbatim against production; production uses equivalent read-only and
rollback-isolated checks derived from live authorization context. No frontend/DOM/
Auth/Science/Netlify change is part of this checkpoint. Do not reapply v17 during
repository reconciliation.

## Phase 5F1 structural-admin write boundary — production applied

`migrations/20260919044948_attendance_v18_structural_write_boundary.sql` is the
reconciled repository source for the production-applied Phase 5F1 boundary.
Supabase recorded the live migration as
`20260919044948 attendance_v18_structural_write_boundary`. The SQL bytes are
unchanged from the reviewed repository candidate; Git blob remains
`5182f1dff7a993151e81a331188aa692dfc86fb3`.

The migration is grant-only. It revokes authenticated INSERT/UPDATE/DELETE on
`academic_years`, `calendar_dates`, `classes`, `schools`, `settings`, and
`terms`. Authenticated SELECT remains available through the existing RLS model,
service-role CRUD remains unchanged, and no RLS policy, trigger, foreign key,
constraint, function/RPC, Auth setting, Science object, frontend/DOM, or Netlify
configuration is modified.

This boundary is intentionally conservative: the current cleanup frontend contains
zero direct table writers and no structural-administration screen, while direct
admin structural DML can change reporting periods/denominators or reach attendance
history through parent cascades. Phase 5F1 does **not** introduce replacement
structural-write RPCs; future rollover/structural administration remains a separate
design checkpoint.

`verify/attendance_structural_write_v18_contract.sql` is synthetic/local-only and
rollback-isolated. It proves all six structural tables remain authenticated-readable
but not directly writable, anonymous table access remains absent, service-role CRUD
remains intact, the existing policy/trigger inventory and RLS stay present, no
structural writer function is introduced implicitly, and even a valid synthetic
school administrator is blocked from direct INSERT/UPDATE/DELETE at the privilege
boundary.

The shared `attendance_security_access_contract.sql` is updated so the expected
final Attendance state has **zero authenticated direct table writes**. Phase 4B1V
and Phase 5A reconstruct v18 after v17 and run the new structural verifier; Phase
4B1V also retains all protected reporting equivalence/public-API checks.

Rollback, if later required after a separately approved production application, is
grant restoration only: restore the exact pre-v18 authenticated structural DML
grants (full DML on academic years/calendar/classes/settings/terms and UPDATE-only
on schools), then rerun the structural/security/reporting/browser gates. V18 changes
no rows and no function bodies.

## Phase 6A foreign-key index coverage — production applied

`migrations/20260920060510_attendance_v19_fk_index_coverage.sql` is the reconciled
repository source for the production-applied Phase 6A migration. Supabase recorded
the live migration as `20260920060510 attendance_v19_fk_index_coverage`. The SQL
bytes are unchanged from the reviewed repository candidate; Git blob remains
`998e10512a87f85c32b71b0a59d8fa0b2bdb23e4`.

The migration adds exactly six ordinary B-tree indexes covering the
Attendance/Attendance-private foreign keys reported by Supabase Performance
Advisor:

- `attendance.teacher_signup_requests(approved_class_id)`;
- `attendance.teacher_signup_requests(requested_class_id)`;
- `attendance.teacher_signup_requests(reviewed_by)`;
- `attendance_private.teacher_access_audit(actor_user_id)`;
- `attendance_private.teacher_access_audit(class_id)`;
- `attendance_private.teacher_access_audit(request_id)`.

The migration is additive only. It removes no index and changes no rows, functions,
RPC signatures, grants, RLS policies, triggers, constraints, Auth settings, Science
objects, frontend/DOM contracts, or Netlify configuration. The affected production
tables contained only 1 signup request and 2 teacher-access audit rows at
application time, so this is preventive scale/referential-integrity hardening rather
than a response to a demonstrated latency incident.

`verify/attendance_fk_index_v19_contract.sql` is a read-only zero-row verifier.
It inspects PostgreSQL catalog metadata and fails if any foreign key in the
`attendance` or `attendance_private` schema lacks a valid, ready, non-partial,
non-expression index whose leading columns cover that foreign key.

Phase 0B statically restricts the v19 source to the exact six approved
`CREATE INDEX ... USING btree` statements and rejects Science references,
index removal, DML, grants/revokes, functions, policies, triggers, constraints,
Auth changes, or unrelated operations. Phase 4B1V and Phase 5A reconstruct the
reconciled live version after v18 and run the new verifier while retaining all
prior reporting/security checks.

Post-production verification confirmed all six index definitions, zero uncovered
Attendance/Attendance-private foreign keys, disappearance of the
`unindexed_foreign_keys` advisor finding, unchanged security-advisor baseline,
15 active classes / 319 active pupils / 319 active enrolments, 3A 137 registers /
3,425 attendance records, and protected reporting invariants of February
398 / 0.9365 / 93.65% and Term 1 1,051 / 0.9342 / 93.42%.

If v19 must be rolled back, rollback is limited to dropping these six new indexes
and rerunning the full database/security/reporting/browser gates; no row rollback
is required.

## Phase 6B enrolment lifecycle contract — repository/local candidate only

`migrations/20260920082000_attendance_v20_enrolment_lifecycle_contract.sql`
formalises the lifecycle shape already used by the movement RPCs without changing
their signatures, bodies, returned JSON, authorization, or frontend contracts.

The candidate adds one validated CHECK on `attendance.enrolments`:

- `end_date IS NULL` requires `enrolment_status` to be `ENROLLED` or
  `TRANSFERRED IN`;
- `end_date IS NOT NULL` requires `enrolment_status` to be
  `TRANSFERRED OUT` or `MOVED CLASS`.

The migration deliberately does **not** constrain `active`. Closed Transfer Out
and old Move Class rows remain `active=true` so existing register/reporting
readers continue to include them for dates on or before their `end_date`.

The CHECK is added `NOT VALID` and then validated. This leaves the repository
result fully validated while reducing the future production validation lock
profile compared with a single immediate-validation statement.

`verify/attendance_enrolment_lifecycle_v20_contract.sql` is synthetic/local only
and rollback-isolated. It verifies the validated constraint, rejects malformed
status/end-date combinations, executes the real Transfer Out and Move Class RPCs,
asserts closed rows remain active, and compares historical
`attendance.reporting_class_period_facts` JSON before and after each movement.

Phase 0B freezes the migration to the exact two approved ALTER TABLE statements
and rejects DML, grants/revokes, functions, policies, triggers, Auth changes,
Science references, or any attempt to constrain `active`. Phase 4B1V and Phase
5A reconstruct the v20 candidate after v19 and run the new verifier while
retaining all prior reporting/security gates.

This repository candidate does **not** mean v20 is live. Production remains on
`20260920060510 attendance_v19_fk_index_coverage` until a separate production
application is explicitly approved and verified. If v20 is later applied and must
be rolled back, rollback is limited to dropping
`attendance_enrolments_lifecycle_status_check`; no row rollback is required.

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
