-- SR Lumapas Attendance Phase 4B1
-- Shared reporting calculation model with explicit reporting populations.
-- Repository source only at this checkpoint: do NOT apply to live Supabase until
-- the PR is fully verified and separately approved.
--
-- Population keys:
--   whole_class = every active date-eligible enrolment.
--   non_sen     = active date-eligible enrolments where include_in_class_stats=true.
--
-- Compatibility:
--   Existing public reporting RPC signatures remain in place and continue to
--   return Whole-Class results. Population-aware cleanup v1.0 callers use the
--   uniquely named *_v2 RPCs. This avoids Data API function overloading.

create or replace function attendance.reporting_class_period_facts(
  p_class_id uuid,
  p_start_date date,
  p_end_date date,
  p_population text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_population text := lower(btrim(coalesce(p_population,'')));
  v_class attendance.classes%rowtype;
  v_result jsonb;
begin
  if p_class_id is null or p_start_date is null or p_end_date is null then
    raise exception 'Class, start date and end date are required';
  end if;
  if v_population not in ('whole_class','non_sen') then
    raise exception 'Reporting population must be whole_class or non_sen';
  end if;

  select * into v_class
  from attendance.classes
  where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;

  with school_days as (
    select cd.calendar_date as attendance_date
    from attendance.calendar_dates cd
    where cd.academic_year_id=v_class.academic_year_id
      and cd.calendar_date between p_start_date and p_end_date
      and cd.is_school_day
  ),
  eligible as (
    select
      sd.attendance_date,
      e.id as enrolment_id,
      e.student_id,
      coalesce(s.gender,'') as gender
    from school_days sd
    join attendance.enrolments e
      on e.class_id=p_class_id
     and e.active
     and e.start_date<=sd.attendance_date
     and (e.end_date is null or e.end_date>=sd.attendance_date)
     and (v_population='whole_class' or e.include_in_class_stats)
    join attendance.students s
      on s.id=e.student_id
     and s.active
  ),
  marked as (
    select
      el.attendance_date,
      el.enrolment_id,
      el.student_id,
      el.gender,
      ar.status_code,
      coalesce(ac.counts_as_present,false) as counts_as_attendance,
      (dr.id is not null) as register_exists
    from eligible el
    left join attendance.daily_registers dr
      on dr.class_id=p_class_id
     and dr.attendance_date=el.attendance_date
    left join attendance.attendance_records ar
      on ar.daily_register_id=dr.id
     and ar.enrolment_id=el.enrolment_id
    left join attendance.attendance_codes ac
      on ac.code=ar.status_code
  ),
  daily as (
    select
      sd.attendance_date,
      count(el.enrolment_id)::int as eligible_students,
      count(*) filter(where m.counts_as_attendance)::int as total_attendance,
      count(*) filter(where m.gender='Male' and m.counts_as_attendance)::int as male_attendance,
      count(*) filter(where m.gender='Female' and m.counts_as_attendance)::int as female_attendance,
      count(*) filter(where m.gender not in('Male','Female') and m.counts_as_attendance)::int as unknown_gender_attendance,
      count(*) filter(where m.status_code is null and m.register_exists)::int as unmarked_students,
      exists(
        select 1
        from attendance.daily_registers dr2
        where dr2.class_id=p_class_id
          and dr2.attendance_date=sd.attendance_date
      ) as register_exists
    from school_days sd
    left join eligible el on el.attendance_date=sd.attendance_date
    left join marked m
      on m.attendance_date=sd.attendance_date
     and m.enrolment_id=el.enrolment_id
    group by sd.attendance_date
  ),
  running as (
    select
      d.*,
      sum(case when d.register_exists then d.male_attendance else 0 end)
        over(order by d.attendance_date)::int as cumulative_male,
      sum(case when d.register_exists then d.female_attendance else 0 end)
        over(order by d.attendance_date)::int as cumulative_female,
      sum(case when d.register_exists then d.unknown_gender_attendance else 0 end)
        over(order by d.attendance_date)::int as cumulative_unknown_gender,
      sum(case when d.register_exists then d.total_attendance else 0 end)
        over(order by d.attendance_date)::int as cumulative_total
    from daily d
  ),
  overall as (
    select
      count(*)::int as scheduled_school_days,
      count(*) filter(where register_exists)::int as school_days,
      coalesce(sum(eligible_students) filter(where register_exists),0)::int as possible_attendance,
      coalesce(sum(total_attendance) filter(where register_exists),0)::int as cumulative_total,
      coalesce(sum(male_attendance) filter(where register_exists),0)::int as cumulative_male,
      coalesce(sum(female_attendance) filter(where register_exists),0)::int as cumulative_female,
      coalesce(sum(unknown_gender_attendance) filter(where register_exists),0)::int as cumulative_unknown_gender,
      count(*) filter(where register_exists)::int as registers_completed,
      count(*) filter(where not register_exists)::int as registers_missing,
      coalesce(sum(unmarked_students),0)::int as unmarked_students
    from daily
  ),
  monthly as (
    select
      date_trunc('month',attendance_date)::date as month_start,
      count(*)::int as scheduled_school_days,
      count(*) filter(where register_exists)::int as school_days,
      coalesce(sum(eligible_students) filter(where register_exists),0)::int as possible_attendance,
      coalesce(sum(total_attendance) filter(where register_exists),0)::int as cumulative_total,
      coalesce(sum(male_attendance) filter(where register_exists),0)::int as cumulative_male,
      coalesce(sum(female_attendance) filter(where register_exists),0)::int as cumulative_female,
      count(*) filter(where register_exists)::int as registers_completed,
      count(*) filter(where not register_exists)::int as registers_missing
    from daily
    group by date_trunc('month',attendance_date)::date
  ),
  roster as (
    select
      count(distinct e.student_id)::int as pupils_seen,
      count(distinct e.student_id) filter(where s.gender='Male')::int as male_pupils,
      count(distinct e.student_id) filter(where s.gender='Female')::int as female_pupils,
      count(distinct e.student_id)
        filter(where s.gender is null or s.gender not in('Male','Female'))::int
        as gender_unknown_pupils
    from attendance.enrolments e
    join attendance.students s
      on s.id=e.student_id
     and s.active
    where e.class_id=p_class_id
      and e.active
      and e.start_date<=p_end_date
      and (e.end_date is null or e.end_date>=p_start_date)
      and (v_population='whole_class' or e.include_in_class_stats)
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'school_days',o.school_days,
      'scheduled_school_days',o.scheduled_school_days,
      'possible_attendance',o.possible_attendance,
      'cumulative_male',o.cumulative_male,
      'cumulative_female',o.cumulative_female,
      'cumulative_unknown_gender',o.cumulative_unknown_gender,
      'cumulative_total',o.cumulative_total,
      'average_attendance',case
        when o.possible_attendance>0
        then round(o.cumulative_total::numeric/o.possible_attendance,4)
        else null
      end,
      'attendance_percentage',case
        when o.possible_attendance>0
        then round((o.cumulative_total::numeric/o.possible_attendance)*100,2)
        else null
      end,
      'registers_completed',o.registers_completed,
      'registers_missing',o.registers_missing,
      'unmarked_students',o.unmarked_students
    ),
    'roster',jsonb_build_object(
      'pupils_seen',r.pupils_seen,
      'male_pupils',r.male_pupils,
      'female_pupils',r.female_pupils,
      'gender_unknown_pupils',r.gender_unknown_pupils,
      'gender_complete',(r.gender_unknown_pupils=0)
    ),
    'months',coalesce((
      select jsonb_agg(jsonb_build_object(
        'month',to_char(m.month_start,'YYYY-MM'),
        'school_days',m.school_days,
        'scheduled_school_days',m.scheduled_school_days,
        'possible_attendance',m.possible_attendance,
        'cumulative_male',m.cumulative_male,
        'cumulative_female',m.cumulative_female,
        'cumulative_total',m.cumulative_total,
        'average_attendance',case
          when m.possible_attendance>0
          then round(m.cumulative_total::numeric/m.possible_attendance,4)
          else null
        end,
        'attendance_percentage',case
          when m.possible_attendance>0
          then round((m.cumulative_total::numeric/m.possible_attendance)*100,2)
          else null
        end,
        'registers_completed',m.registers_completed,
        'registers_missing',m.registers_missing
      ) order by m.month_start)
      from monthly m
    ),'[]'::jsonb),
    'daily',coalesce((
      select jsonb_agg(jsonb_build_object(
        'date',rr.attendance_date,
        'eligible_students',rr.eligible_students,
        'register_exists',rr.register_exists,
        'male_attendance',rr.male_attendance,
        'female_attendance',rr.female_attendance,
        'unknown_gender_attendance',rr.unknown_gender_attendance,
        'total_attendance',rr.total_attendance,
        'cumulative_male',rr.cumulative_male,
        'cumulative_female',rr.cumulative_female,
        'cumulative_unknown_gender',rr.cumulative_unknown_gender,
        'cumulative_total',rr.cumulative_total,
        'unmarked_students',rr.unmarked_students
      ) order by rr.attendance_date)
      from running rr
    ),'[]'::jsonb)
  ) into v_result
  from overall o
  cross join roster r;

  return v_result;
end;
$function$;

revoke all on function attendance.reporting_class_period_facts(uuid,date,date,text)
from public, anon, authenticated, service_role;

create or replace function public.attendance_monthly_class_stats_v2(
  p_class_id uuid,
  p_month date,
  p_population text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_population text := lower(btrim(coalesce(p_population,'')));
  v_month_start date;
  v_month_end date;
  v_effective_end date;
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_facts jsonb;
  v_summary jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_class_id is null or p_month is null then raise exception 'Class and month are required'; end if;
  if v_population not in ('whole_class','non_sen') then
    raise exception 'Reporting population must be whole_class or non_sen';
  end if;
  if not attendance.can_access_class(p_class_id) then
    raise exception 'You do not have access to this class';
  end if;

  select * into v_class from attendance.classes where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;
  select * into v_year from attendance.academic_years where id=v_class.academic_year_id;

  v_month_start := date_trunc('month',p_month)::date;
  v_month_end := (date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  if v_month_end < v_year.start_date or v_month_start > v_year.end_date then
    raise exception 'Month is outside the class academic year';
  end if;
  v_effective_end := least(v_month_end,v_year.end_date,v_today);

  v_facts := attendance.reporting_class_period_facts(
    p_class_id,
    greatest(v_month_start,v_year.start_date),
    v_effective_end,
    v_population
  );
  v_summary := (v_facts->'summary') || jsonb_build_object(
    'provisional',(
      coalesce((v_facts #>> '{summary,registers_missing}')::integer,0)>0
      or v_effective_end<v_month_end
    )
  );

  return jsonb_build_object(
    'class',jsonb_build_object(
      'id',v_class.id,
      'class_code',v_class.class_code,
      'class_name',v_class.class_name,
      'year_level',v_class.year_level,
      'year_no',v_year.year_no
    ),
    'month',to_char(v_month_start,'YYYY-MM'),
    'as_of_date',v_effective_end,
    'population',v_population,
    'summary',v_summary,
    'roster',jsonb_build_object(
      'pupils_seen_in_month',coalesce((v_facts #>> '{roster,pupils_seen}')::integer,0),
      'male_pupils',coalesce((v_facts #>> '{roster,male_pupils}')::integer,0),
      'female_pupils',coalesce((v_facts #>> '{roster,female_pupils}')::integer,0),
      'gender_unknown_pupils',coalesce((v_facts #>> '{roster,gender_unknown_pupils}')::integer,0),
      'gender_complete',coalesce((v_facts #>> '{roster,gender_complete}')::boolean,false)
    ),
    'daily',coalesce(v_facts->'daily','[]'::jsonb)
  );
end;
$function$;

revoke all on function public.attendance_monthly_class_stats_v2(uuid,date,text)
from public, anon;
grant execute on function public.attendance_monthly_class_stats_v2(uuid,date,text)
to authenticated, service_role;

create or replace function public.attendance_class_period_report_v2(
  p_class_id uuid,
  p_period_type text,
  p_population text,
  p_term_id uuid default null,
  p_as_of_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_type text := lower(btrim(coalesce(p_period_type,'')));
  v_population text := lower(btrim(coalesce(p_population,'')));
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_term attendance.terms%rowtype;
  v_start date;
  v_end date;
  v_effective_end date;
  v_label text;
  v_facts jsonb;
  v_summary jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not attendance.can_access_class(p_class_id) then
    raise exception 'You do not have access to this class';
  end if;
  if v_type not in ('term','ytd') then
    raise exception 'Period type must be term or ytd';
  end if;
  if v_population not in ('whole_class','non_sen') then
    raise exception 'Reporting population must be whole_class or non_sen';
  end if;

  select * into v_class from attendance.classes where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;
  select * into v_year from attendance.academic_years where id=v_class.academic_year_id;

  if v_type='term' then
    if p_term_id is null then raise exception 'Term is required'; end if;
    select * into v_term
    from attendance.terms
    where id=p_term_id and academic_year_id=v_year.id;
    if not found then raise exception 'Term not found for this academic year'; end if;
    v_start := v_term.start_date;
    v_end := v_term.end_date;
    v_label := v_term.term_name;
  else
    v_start := v_year.start_date;
    v_end := least(coalesce(p_as_of_date,v_today),v_year.end_date,v_today);
    if v_end < v_start then v_end := v_start; end if;
    v_label := 'YTD '||v_year.year_no::text;
  end if;

  v_effective_end := least(v_end,v_today,v_year.end_date);
  v_facts := attendance.reporting_class_period_facts(
    p_class_id,
    v_start,
    v_effective_end,
    v_population
  );
  v_summary := (v_facts->'summary') || jsonb_build_object(
    'provisional',(
      coalesce((v_facts #>> '{summary,registers_missing}')::integer,0)>0
      or v_effective_end<v_end
    )
  );

  return jsonb_build_object(
    'class',jsonb_build_object(
      'id',v_class.id,
      'class_code',v_class.class_code,
      'class_name',v_class.class_name,
      'year_level',v_class.year_level,
      'year_no',v_year.year_no
    ),
    'period',jsonb_build_object(
      'type',v_type,
      'label',v_label,
      'start_date',v_start,
      'end_date',v_end,
      'as_of_date',v_effective_end,
      'term_id',case when v_type='term' then v_term.id else null end
    ),
    'population',v_population,
    'summary',v_summary,
    'roster',v_facts->'roster',
    'months',coalesce(v_facts->'months','[]'::jsonb),
    'daily',coalesce(v_facts->'daily','[]'::jsonb)
  );
end;
$function$;

revoke all on function public.attendance_class_period_report_v2(uuid,text,text,uuid,date)
from public, anon;
grant execute on function public.attendance_class_period_report_v2(uuid,text,text,uuid,date)
to authenticated, service_role;

create or replace function public.attendance_admin_school_dashboard_v2(
  p_school_id uuid,
  p_month date,
  p_population text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_population text := lower(btrim(coalesce(p_population,'')));
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_month_start date;
  v_month_end date;
  v_year attendance.academic_years%rowtype;
  v_latest_school_day date;
  v_class record;
  v_stats jsonb;
  v_latest_row jsonb;
  v_classes jsonb := '[]'::jsonb;
  v_latest_items jsonb := '[]'::jsonb;
  v_total_cumulative integer := 0;
  v_total_possible integer := 0;
  v_total_completed integer := 0;
  v_total_missing integer := 0;
  v_gender_incomplete integer := 0;
  v_class_count integer := 0;
  v_latest_completed integer := 0;
  v_latest_missing integer := 0;
  v_latest_attendance integer;
  v_latest_eligible integer;
  v_latest_exists boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or p_month is null then raise exception 'School and month are required'; end if;
  if v_population not in ('whole_class','non_sen') then
    raise exception 'Reporting population must be whole_class or non_sen';
  end if;
  if not attendance.is_school_admin(p_school_id) then
    raise exception 'School administrator access is required';
  end if;

  v_month_start := date_trunc('month',p_month)::date;
  v_month_end := (date_trunc('month',p_month)+interval '1 month - 1 day')::date;

  select ay.* into v_year
  from attendance.academic_years ay
  where ay.school_id=p_school_id
    and ay.active
    and ay.start_date<=v_month_end
    and ay.end_date>=v_month_start
  order by ay.year_no desc
  limit 1;
  if not found then raise exception 'No active academic year covers this month'; end if;

  select max(cd.calendar_date) into v_latest_school_day
  from attendance.calendar_dates cd
  where cd.academic_year_id=v_year.id
    and cd.is_school_day
    and cd.calendar_date between greatest(v_month_start,v_year.start_date)
                             and least(v_month_end,v_year.end_date,v_today);

  for v_class in
    select c.id,c.class_code,c.class_name,c.year_level
    from attendance.classes c
    where c.academic_year_id=v_year.id
      and c.active
    order by c.year_level,c.class_code
  loop
    v_class_count := v_class_count+1;
    v_stats := public.attendance_monthly_class_stats_v2(
      v_class.id,
      v_month_start,
      v_population
    );

    v_total_cumulative := v_total_cumulative
      + coalesce((v_stats #>> '{summary,cumulative_total}')::integer,0);
    v_total_possible := v_total_possible
      + coalesce((v_stats #>> '{summary,possible_attendance}')::integer,0);
    v_total_completed := v_total_completed
      + coalesce((v_stats #>> '{summary,registers_completed}')::integer,0);
    v_total_missing := v_total_missing
      + coalesce((v_stats #>> '{summary,registers_missing}')::integer,0);
    if coalesce((v_stats #>> '{roster,gender_complete}')::boolean,false)=false then
      v_gender_incomplete := v_gender_incomplete+1;
    end if;

    v_classes := v_classes || jsonb_build_array(jsonb_build_object(
      'class_id',v_class.id,
      'class_code',v_class.class_code,
      'class_name',v_class.class_name,
      'year_level',v_class.year_level,
      'pupils',coalesce((v_stats #>> '{roster,pupils_seen_in_month}')::integer,0),
      'gender_complete',coalesce((v_stats #>> '{roster,gender_complete}')::boolean,false),
      'gender_unknown_pupils',coalesce((v_stats #>> '{roster,gender_unknown_pupils}')::integer,0),
      'registers_completed',coalesce((v_stats #>> '{summary,registers_completed}')::integer,0),
      'registers_missing',coalesce((v_stats #>> '{summary,registers_missing}')::integer,0),
      'possible_attendance',coalesce((v_stats #>> '{summary,possible_attendance}')::integer,0),
      'cumulative_total',coalesce((v_stats #>> '{summary,cumulative_total}')::integer,0),
      'average_attendance',case
        when (v_stats #>> '{summary,average_attendance}') is null then null
        else (v_stats #>> '{summary,average_attendance}')::numeric
      end,
      'attendance_percentage',case
        when (v_stats #>> '{summary,attendance_percentage}') is null then null
        else (v_stats #>> '{summary,attendance_percentage}')::numeric
      end,
      'provisional',coalesce((v_stats #>> '{summary,provisional}')::boolean,true)
    ));

    if v_latest_school_day is not null then
      v_latest_row := null;
      select item into v_latest_row
      from jsonb_array_elements(coalesce(v_stats->'daily','[]'::jsonb)) as item
      where item->>'date'=v_latest_school_day::text
      limit 1;

      v_latest_exists := coalesce((v_latest_row->>'register_exists')::boolean,false);
      v_latest_eligible := coalesce((v_latest_row->>'eligible_students')::integer,0);
      v_latest_attendance := coalesce((v_latest_row->>'total_attendance')::integer,0);

      if v_latest_exists then
        v_latest_completed := v_latest_completed+1;
      else
        v_latest_missing := v_latest_missing+1;
      end if;

      v_latest_items := v_latest_items || jsonb_build_array(jsonb_build_object(
        'class_id',v_class.id,
        'class_code',v_class.class_code,
        'year_level',v_class.year_level,
        'register_exists',v_latest_exists,
        'eligible_students',v_latest_eligible,
        'attendance',v_latest_attendance
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'school_id',p_school_id,
    'year_no',v_year.year_no,
    'month',to_char(v_month_start,'YYYY-MM'),
    'as_of_date',least(v_month_end,v_year.end_date,v_today),
    'population',v_population,
    'summary',jsonb_build_object(
      'class_count',v_class_count,
      'registers_completed',v_total_completed,
      'registers_missing',v_total_missing,
      'cumulative_total',v_total_cumulative,
      'possible_attendance',v_total_possible,
      'average_attendance',case
        when v_total_possible>0
        then round(v_total_cumulative::numeric/v_total_possible,4)
        else null
      end,
      'attendance_percentage',case
        when v_total_possible>0
        then round((v_total_cumulative::numeric/v_total_possible)*100,2)
        else null
      end,
      'gender_incomplete_classes',v_gender_incomplete,
      'provisional',(
        v_total_missing>0
        or least(v_month_end,v_year.end_date,v_today)<v_month_end
      )
    ),
    'latest_school_day',jsonb_build_object(
      'date',v_latest_school_day,
      'classes_completed',v_latest_completed,
      'classes_missing',v_latest_missing,
      'classes',v_latest_items
    ),
    'classes',v_classes
  );
end;
$function$;

revoke all on function public.attendance_admin_school_dashboard_v2(uuid,date,text)
from public, anon;
grant execute on function public.attendance_admin_school_dashboard_v2(uuid,date,text)
to authenticated, service_role;

-- Legacy public RPCs remain stable Whole-Class compatibility wrappers.
create or replace function public.attendance_monthly_class_stats(
  p_class_id uuid,
  p_month date
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select public.attendance_monthly_class_stats_v2(
    p_class_id,
    p_month,
    'whole_class'
  ) - 'population';
$function$;

create or replace function public.attendance_class_period_report(
  p_class_id uuid,
  p_period_type text,
  p_term_id uuid default null,
  p_as_of_date date default null
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select public.attendance_class_period_report_v2(
    p_class_id,
    p_period_type,
    'whole_class',
    p_term_id,
    p_as_of_date
  ) - 'population';
$function$;

create or replace function public.attendance_admin_school_dashboard(
  p_school_id uuid,
  p_month date
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select public.attendance_admin_school_dashboard_v2(
    p_school_id,
    p_month,
    'whole_class'
  ) - 'population';
$function$;
