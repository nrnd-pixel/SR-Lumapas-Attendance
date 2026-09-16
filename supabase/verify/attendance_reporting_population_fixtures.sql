-- SR Lumapas Attendance Phase 4A reporting-population fixture verifier
-- Safe/non-mutating: reads Attendance tables only.
-- Contains aggregate expected values only; no pupil/teacher identifiers or production rows.
--
-- Purpose:
--   Freeze the two department-dependent reporting populations before Phase 4
--   consolidates reporting SQL or adds the browser population selector.
--
-- Population semantics:
--   whole_class = every active date-eligible enrolment.
--   non_sen     = active date-eligible enrolments where include_in_class_stats is true.
--
-- PASS condition: every SELECT below returns zero rows.

-- 1. The production-derived Term 1 metadata used by the fixture must remain explicit.
select
  'term1_2026_metadata' as check_name,
  jsonb_build_object(
    'actual_start', t.start_date,
    'actual_end', t.end_date,
    'expected_start', date '2026-01-03',
    'expected_end', date '2026-03-12'
  ) as mismatch
from attendance.terms t
join attendance.academic_years ay on ay.id=t.academic_year_id
join attendance.classes c on c.academic_year_id=ay.id
where ay.year_no=2026
  and c.class_code='3A'
  and c.active
  and t.term_no=1
  and (t.start_date is distinct from date '2026-01-03'
       or t.end_date is distinct from date '2026-03-12');

-- 2. Whole-class and Non-SEN aggregate equivalence fixtures.
with target as (
  select c.id as class_id, c.academic_year_id
  from attendance.classes c
  join attendance.academic_years ay on ay.id=c.academic_year_id
  where c.class_code='3A'
    and c.active
    and ay.year_no=2026
  order by c.created_at desc
  limit 1
), periods(period_key,start_date,end_date) as (
  values
    ('feb_2026'::text, date '2026-02-01', date '2026-02-28'),
    ('term1_2026'::text, date '2026-01-03', date '2026-03-12')
), populations(population_key) as (
  values ('whole_class'::text), ('non_sen'::text)
), school_days as (
  select p.period_key,p.start_date,p.end_date,cd.calendar_date as attendance_date
  from periods p
  cross join target t
  join attendance.calendar_dates cd on cd.academic_year_id=t.academic_year_id
  where cd.is_school_day
    and cd.calendar_date between p.start_date and p.end_date
), eligible as (
  select
    sd.period_key,
    pop.population_key,
    sd.attendance_date,
    e.id as enrolment_id,
    e.student_id,
    coalesce(s.gender,'') as gender
  from school_days sd
  cross join target t
  cross join populations pop
  join attendance.enrolments e on e.class_id=t.class_id
    and e.active
    and e.start_date<=sd.attendance_date
    and (e.end_date is null or e.end_date>=sd.attendance_date)
    and (pop.population_key='whole_class' or e.include_in_class_stats)
  join attendance.students s on s.id=e.student_id and s.active
), daily as (
  select
    sd.period_key,
    pop.population_key,
    sd.attendance_date,
    count(el.enrolment_id)::int as eligible_students,
    exists(
      select 1
      from attendance.daily_registers dr
      cross join target t2
      where dr.class_id=t2.class_id
        and dr.attendance_date=sd.attendance_date
    ) as register_exists,
    count(*) filter(where ac.counts_as_present)::int as total_attendance,
    count(*) filter(where el.gender='Male' and ac.counts_as_present)::int as male_attendance,
    count(*) filter(where el.gender='Female' and ac.counts_as_present)::int as female_attendance,
    count(*) filter(where el.gender not in('Male','Female') and ac.counts_as_present)::int as unknown_gender_attendance
  from school_days sd
  cross join populations pop
  cross join target t
  left join eligible el
    on el.period_key=sd.period_key
   and el.population_key=pop.population_key
   and el.attendance_date=sd.attendance_date
  left join attendance.daily_registers dr
    on dr.class_id=t.class_id
   and dr.attendance_date=sd.attendance_date
  left join attendance.attendance_records ar
    on ar.daily_register_id=dr.id
   and ar.enrolment_id=el.enrolment_id
  left join attendance.attendance_codes ac on ac.code=ar.status_code
  group by sd.period_key,pop.population_key,sd.attendance_date
), roster as (
  select
    p.period_key,
    pop.population_key,
    count(distinct e.student_id)::int as pupils_seen,
    count(distinct e.student_id) filter(where s.gender='Male')::int as male_pupils,
    count(distinct e.student_id) filter(where s.gender='Female')::int as female_pupils,
    count(distinct e.student_id) filter(where s.gender is null or s.gender not in('Male','Female'))::int as gender_unknown_pupils
  from periods p
  cross join target t
  cross join populations pop
  join attendance.enrolments e on e.class_id=t.class_id
    and e.active
    and e.start_date<=p.end_date
    and (e.end_date is null or e.end_date>=p.start_date)
    and (pop.population_key='whole_class' or e.include_in_class_stats)
  join attendance.students s on s.id=e.student_id and s.active
  group by p.period_key,pop.population_key
), actual as (
  select
    d.period_key,
    d.population_key,
    count(*)::int as scheduled_school_days,
    count(*) filter(where d.register_exists)::int as registers_completed,
    count(*) filter(where not d.register_exists)::int as registers_missing,
    coalesce(sum(d.eligible_students) filter(where d.register_exists),0)::int as possible_attendance,
    coalesce(sum(d.total_attendance) filter(where d.register_exists),0)::int as cumulative_total,
    coalesce(sum(d.male_attendance) filter(where d.register_exists),0)::int as cumulative_male,
    coalesce(sum(d.female_attendance) filter(where d.register_exists),0)::int as cumulative_female,
    coalesce(sum(d.unknown_gender_attendance) filter(where d.register_exists),0)::int as cumulative_unknown_gender,
    case
      when coalesce(sum(d.eligible_students) filter(where d.register_exists),0)>0
      then round(
        coalesce(sum(d.total_attendance) filter(where d.register_exists),0)::numeric
        / sum(d.eligible_students) filter(where d.register_exists),
        4
      )
    end as average_attendance,
    case
      when coalesce(sum(d.eligible_students) filter(where d.register_exists),0)>0
      then round((
        coalesce(sum(d.total_attendance) filter(where d.register_exists),0)::numeric
        / sum(d.eligible_students) filter(where d.register_exists)
      )*100,2)
    end as attendance_percentage,
    r.pupils_seen,
    r.male_pupils,
    r.female_pupils,
    r.gender_unknown_pupils
  from daily d
  join roster r using(period_key,population_key)
  group by
    d.period_key,d.population_key,
    r.pupils_seen,r.male_pupils,r.female_pupils,r.gender_unknown_pupils
), expected(
  period_key,population_key,
  scheduled_school_days,registers_completed,registers_missing,
  possible_attendance,cumulative_total,
  cumulative_male,cumulative_female,cumulative_unknown_gender,
  average_attendance,attendance_percentage,
  pupils_seen,male_pupils,female_pupils,gender_unknown_pupils
) as (
  values
    ('feb_2026','whole_class',17,17,0,425,398,214,184,0,0.9365::numeric,93.65::numeric,25,14,11,0),
    ('feb_2026','non_sen',17,17,0,408,392,208,184,0,0.9608::numeric,96.08::numeric,24,13,11,0),
    ('term1_2026','whole_class',45,45,0,1125,1051,567,484,0,0.9342::numeric,93.42::numeric,25,14,11,0),
    ('term1_2026','non_sen',45,45,0,1080,1036,552,484,0,0.9593::numeric,95.93::numeric,24,13,11,0)
)
select
  'reporting_population_fixture' as check_name,
  e.period_key,
  e.population_key,
  to_jsonb(e)-'period_key'-'population_key' as expected,
  to_jsonb(a)-'period_key'-'population_key' as actual
from expected e
left join actual a using(period_key,population_key)
where a.period_key is null
   or (to_jsonb(a)-'period_key'-'population_key')
      is distinct from
      (to_jsonb(e)-'period_key'-'population_key');
