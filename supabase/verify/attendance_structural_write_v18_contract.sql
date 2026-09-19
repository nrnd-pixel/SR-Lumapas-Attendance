-- SR Lumapas Attendance Phase 5F1 structural-admin write-boundary verifier
-- Synthetic/local validation ONLY. No production identifiers, credentials, or exports.
--
-- PASS condition:
--   * every SELECT below returns zero rows;
--   * every DO block completes without raising;
--   * every synthetic DML exercise occurs inside a transaction that ROLLBACKs.

-- 1. Authenticated keeps RLS-scoped SELECT but loses all direct structural DML.
select 'structural_admin_table_privilege' as check_name, table_name as mismatch
from unnest(array[
  'attendance.academic_years',
  'attendance.calendar_dates',
  'attendance.classes',
  'attendance.schools',
  'attendance.settings',
  'attendance.terms'
]) table_name
where not has_table_privilege('authenticated',table_name,'SELECT')
   or has_table_privilege('authenticated',table_name,'INSERT')
   or has_table_privilege('authenticated',table_name,'UPDATE')
   or has_table_privilege('authenticated',table_name,'DELETE')
   or has_table_privilege('anon',table_name,'SELECT')
   or has_table_privilege('anon',table_name,'INSERT')
   or has_table_privilege('anon',table_name,'UPDATE')
   or has_table_privilege('anon',table_name,'DELETE')
   or not has_table_privilege('service_role',table_name,'SELECT')
   or not has_table_privilege('service_role',table_name,'INSERT')
   or not has_table_privilege('service_role',table_name,'UPDATE')
   or not has_table_privilege('service_role',table_name,'DELETE');

-- 2. Existing RLS policy inventory remains present; Phase 5F1 changes grants only.
with expected(table_name,policy_name) as (
  values
    ('academic_years','years_admin_delete'),
    ('academic_years','years_admin_insert'),
    ('academic_years','years_admin_update'),
    ('academic_years','years_read'),
    ('calendar_dates','calendar_admin_delete'),
    ('calendar_dates','calendar_admin_insert'),
    ('calendar_dates','calendar_admin_update'),
    ('calendar_dates','calendar_read'),
    ('classes','classes_admin_delete'),
    ('classes','classes_admin_insert'),
    ('classes','classes_admin_update'),
    ('classes','classes_read'),
    ('schools','schools_admin_update'),
    ('schools','schools_read'),
    ('settings','settings_admin_delete'),
    ('settings','settings_admin_insert'),
    ('settings','settings_admin_update'),
    ('settings','settings_read'),
    ('terms','terms_admin_delete'),
    ('terms','terms_admin_insert'),
    ('terms','terms_admin_update'),
    ('terms','terms_read')
), actual as (
  select tablename as table_name,policyname as policy_name
  from pg_policies
  where schemaname='attendance'
    and tablename in ('academic_years','calendar_dates','classes','schools','settings','terms')
)
select 'structural_admin_policy_inventory' as check_name,
       coalesce(e.table_name,a.table_name)||':'||coalesce(e.policy_name,a.policy_name) as mismatch
from expected e
full join actual a using(table_name,policy_name)
where e.table_name is null or a.table_name is null;

-- 3. RLS stays enabled and the existing update-touch trigger inventory is unchanged.
with expected(table_name,trigger_name) as (
  values
    ('academic_years','attendance_years_touch'),
    ('calendar_dates','attendance_calendar_touch'),
    ('classes','attendance_classes_touch'),
    ('schools','attendance_schools_touch'),
    ('settings','attendance_settings_touch'),
    ('terms','attendance_terms_touch')
), actual as (
  select c.relname as table_name,t.tgname as trigger_name
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='attendance'
    and c.relname in ('academic_years','calendar_dates','classes','schools','settings','terms')
    and not t.tgisinternal
)
select 'structural_admin_trigger_inventory' as check_name,
       coalesce(e.table_name,a.table_name)||':'||coalesce(e.trigger_name,a.trigger_name) as mismatch
from expected e
full join actual a using(table_name,trigger_name)
where e.table_name is null or a.table_name is null
union all
select 'structural_admin_rls_enabled',c.relname
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='attendance'
  and c.relname in ('academic_years','calendar_dates','classes','schools','settings','terms')
  and c.relkind='r'
  and not c.relrowsecurity;

-- 4. No controlled structural writer RPC is introduced implicitly in Phase 5F1.
-- Future rollover/structural administration must be designed as a separate checkpoint.
select 'structural_admin_unexpected_writer_function' as check_name,
       n.nspname||'.'||p.proname as mismatch
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','attendance','attendance_private')
  and p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+attendance[.](academic_years|calendar_dates|classes|schools|settings|terms)([^a-z_]|$)';

-- 5. Even a valid school administrator cannot bypass the future controlled boundary.
-- Use zero-row statements so a verifier failure cannot mutate fixture structure.
begin;

set local role authenticated;

do $phase5f1_direct_dml$
declare
  v_table text;
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  foreach v_table in array array[
    'academic_years',
    'calendar_dates',
    'classes',
    'schools',
    'settings',
    'terms'
  ]
  loop
    v_blocked := false;
    begin
      execute format(
        'insert into attendance.%I select * from attendance.%I where false',
        v_table,
        v_table
      );
    exception when insufficient_privilege then
      v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'Direct authenticated % INSERT was not blocked',v_table;
    end if;

    v_blocked := false;
    begin
      execute format(
        'update attendance.%I set updated_at=updated_at where false',
        v_table
      );
    exception when insufficient_privilege then
      v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'Direct authenticated % UPDATE was not blocked',v_table;
    end if;

    v_blocked := false;
    begin
      execute format(
        'delete from attendance.%I where false',
        v_table
      );
    exception when insufficient_privilege then
      v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'Direct authenticated % DELETE was not blocked',v_table;
    end if;
  end loop;
end
$phase5f1_direct_dml$;

rollback;
