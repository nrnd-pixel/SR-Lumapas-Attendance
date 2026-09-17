-- Phase 4B1V public reporting API compatibility verifier.
-- Safe/non-mutating: uses synthetic fixture IDs and calls STABLE reporting RPCs only.
-- PASS condition: every SELECT returns zero rows.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);

with actual as (
  select public.attendance_monthly_class_stats(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-02-01'
  ) as j
)
select 'legacy_monthly_whole_class' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 398
   or (j #>> '{summary,possible_attendance}')::int <> 425
   or (j #>> '{summary,registers_completed}')::int <> 17
   or (j #>> '{roster,pupils_seen_in_month}')::int <> 25
   or j ? 'population';

with actual as (
  select public.attendance_monthly_class_stats_v2(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-02-01',
    'non_sen'
  ) as j
)
select 'v2_monthly_non_sen' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 392
   or (j #>> '{summary,possible_attendance}')::int <> 408
   or (j #>> '{summary,registers_completed}')::int <> 17
   or (j #>> '{roster,pupils_seen_in_month}')::int <> 24
   or j->>'population' <> 'non_sen';

with actual as (
  select public.attendance_class_period_report(
    '00000000-0000-0000-0000-000000000004'::uuid,
    'term',
    '00000000-0000-0000-0000-000000000003'::uuid,
    null
  ) as j
)
select 'legacy_term_whole_class' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 1051
   or (j #>> '{summary,possible_attendance}')::int <> 1125
   or (j #>> '{summary,registers_completed}')::int <> 45
   or (j #>> '{roster,pupils_seen}')::int <> 25
   or j ? 'population';

with actual as (
  select public.attendance_class_period_report_v2(
    '00000000-0000-0000-0000-000000000004'::uuid,
    'term',
    'non_sen',
    '00000000-0000-0000-0000-000000000003'::uuid,
    null
  ) as j
)
select 'v2_term_non_sen' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 1036
   or (j #>> '{summary,possible_attendance}')::int <> 1080
   or (j #>> '{summary,registers_completed}')::int <> 45
   or (j #>> '{roster,pupils_seen}')::int <> 24
   or j->>'population' <> 'non_sen';

with actual as (
  select public.attendance_admin_school_dashboard(
    '00000000-0000-0000-0000-000000000001'::uuid,
    date '2026-02-01'
  ) as j
)
select 'legacy_dashboard_whole_class' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 398
   or (j #>> '{summary,possible_attendance}')::int <> 425
   or (j #>> '{summary,class_count}')::int <> 1
   or j ? 'population';

with actual as (
  select public.attendance_admin_school_dashboard_v2(
    '00000000-0000-0000-0000-000000000001'::uuid,
    date '2026-02-01',
    'non_sen'
  ) as j
)
select 'v2_dashboard_non_sen' as check_name, j
from actual
where (j #>> '{summary,cumulative_total}')::int <> 392
   or (j #>> '{summary,possible_attendance}')::int <> 408
   or (j #>> '{summary,class_count}')::int <> 1
   or j->>'population' <> 'non_sen';

rollback;
