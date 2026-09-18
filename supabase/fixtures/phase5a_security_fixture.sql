-- Phase 5A synthetic-only security/access fixture.
-- Fresh local Supabase validation target ONLY.
-- Contains no production pupil/teacher identifiers or exports.
-- Extends phase4b1v_reporting_fixture.sql with role identities used to test
-- the current Attendance authorization boundary before Phase 5 hardening.

begin;

-- Assigned synthetic teacher.
insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000100'::uuid,
  'phase5a-teacher@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into attendance.teacher_school_memberships
  (user_id, school_id, role, active)
values (
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'teacher',
  true
);

insert into attendance.teacher_class_assignments
  (user_id, class_id, role, active)
values (
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  'teacher',
  true
);

-- Authenticated but completely unauthorized synthetic account.
insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000101'::uuid,
  'phase5a-outsider@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

-- School day outside the protected Term 1 reporting fixtures. No register is
-- seeded for this date so Phase 5A can exercise both direct DML and the
-- controlled attendance_save_register write path inside rollback transactions.
insert into attendance.calendar_dates
  (academic_year_id, calendar_date, is_school_day, term_id, label)
values (
  '00000000-0000-0000-0000-000000000002'::uuid,
  date '2026-04-01',
  true,
  null,
  'Synthetic Phase 5A write-boundary test day'
);

commit;
