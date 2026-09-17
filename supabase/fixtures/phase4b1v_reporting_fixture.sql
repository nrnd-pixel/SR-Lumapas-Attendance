-- Phase 4B1V synthetic-only reporting fixture.
-- Fresh local Supabase validation target ONLY.
-- Contains no production pupil/teacher identifiers or exports.
--
-- Reproduces the four protected 3A aggregate fixtures:
--   Feb 2026 whole_class: 398 / 425 = 93.65%
--   Feb 2026 non_sen:     392 / 408 = 96.08%
--   Term 1 whole_class:  1051 / 1125 = 93.42%
--   Term 1 non_sen:      1036 / 1080 = 95.93%

begin;

-- Synthetic administrator used only to exercise authenticated/admin RPC paths.
insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000099'::uuid,
  'phase4b1v-admin@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into attendance.schools (id, school_code, school_name, timezone, active)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'TEST-SRL',
  'Synthetic SR Lumapas Validation School',
  'Asia/Brunei',
  true
);

insert into attendance.academic_years
  (id, school_id, year_no, start_date, end_date, active)
values (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  2026,
  date '2026-01-03',
  date '2026-11-30',
  true
);

insert into attendance.terms
  (id, academic_year_id, term_no, term_name, start_date, end_date)
values (
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  1,
  'Term 1',
  date '2026-01-03',
  date '2026-03-12'
);

insert into attendance.classes
  (id, academic_year_id, class_code, class_name, year_level, active)
values (
  '00000000-0000-0000-0000-000000000004'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '3A',
  'Year 3A',
  3,
  true
);

insert into attendance.teacher_school_memberships
  (user_id, school_id, role, active)
values (
  '00000000-0000-0000-0000-000000000099'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin',
  true
);

-- 25 synthetic pupils: 14 male, 11 female. P14 is the sole excluded
-- include_in_class_stats=false pupil, giving the protected 13M/11F non-SEN roster.
insert into attendance.students
  (id, school_id, student_ref, full_name, gender, active)
select
  ('10000000-0000-0000-0000-' || lpad(gs::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'P' || lpad(gs::text,2,'0'),
  'Synthetic Pupil ' || lpad(gs::text,2,'0'),
  case when gs <= 14 then 'Male' else 'Female' end,
  true
from generate_series(1,25) gs;

insert into attendance.enrolments
  (id, student_id, class_id, start_date, reporting_group,
   include_in_class_stats, active, enrolment_status, roster_order)
select
  ('20000000-0000-0000-0000-' || lpad(gs::text,12,'0'))::uuid,
  ('10000000-0000-0000-0000-' || lpad(gs::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  date '2026-01-03',
  case when gs=14 then 'Synthetic excluded group' else 'Mainstream' end,
  (gs <> 14),
  true,
  'ENROLLED',
  gs::smallint
from generate_series(1,25) gs;

-- Exactly 45 Term-1 school days: 19 in January, 17 in February, 9 in March.
with jan as (
  select d::date as calendar_date
  from generate_series(date '2026-01-03',date '2026-01-31',interval '1 day') d
  where extract(isodow from d) between 1 and 5
  order by d
  limit 19
), feb as (
  select d::date as calendar_date
  from generate_series(date '2026-02-01',date '2026-02-28',interval '1 day') d
  where extract(isodow from d) between 1 and 5
  order by d
  limit 17
), mar as (
  select d::date as calendar_date
  from generate_series(date '2026-03-01',date '2026-03-12',interval '1 day') d
  where extract(isodow from d) between 1 and 5
  order by d
  limit 9
), days as (
  select calendar_date from jan
  union all select calendar_date from feb
  union all select calendar_date from mar
)
insert into attendance.calendar_dates
  (academic_year_id, calendar_date, is_school_day, term_id, label)
select
  '00000000-0000-0000-0000-000000000002'::uuid,
  calendar_date,
  true,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Synthetic school day'
from days;

insert into attendance.daily_registers
  (id, class_id, attendance_date, status, started_by, submitted_by, submitted_at, updated_by)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000004'::uuid,
  cd.calendar_date,
  'submitted',
  '00000000-0000-0000-0000-000000000099'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid,
  now(),
  '00000000-0000-0000-0000-000000000099'::uuid
from attendance.calendar_dates cd
where cd.academic_year_id='00000000-0000-0000-0000-000000000002'::uuid
  and cd.is_school_day;

-- Begin with every eligible pupil absent on every completed register.
insert into attendance.attendance_records
  (id, daily_register_id, enrolment_id, status_code, source, created_by, updated_by)
select
  gen_random_uuid(),
  dr.id,
  e.id,
  'A',
  'web',
  '00000000-0000-0000-0000-000000000099'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid
from attendance.daily_registers dr
cross join attendance.enrolments e
where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
  and e.class_id=dr.class_id;

-- Non-SEN males: Feb 208 present of 221 possible; outside Feb 344 of 364.
with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and dr.attendance_date between date '2026-02-01' and date '2026-02-28'
    and s.gender='Male' and e.include_in_class_stats
  order by dr.attendance_date,s.student_ref
  limit 208
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and not (dr.attendance_date between date '2026-02-01' and date '2026-02-28')
    and s.gender='Male' and e.include_in_class_stats
  order by dr.attendance_date,s.student_ref
  limit 344
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

-- Females: Feb 184 present of 187 possible; outside Feb 300 of 308.
with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and dr.attendance_date between date '2026-02-01' and date '2026-02-28'
    and s.gender='Female'
  order by dr.attendance_date,s.student_ref
  limit 184
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and not (dr.attendance_date between date '2026-02-01' and date '2026-02-28')
    and s.gender='Female'
  order by dr.attendance_date,s.student_ref
  limit 300
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

-- Excluded P14 male contributes exactly +6 in Feb and +15 across Term 1.
with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and dr.attendance_date between date '2026-02-01' and date '2026-02-28'
    and s.student_ref='P14'
  order by dr.attendance_date
  limit 6
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

with chosen as (
  select ar.id
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id=ar.daily_register_id
  join attendance.enrolments e on e.id=ar.enrolment_id
  join attendance.students s on s.id=e.student_id
  where dr.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and not (dr.attendance_date between date '2026-02-01' and date '2026-02-28')
    and s.student_ref='P14'
  order by dr.attendance_date
  limit 9
)
update attendance.attendance_records ar set status_code='P' from chosen c where ar.id=c.id;

commit;
