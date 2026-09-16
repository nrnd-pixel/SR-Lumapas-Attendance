-- SR Lumapas Attendance Phase 4B1 shared-engine equivalence verifier
-- Safe/non-mutating: reads Attendance data and calls the internal STABLE helper.
-- Run only after attendance_v13_shared_reporting_model has been applied in the
-- environment being verified.
-- Contains aggregate expected values only; no pupil/teacher identifiers.
--
-- PASS condition: every SELECT below returns zero rows.

with target as (
  select c.id as class_id
  from attendance.classes c
  join attendance.academic_years ay on ay.id=c.academic_year_id
  where c.class_code='3A'
    and c.active
    and ay.year_no=2026
  order by c.created_at desc
  limit 1
),
expected(
  period_key,population_key,start_date,end_date,
  scheduled_school_days,registers_completed,registers_missing,
  possible_attendance,cumulative_total,
  cumulative_male,cumulative_female,cumulative_unknown_gender,
  average_attendance,attendance_percentage,
  pupils_seen,male_pupils,female_pupils,gender_unknown_pupils
) as (
  values
    ('feb_2026','whole_class',date '2026-02-01',date '2026-02-28',17,17,0,425,398,214,184,0,0.9365::numeric,93.65::numeric,25,14,11,0),
    ('feb_2026','non_sen',date '2026-02-01',date '2026-02-28',17,17,0,408,392,208,184,0,0.9608::numeric,96.08::numeric,24,13,11,0),
    ('term1_2026','whole_class',date '2026-01-03',date '2026-03-12',45,45,0,1125,1051,567,484,0,0.9342::numeric,93.42::numeric,25,14,11,0),
    ('term1_2026','non_sen',date '2026-01-03',date '2026-03-12',45,45,0,1080,1036,552,484,0,0.9593::numeric,95.93::numeric,24,13,11,0)
),
actual as (
  select
    e.period_key,
    e.population_key,
    (facts #>> '{summary,scheduled_school_days}')::int as scheduled_school_days,
    (facts #>> '{summary,registers_completed}')::int as registers_completed,
    (facts #>> '{summary,registers_missing}')::int as registers_missing,
    (facts #>> '{summary,possible_attendance}')::int as possible_attendance,
    (facts #>> '{summary,cumulative_total}')::int as cumulative_total,
    (facts #>> '{summary,cumulative_male}')::int as cumulative_male,
    (facts #>> '{summary,cumulative_female}')::int as cumulative_female,
    (facts #>> '{summary,cumulative_unknown_gender}')::int as cumulative_unknown_gender,
    (facts #>> '{summary,average_attendance}')::numeric as average_attendance,
    (facts #>> '{summary,attendance_percentage}')::numeric as attendance_percentage,
    (facts #>> '{roster,pupils_seen}')::int as pupils_seen,
    (facts #>> '{roster,male_pupils}')::int as male_pupils,
    (facts #>> '{roster,female_pupils}')::int as female_pupils,
    (facts #>> '{roster,gender_unknown_pupils}')::int as gender_unknown_pupils
  from expected e
  cross join target t
  cross join lateral attendance.reporting_class_period_facts(
    t.class_id,
    e.start_date,
    e.end_date,
    e.population_key
  ) facts
)
select
  'shared_reporting_fixture' as check_name,
  e.period_key,
  e.population_key,
  jsonb_build_object(
    'scheduled_school_days',e.scheduled_school_days,
    'registers_completed',e.registers_completed,
    'registers_missing',e.registers_missing,
    'possible_attendance',e.possible_attendance,
    'cumulative_total',e.cumulative_total,
    'cumulative_male',e.cumulative_male,
    'cumulative_female',e.cumulative_female,
    'cumulative_unknown_gender',e.cumulative_unknown_gender,
    'average_attendance',e.average_attendance,
    'attendance_percentage',e.attendance_percentage,
    'pupils_seen',e.pupils_seen,
    'male_pupils',e.male_pupils,
    'female_pupils',e.female_pupils,
    'gender_unknown_pupils',e.gender_unknown_pupils
  ) as expected,
  to_jsonb(a)-'period_key'-'population_key' as actual
from expected e
left join actual a using(period_key,population_key)
where a.period_key is null
   or jsonb_build_object(
        'scheduled_school_days',e.scheduled_school_days,
        'registers_completed',e.registers_completed,
        'registers_missing',e.registers_missing,
        'possible_attendance',e.possible_attendance,
        'cumulative_total',e.cumulative_total,
        'cumulative_male',e.cumulative_male,
        'cumulative_female',e.cumulative_female,
        'cumulative_unknown_gender',e.cumulative_unknown_gender,
        'average_attendance',e.average_attendance,
        'attendance_percentage',e.attendance_percentage,
        'pupils_seen',e.pupils_seen,
        'male_pupils',e.male_pupils,
        'female_pupils',e.female_pupils,
        'gender_unknown_pupils',e.gender_unknown_pupils
      )
      is distinct from
      (to_jsonb(a)-'period_key'-'population_key');
