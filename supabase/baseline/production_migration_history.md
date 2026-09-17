# Production Attendance migration history (sanitized)

This file records **version/name metadata only** from the live Supabase migration
history. The initial Phase 0B capture was taken on 13 September 2026; later
approved public-safe Attendance migration metadata is appended when production
state materially changes.

It deliberately omits:

- stored migration SQL statements;
- migration creator identity metadata;
- Science migrations;
- pupil rosters, teacher identities, attendance rows, production UUIDs and other
  operational data.

Historical roster/pilot seed migrations are marked **PRIVATE DATA — OMITTED**.
Their SQL must never be reconstructed into this public repository. The current
database structure is represented instead by `attendance_v1_schema.sql` plus the
repository-owned incremental migration files.

| Version | Migration name | Public baseline handling |
| --- | --- | --- |
| `20260903092309` | `attendance_v01_portable_core` | Structure represented cumulatively |
| `20260903092652` | `attendance_v01_rls_performance_hardening` | Structure represented cumulatively |
| `20260903093203` | `attendance_v01_3a_pilot_seed` | **PRIVATE DATA — OMITTED** |
| `20260903093340` | `attendance_v01_trigger_hardening` | Structure represented cumulatively |
| `20260903093815` | `attendance_v01_calendar_holiday_correction` | Structure represented cumulatively |
| `20260903094209` | `attendance_v01_roster_order` | Structure represented cumulatively |
| `20260903103737` | `attendance_v03_mobile_api` | Structure represented cumulatively |
| `20260903103902` | `attendance_v04_rls_recursion_fix` | Structure represented cumulatively |
| `20260903230958` | `attendance_v05_formal_correction_audit` | Structure represented cumulatively |
| `20260903232644` | `attendance_v06_schoolwide_classes` | Structure represented cumulatively |
| `20260903232718` | `attendance_v06_schoolwide_roster_1a` | **PRIVATE DATA — OMITTED** |
| `20260903232734` | `attendance_v06_schoolwide_roster_1b` | **PRIVATE DATA — OMITTED** |
| `20260903232748` | `attendance_v06_schoolwide_roster_2a` | **PRIVATE DATA — OMITTED** |
| `20260903232803` | `attendance_v06_schoolwide_roster_2b` | **PRIVATE DATA — OMITTED** |
| `20260903232824` | `attendance_v06_schoolwide_roster_3b` | **PRIVATE DATA — OMITTED** |
| `20260903232839` | `attendance_v06_schoolwide_roster_4a` | **PRIVATE DATA — OMITTED** |
| `20260903232859` | `attendance_v06_schoolwide_roster_4b` | **PRIVATE DATA — OMITTED** |
| `20260903232920` | `attendance_v06_schoolwide_roster_5a` | **PRIVATE DATA — OMITTED** |
| `20260903232933` | `attendance_v06_schoolwide_roster_5b` | **PRIVATE DATA — OMITTED** |
| `20260903232948` | `attendance_v06_schoolwide_roster_6a` | **PRIVATE DATA — OMITTED** |
| `20260903233004` | `attendance_v06_schoolwide_roster_6b` | **PRIVATE DATA — OMITTED** |
| `20260903233235` | `attendance_v07_bootstrap_role` | Structure represented cumulatively |
| `20260904000327` | `attendance_v06_prasekolah_roster` | **PRIVATE DATA — OMITTED** |
| `20260904125342` | `attendance_v08_admin_student_management` | Structure represented cumulatively |
| `20260904125810` | `attendance_v08_movement_fk_indexes` | Structure represented cumulatively |
| `20260904140243` | `attendance_v09_teacher_signup_access` | Structure represented cumulatively |
| `20260904140527` | `attendance_v09_teacher_signup_grant_hardening` | Structure represented cumulatively |
| `20260906124038` | `attendance_v09_monthly_class_statistics` | Structure represented cumulatively |
| `20260906124236` | `attendance_v10_monthly_stats_partial_month_guard` | Structure represented cumulatively |
| `20260906124859` | `attendance_v10_admin_school_dashboard` | Structure represented cumulatively |
| `20260906125521` | `attendance_v12_term_ytd_reporting` | Structure represented cumulatively |
| `20260917090547` | `attendance_v13_shared_reporting_model` | Public repository migration; production-applied and verified 17 Sep 2026 |

Attendance migrations recorded: **32**.
