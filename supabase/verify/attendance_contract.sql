-- SR Lumapas Attendance backend contract verifier
-- Safe/non-mutating: reads PostgreSQL catalogs and reference tables only.
-- Run after loading the Phase 0B baseline plus all repository Attendance migrations.
--
-- PASS condition: every SELECT below returns zero rows.

-- 1. Exact Attendance table set
with expected(name) as (
  select unnest(array['attendance.schools','attendance.academic_years','attendance.terms','attendance.classes','attendance.students','attendance.enrolments','attendance.attendance_codes','attendance.absence_reasons','attendance.calendar_dates','attendance.settings','attendance.teacher_school_memberships','attendance.teacher_class_assignments','attendance.teacher_signup_requests','attendance.daily_registers','attendance.attendance_records','attendance.student_movements','attendance_private.attendance_record_audit','attendance_private.teacher_access_audit']::text[])
),
actual(name) as (
  select n.nspname || '.' || c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('attendance','attendance_private')
    and c.relkind in ('r','p')
)
select 'table_set' as check_name, coalesce(e.name,a.name) as mismatch
from expected e
full join actual a using(name)
where e.name is null or a.name is null;

-- 2. Exact public Attendance RPC signatures / return types / SECURITY DEFINER modes
with expected(name, identity_args, result_type, security_definer) as (
  values
    ('attendance_admin_move_class', 'p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text', 'jsonb', true),
    ('attendance_admin_review_teacher_request', 'p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text', 'jsonb', true),
    ('attendance_admin_school_dashboard', 'p_school_id uuid, p_month date', 'jsonb', true),
    ('attendance_admin_school_dashboard_v2', 'p_school_id uuid, p_month date, p_population text', 'jsonb', true),
    ('attendance_admin_set_teacher_active', 'p_user_id uuid, p_school_id uuid, p_active boolean', 'jsonb', true),
    ('attendance_admin_student_roster', 'p_school_id uuid', 'jsonb', false),
    ('attendance_admin_teacher_requests', 'p_status text', 'jsonb', true),
    ('attendance_admin_teachers', '', 'jsonb', true),
    ('attendance_admin_transfer_in', 'p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text, p_include_in_class_stats boolean, p_remarks text', 'jsonb', true),
    ('attendance_admin_transfer_out', 'p_enrolment_id uuid, p_last_date date, p_remarks text', 'jsonb', true),
    ('attendance_bootstrap', '', 'jsonb', false),
    ('attendance_class_period_report', 'p_class_id uuid, p_period_type text, p_term_id uuid, p_as_of_date date', 'jsonb', true),
    ('attendance_class_period_report_v2', 'p_class_id uuid, p_period_type text, p_population text, p_term_id uuid, p_as_of_date date', 'jsonb', true),
    ('attendance_class_report_options', 'p_class_id uuid', 'jsonb', true),
    ('attendance_load_register', 'p_class_id uuid, p_date date', 'jsonb', false),
    ('attendance_monthly_class_stats', 'p_class_id uuid, p_month date', 'jsonb', true),
    ('attendance_monthly_class_stats_v2', 'p_class_id uuid, p_month date, p_population text', 'jsonb', true),
    ('attendance_save_register', 'p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text', 'jsonb', true),
    ('attendance_signup_options', '', 'jsonb', true),
    ('attendance_submit_teacher_request', 'p_full_name text, p_requested_class_id uuid, p_requested_role text', 'jsonb', true),
    ('attendance_teacher_status', '', 'jsonb', true)
),
actual as (
  select
    p.proname as name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'attendance\_%' escape '\'
)
select
  'rpc_signature' as check_name,
  coalesce(e.name,a.name) || ' expected=(' ||
    coalesce(e.identity_args,'<missing>') || '; ' ||
    coalesce(e.result_type,'<missing>') || '; secdef=' ||
    coalesce(e.security_definer::text,'<missing>') ||
  ') actual=(' ||
    coalesce(a.identity_args,'<missing>') || '; ' ||
    coalesce(a.result_type,'<missing>') || '; secdef=' ||
    coalesce(a.security_definer::text,'<missing>') || ')' as mismatch
from expected e
full join actual a using(name)
where e.name is null
   or a.name is null
   or e.identity_args is distinct from a.identity_args
   or e.result_type is distinct from a.result_type
   or e.security_definer is distinct from a.security_definer;

-- 3. Every public frontend RPC is executable by authenticated
select 'rpc_authenticated_execute' as check_name,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as mismatch
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname like 'attendance\_%' escape '\'
  and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

-- 4. Only signup-options is executable by anon
select 'unexpected_anon_rpc' as check_name,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as mismatch
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname like 'attendance\_%' escape '\'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.proname <> 'attendance_signup_options';

select 'signup_options_missing_anon_execute' as check_name,
       'attendance_signup_options' as mismatch
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='attendance_signup_options'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
);

-- 5. Expected RLS-enabled table set
with expected(name) as (
  select unnest(array['attendance.absence_reasons','attendance.academic_years','attendance.attendance_codes','attendance.attendance_records','attendance.calendar_dates','attendance.classes','attendance.daily_registers','attendance.enrolments','attendance.schools','attendance.settings','attendance.student_movements','attendance.students','attendance.teacher_class_assignments','attendance.teacher_school_memberships','attendance.teacher_signup_requests','attendance.terms','attendance_private.teacher_access_audit']::text[])
),
actual(name) as (
  select n.nspname || '.' || c.relname
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('attendance','attendance_private')
    and c.relkind in ('r','p')
    and c.relrowsecurity
)
select 'rls_enabled_set' as check_name, coalesce(e.name,a.name) as mismatch
from expected e
full join actual a using(name)
where e.name is null or a.name is null;

-- 6. Private audit history table remains outside authenticated client access
select 'private_audit_client_access' as check_name,
       'attendance_private.attendance_record_audit' as mismatch
where has_table_privilege('authenticated', 'attendance_private.attendance_record_audit', 'SELECT')
   or has_table_privilege('authenticated', 'attendance_private.attendance_record_audit', 'INSERT')
   or has_table_privilege('authenticated', 'attendance_private.attendance_record_audit', 'UPDATE')
   or has_table_privilege('authenticated', 'attendance_private.attendance_record_audit', 'DELETE');

-- 7. Audit trigger exists
select 'attendance_audit_trigger' as check_name, 'missing attendance_record_audit' as mismatch
where not exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='attendance'
    and c.relname='attendance_records'
    and t.tgname='attendance_record_audit'
    and not t.tgisinternal
);

-- 8. Phase 5B direct register-write boundary: authenticated keeps read access
-- but cannot bypass attendance_save_register with direct INSERT/UPDATE/DELETE.
select 'register_write_boundary' as check_name, x.table_name as mismatch
from (values
  ('attendance.daily_registers'::text),
  ('attendance.attendance_records'::text)
) x(table_name)
where not has_table_privilege('authenticated', x.table_name, 'SELECT')
   or has_table_privilege('authenticated', x.table_name, 'INSERT')
   or has_table_privilege('authenticated', x.table_name, 'UPDATE')
   or has_table_privilege('authenticated', x.table_name, 'DELETE');

-- 8b. Phase 5C student-movement write boundary: authenticated keeps read access
-- but cannot bypass the three admin movement RPCs with direct table DML.
select 'student_movement_write_boundary' as check_name, x.table_name as mismatch
from (values
  ('attendance.students'::text),
  ('attendance.enrolments'::text),
  ('attendance.student_movements'::text)
) x(table_name)
where not has_table_privilege('authenticated', x.table_name, 'SELECT')
   or has_table_privilege('authenticated', x.table_name, 'INSERT')
   or has_table_privilege('authenticated', x.table_name, 'UPDATE')
   or has_table_privilege('authenticated', x.table_name, 'DELETE');

-- 9. Exact non-sensitive reference-code sets
with expected(code) as (
  select unnest(array['P','PP','A','L','PM','TM','T','SS','D','X','SP','W','Q']::text[])
),
actual(code) as (
  select code from attendance.attendance_codes
)
select 'attendance_code_set' as check_name, coalesce(e.code,a.code) as mismatch
from expected e
full join actual a using(code)
where e.code is null or a.code is null;

with expected(code) as (
  select unnest(array['NONE','MEDICAL','FAMILY','OFFICIAL','PERMISSION','OTHER']::text[])
),
actual(code) as (
  select code from attendance.absence_reasons
)
select 'absence_reason_set' as check_name, coalesce(e.code,a.code) as mismatch
from expected e
full join actual a using(code)
where e.code is null or a.code is null;

select 'other_reason_requires_note' as check_name, code as mismatch
from attendance.absence_reasons
where code='OTHER' and requires_note is not true;

-- 10. Save-register correction safeguards remain in source
with f as (
  select pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='attendance_save_register'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text'
)
select 'save_register_correction_semantics' as check_name,
       'expected source marker missing' as mismatch
from f
where position('Correction reason is required when changing a saved attendance register' in def)=0
   or position('correction_count = correction_count + 1' in def)=0
   or position('attendance.correction_reason' in def)=0
   or position('no_changes' in def)=0;

-- 11. Phase 4B1 internal shared reporting engine exists, is invoker-mode,
-- and is not directly executable by client roles.
with f as (
  select p.oid,
         pg_get_function_identity_arguments(p.oid) as identity_args,
         pg_get_function_result(p.oid) as result_type,
         p.prosecdef as security_definer,
         p.provolatile,
         pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='attendance'
    and p.proname='reporting_class_period_facts'
)
select 'reporting_shared_engine_contract' as check_name,
       'missing or invalid attendance.reporting_class_period_facts' as mismatch
where not exists (
  select 1 from f
  where identity_args='p_class_id uuid, p_start_date date, p_end_date date, p_population text'
    and result_type='jsonb'
    and security_definer=false
    and provolatile='s'
    and position('include_in_class_stats' in def)>0
    and position('register_exists' in def)>0
    and position('possible_attendance' in def)>0
    and position('whole_class' in def)>0
    and position('non_sen' in def)>0
    and not has_function_privilege('authenticated',oid,'EXECUTE')
    and not has_function_privilege('service_role',oid,'EXECUTE')
    and not has_function_privilege('anon',oid,'EXECUTE')
);

-- 12. Population-aware public reporting RPCs delegate to the shared model while
-- retaining their existing authorization boundaries.
with f as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'attendance_monthly_class_stats_v2',
      'attendance_admin_school_dashboard_v2',
      'attendance_class_period_report_v2'
    )
)
select 'reporting_v2_semantics' as check_name, proname as mismatch
from f
where position('auth.uid()' in def)=0
   or position('whole_class' in def)=0
   or position('non_sen' in def)=0
   or position('Reporting population must be whole_class or non_sen' in def)=0
   or (
     proname in ('attendance_monthly_class_stats_v2','attendance_class_period_report_v2')
     and (
       position('attendance.can_access_class' in def)=0
       or position('attendance.reporting_class_period_facts' in def)=0
     )
   )
   or (
     proname='attendance_admin_school_dashboard_v2'
     and (
       position('attendance.is_school_admin' in def)=0
       or position('attendance_monthly_class_stats_v2' in def)=0
     )
   );

-- 13. Legacy reporting RPCs remain Whole-Class wrappers so v0.7/current callers
-- keep the old signatures and do not receive the new population field.
with f as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'attendance_monthly_class_stats',
      'attendance_admin_school_dashboard',
      'attendance_class_period_report'
    )
)
select 'legacy_reporting_wrapper' as check_name, proname as mismatch
from f
where position('whole_class' in def)=0
   or position('population' in def)=0
   or (
     proname='attendance_monthly_class_stats'
     and position('attendance_monthly_class_stats_v2' in def)=0
   )
   or (
     proname='attendance_admin_school_dashboard'
     and position('attendance_admin_school_dashboard_v2' in def)=0
   )
   or (
     proname='attendance_class_period_report'
     and position('attendance_class_period_report_v2' in def)=0
   );
