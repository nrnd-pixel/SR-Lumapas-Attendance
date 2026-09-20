-- Phase 6B: formalise the existing enrolment lifecycle shape without
-- changing RPCs, reporting semantics, row activity, grants, RLS, triggers,
-- Science objects, Auth configuration, frontend code, or production data.
--
-- Current rows use end_date as the lifecycle boundary:
--   current: ENROLLED / TRANSFERRED IN + end_date IS NULL
--   closed : TRANSFERRED OUT / MOVED CLASS + end_date IS NOT NULL
-- The active flag remains independent and is intentionally NOT constrained here
-- because historical rows remain active so past attendance stays reportable.

alter table attendance.enrolments
  add constraint attendance_enrolments_lifecycle_status_check
  check (
    (
      end_date is null
      and enrolment_status in ('ENROLLED', 'TRANSFERRED IN')
    )
    or
    (
      end_date is not null
      and enrolment_status in ('TRANSFERRED OUT', 'MOVED CLASS')
    )
  ) not valid;

alter table attendance.enrolments
  validate constraint attendance_enrolments_lifecycle_status_check;
