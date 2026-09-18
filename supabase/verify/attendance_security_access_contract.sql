-- SR Lumapas Attendance Phase 5A security/access contract verifier
-- Synthetic/local validation ONLY. No production data or credentials.
--
-- Purpose:
--   Freeze the current authorization and privilege boundary before Phase 5
--   starts revoking direct authenticated DML or changing SECURITY DEFINER modes.
--
-- PASS condition:
--   * every SELECT below returns zero rows;
--   * every DO block completes without raising;
--   * all write exercises occur only inside transactions that ROLLBACK.

-- 1. Exact public Attendance RPC security-mode inventory.
with actual as (
  select
    count(*)::int as total,
    count(*) filter (where p.prosecdef)::int as security_definer,
    count(*) filter (where not p.prosecdef)::int as security_invoker
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'attendance\_%' escape '\'
)
select 'public_rpc_security_mode_inventory' as check_name, to_jsonb(actual) as mismatch
from actual
where total <> 21
   or security_definer <> 18
   or security_invoker <> 3;

-- 2. Public/anon/authenticated EXECUTE boundary.
with f as (
  select
    p.oid,
    p.proname,
    exists(
      select 1
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
      where x.grantee=0 and x.privilege_type='EXECUTE'
    ) as public_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'attendance\_%' escape '\'
)
select 'unexpected_public_execute' as check_name, proname as mismatch
from f
where public_execute
union all
select 'unexpected_anon_execute', proname
from f
where anon_execute and proname <> 'attendance_signup_options'
union all
select 'missing_signup_options_anon_execute', 'attendance_signup_options'
where not exists (
  select 1 from f
  where proname='attendance_signup_options' and anon_execute
)
union all
select 'missing_authenticated_execute', proname
from f
where not authenticated_execute
union all
select 'missing_service_role_execute', proname
from f
where not service_execute;

-- 3. Every exposed SECURITY DEFINER Attendance RPC fixes search_path.
select
  'security_definer_search_path' as check_name,
  p.proname as mismatch
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname like 'attendance\_%' escape '\'
  and p.prosecdef
  and not (
    coalesce(p.proconfig,'{}'::text[])
      @> array['search_path=""']::text[]
  );

-- 4. Security-definer authorization/delegation source markers.
with required(proname,marker) as (
  values
    ('attendance_admin_move_class','auth.uid()'),
    ('attendance_admin_move_class','attendance.is_school_admin'),
    ('attendance_admin_transfer_in','auth.uid()'),
    ('attendance_admin_transfer_in','attendance.is_school_admin'),
    ('attendance_admin_transfer_out','auth.uid()'),
    ('attendance_admin_transfer_out','attendance.is_school_admin'),
    ('attendance_admin_review_teacher_request','auth.uid()'),
    ('attendance_admin_review_teacher_request','attendance.is_school_admin'),
    ('attendance_admin_school_dashboard_v2','auth.uid()'),
    ('attendance_admin_school_dashboard_v2','attendance.is_school_admin'),
    ('attendance_admin_set_teacher_active','auth.uid()'),
    ('attendance_admin_set_teacher_active','attendance.is_school_admin'),
    ('attendance_admin_teacher_requests','auth.uid()'),
    ('attendance_admin_teacher_requests','attendance.is_school_admin'),
    ('attendance_admin_teachers','auth.uid()'),
    ('attendance_admin_teachers','attendance.is_school_admin'),
    ('attendance_class_period_report_v2','auth.uid()'),
    ('attendance_class_period_report_v2','attendance.can_access_class'),
    ('attendance_class_report_options','auth.uid()'),
    ('attendance_class_report_options','attendance.can_access_class'),
    ('attendance_monthly_class_stats_v2','auth.uid()'),
    ('attendance_monthly_class_stats_v2','attendance.can_access_class'),
    ('attendance_save_register','auth.uid()'),
    ('attendance_save_register','attendance.can_access_class'),
    ('attendance_submit_teacher_request','auth.uid()'),
    ('attendance_teacher_status','auth.uid()'),
    ('attendance_admin_school_dashboard','attendance_admin_school_dashboard_v2'),
    ('attendance_class_period_report','attendance_class_period_report_v2'),
    ('attendance_monthly_class_stats','attendance_monthly_class_stats_v2')
), defs as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
)
select 'security_definer_authorization_marker' as check_name,
       r.proname || ':' || r.marker as mismatch
from required r
left join defs d using(proname)
where d.proname is null
   or position(r.marker in d.def)=0;

-- 5. The anonymous signup-options RPC is the deliberate unauthenticated exception.
with f as (
  select pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='attendance_signup_options'
    and pg_get_function_identity_arguments(p.oid)=''
)
select 'signup_options_public_contract' as check_name, 'unexpected definition' as mismatch
from f
where position('SECURITY DEFINER' in def)=0
   or position('where s.active' in def)=0
   or position('and ay.active' in def)=0
   or position('and c.active' in def)=0
   or position('auth.uid()' in def)>0;

-- 6. Current authenticated direct-write surface is explicit and exact.
with expected(table_name,can_insert,can_update,can_delete) as (
  values
    ('academic_years',true,true,true),
    ('calendar_dates',true,true,true),
    ('classes',true,true,true),
    ('schools',false,true,false),
    ('settings',true,true,true),
    ('terms',true,true,true)
), actual as (
  select
    c.relname as table_name,
    has_table_privilege('authenticated',c.oid,'INSERT') as can_insert,
    has_table_privilege('authenticated',c.oid,'UPDATE') as can_update,
    has_table_privilege('authenticated',c.oid,'DELETE') as can_delete
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='attendance' and c.relkind='r'
    and (
      has_table_privilege('authenticated',c.oid,'INSERT')
      or has_table_privilege('authenticated',c.oid,'UPDATE')
      or has_table_privilege('authenticated',c.oid,'DELETE')
    )
)
select
  'authenticated_direct_write_surface' as check_name,
  coalesce(e.table_name,a.table_name) as mismatch
from expected e
full join actual a using(table_name)
where e.table_name is null
   or a.table_name is null
   or e.can_insert is distinct from a.can_insert
   or e.can_update is distinct from a.can_update
   or e.can_delete is distinct from a.can_delete;

-- 7. RLS and RPC-only/private tables remain explicit.
select 'attendance_table_without_rls' as check_name, c.relname as mismatch
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='attendance' and c.relkind='r' and not c.relrowsecurity
union all
select 'teacher_signup_requests_direct_privilege', privilege
from unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
where has_table_privilege('authenticated','attendance.teacher_signup_requests',privilege)
union all
select 'private_schema_client_usage', role_name
from unnest(array['anon','authenticated','service_role']) role_name
where has_schema_privilege(role_name,'attendance_private','USAGE')
union all
select 'private_audit_client_privilege',
       role_name || ':' || table_name || ':' || privilege
from unnest(array['anon','authenticated','service_role']) role_name
cross join unnest(array[
  'attendance_private.attendance_record_audit',
  'attendance_private.teacher_access_audit'
]) table_name
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
where has_table_privilege(role_name,table_name,privilege);

-- 8. The internal reporting engine remains unreachable by Data API client roles.
select
  'internal_reporting_engine_execute' as check_name,
  role_name as mismatch
from unnest(array['anon','authenticated','service_role']) role_name
where has_function_privilege(
  role_name,
  'attendance.reporting_class_period_facts(uuid,date,date,text)',
  'EXECUTE'
);

-- 9. Anonymous client: signup options succeeds; authenticated-only RPC is blocked.
begin;
set local role anon;
do $phase5a$
declare
  v_options jsonb;
  v_blocked boolean := false;
begin
  select public.attendance_signup_options() into v_options;
  if coalesce(v_options #>> '{schools,0,school_code}','') <> 'TEST-SRL' then
    raise exception 'Anonymous signup-options did not return the synthetic active school';
  end if;

  begin
    perform public.attendance_teacher_status();
  exception
    when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'anon unexpectedly executed attendance_teacher_status';
  end if;
end
$phase5a$;
rollback;

-- 10. Authenticated outsider: no class/admin access and no authorized status.
begin;
set local role authenticated;
do $phase5a$
declare
  v_status jsonb;
  v_blocked boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000101',
    true
  );

  select public.attendance_teacher_status() into v_status;
  if coalesce((v_status->>'authorized')::boolean,false) then
    raise exception 'Outsider unexpectedly authorized';
  end if;

  begin
    perform public.attendance_load_register(
      '00000000-0000-0000-0000-000000000004'::uuid,
      date '2026-02-02'
    );
  exception
    when others then
      if position('You do not have access to this class' in sqlerrm)>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly loaded assigned-class register';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_save_register(
      '00000000-0000-0000-0000-000000000004'::uuid,
      date '2026-04-01',
      '[]'::jsonb,
      null
    );
  exception
    when others then
      if position('You do not have access to this class' in sqlerrm)>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly saved assigned-class register';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_admin_student_roster(
      '00000000-0000-0000-0000-000000000001'::uuid
    );
  exception
    when others then
      if position('administrator access' in lower(sqlerrm))>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly called admin roster';
  end if;
end
$phase5a$;

select 'outsider_direct_class_visibility' as check_name, id::text as mismatch
from attendance.classes
where id='00000000-0000-0000-0000-000000000004'::uuid;
rollback;

-- 11. Assigned teacher: normal class RPC works; admin RPC remains blocked.
begin;
set local role authenticated;
do $phase5a$
declare
  v_status jsonb;
  v_register jsonb;
  v_blocked boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );

  select public.attendance_teacher_status() into v_status;
  if coalesce((v_status->>'authorized')::boolean,false) is not true then
    raise exception 'Assigned teacher was not authorized';
  end if;
  if jsonb_array_length(coalesce(v_status->'assignments','[]'::jsonb)) <> 1 then
    raise exception 'Assigned teacher did not receive exactly one class assignment';
  end if;
  if v_status #>> '{assignments,0,assignment_role}' <> 'teacher' then
    raise exception 'Current generic teacher assignment-role contract changed';
  end if;

  select public.attendance_load_register(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-02-02'
  ) into v_register;
  if v_register is null then
    raise exception 'Assigned teacher could not load register';
  end if;

  begin
    perform public.attendance_admin_student_roster(
      '00000000-0000-0000-0000-000000000001'::uuid
    );
  exception
    when others then
      if position('administrator access' in lower(sqlerrm))>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Assigned teacher unexpectedly called admin roster';
  end if;
end
$phase5a$;
rollback;

-- 12. Phase 5B closes direct authenticated register/record DML.
-- Exercise all three write verbs on both tables as the assigned teacher.
begin;
set local role authenticated;
do $phase5b$
declare
  v_register_id uuid;
  v_enrolment_id uuid;
  v_record_id uuid;
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );

  select id into v_register_id
  from attendance.daily_registers
  where class_id='00000000-0000-0000-0000-000000000004'::uuid
    and attendance_date=date '2026-02-02';

  select ar.id, ar.enrolment_id
    into v_record_id, v_enrolment_id
  from attendance.attendance_records ar
  where ar.daily_register_id=v_register_id
  order by ar.id
  limit 1;

  v_blocked := false;
  begin
    insert into attendance.daily_registers(
      class_id, attendance_date, status, started_by, updated_by
    ) values (
      '00000000-0000-0000-0000-000000000004'::uuid,
      date '2026-04-01',
      'draft',
      '00000000-0000-0000-0000-000000000100'::uuid,
      '00000000-0000-0000-0000-000000000100'::uuid
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated daily_registers INSERT was not blocked';
  end if;

  v_blocked := false;
  begin
    update attendance.daily_registers
    set status=status
    where id=v_register_id;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated daily_registers UPDATE was not blocked';
  end if;

  v_blocked := false;
  begin
    delete from attendance.daily_registers where id=v_register_id;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated daily_registers DELETE was not blocked';
  end if;

  v_blocked := false;
  begin
    insert into attendance.attendance_records(
      daily_register_id, enrolment_id, status_code, source
    ) values (
      v_register_id, v_enrolment_id, 'P', 'web'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated attendance_records INSERT was not blocked';
  end if;

  v_blocked := false;
  begin
    update attendance.attendance_records
    set status_code=status_code
    where id=v_record_id;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated attendance_records UPDATE was not blocked';
  end if;

  v_blocked := false;
  begin
    delete from attendance.attendance_records where id=v_record_id;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated attendance_records DELETE was not blocked';
  end if;
end
$phase5b$;
rollback;

-- 13. The controlled RPC remains the complete write path for an assigned teacher.
-- Exercise validation, first save, no-change save, one-pupil correction and audit.
begin;
set local role authenticated;
do $phase5b$
declare
  v_records jsonb;
  v_corrected_records jsonb;
  v_result jsonb;
  v_first_enrolment uuid;
  v_register attendance.daily_registers%rowtype;
  v_present_count integer;
  v_absent_count integer;
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );

  v_blocked := false;
  begin
    perform public.attendance_save_register(
      '00000000-0000-0000-0000-000000000004'::uuid,
      date '2026-04-01',
      '[]'::jsonb,
      null
    );
  exception
    when others then
      if position('Expected 25 attendance records but received 0' in sqlerrm)>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Complete-roster rejection was not preserved';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_save_register(
      '00000000-0000-0000-0000-000000000004'::uuid,
      date '2026-04-02',
      '[]'::jsonb,
      null
    );
  exception
    when others then
      if position('Attendance cannot be saved for a non-school day' in sqlerrm)>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Non-school-day rejection was not preserved';
  end if;

  select e.id into v_first_enrolment
  from attendance.enrolments e
  join attendance.students s on s.id=e.student_id
  where e.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and e.active and s.active
    and e.start_date <= date '2026-04-01'
    and (e.end_date is null or e.end_date >= date '2026-04-01')
  order by e.roster_order
  limit 1;

  select jsonb_agg(
    jsonb_build_object(
      'enrolment_id',e.id,
      'status_code','P',
      'reason_code',null,
      'note',null
    )
    order by e.roster_order
  )
  into v_records
  from attendance.enrolments e
  join attendance.students s on s.id=e.student_id
  where e.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and e.active and s.active
    and e.start_date <= date '2026-04-01'
    and (e.end_date is null or e.end_date >= date '2026-04-01');

  select public.attendance_save_register(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-04-01',
    v_records,
    null
  ) into v_result;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or coalesce((v_result->>'no_changes')::boolean,true) is not false
     or coalesce((v_result->>'correction')::boolean,true) is not false
     or (v_result->>'recorded')::int <> 25
     or (v_result->>'changed_records')::int <> 25
     or (v_result->>'correction_count')::int <> 0 then
    raise exception 'Controlled first-save contract failed: %', v_result;
  end if;

  select public.attendance_save_register(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-04-01',
    v_records,
    null
  ) into v_result;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or coalesce((v_result->>'no_changes')::boolean,false) is not true
     or (v_result->>'changed_records')::int <> 0
     or (v_result->>'correction_count')::int <> 0 then
    raise exception 'Controlled no-change save contract failed: %', v_result;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'enrolment_id',e.id,
      'status_code',case when e.id=v_first_enrolment then 'A' else 'P' end,
      'reason_code',case when e.id=v_first_enrolment then 'MEDICAL' else null end,
      'note',null
    )
    order by e.roster_order
  )
  into v_corrected_records
  from attendance.enrolments e
  join attendance.students s on s.id=e.student_id
  where e.class_id='00000000-0000-0000-0000-000000000004'::uuid
    and e.active and s.active
    and e.start_date <= date '2026-04-01'
    and (e.end_date is null or e.end_date >= date '2026-04-01');

  select public.attendance_save_register(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-04-01',
    v_corrected_records,
    'Phase 5B synthetic correction'
  ) into v_result;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or coalesce((v_result->>'no_changes')::boolean,true) is not false
     or coalesce((v_result->>'correction')::boolean,false) is not true
     or (v_result->>'changed_records')::int <> 1
     or (v_result->>'correction_count')::int <> 1
     or coalesce(v_result->>'change_batch_id','') = '' then
    raise exception 'Controlled correction contract failed: %', v_result;
  end if;

  select * into v_register
  from attendance.daily_registers
  where class_id='00000000-0000-0000-0000-000000000004'::uuid
    and attendance_date=date '2026-04-01';

  if v_register.correction_count <> 1
     or v_register.last_correction_reason <> 'Phase 5B synthetic correction'
     or v_register.started_by <> '00000000-0000-0000-0000-000000000100'::uuid
     or v_register.submitted_by <> '00000000-0000-0000-0000-000000000100'::uuid
     or v_register.updated_by <> '00000000-0000-0000-0000-000000000100'::uuid
     or v_register.last_corrected_by <> '00000000-0000-0000-0000-000000000100'::uuid then
    raise exception 'Register correction metadata/actor contract failed';
  end if;

  select
    count(*) filter(where ar.status_code='P'),
    count(*) filter(where ar.status_code='A' and ar.reason_code='MEDICAL')
  into v_present_count, v_absent_count
  from attendance.attendance_records ar
  where ar.daily_register_id=v_register.id;

  if v_present_count <> 24 or v_absent_count <> 1 then
    raise exception 'Correction changed untouched pupil statuses unexpectedly';
  end if;
end
$phase5b$;

reset role;

do $phase5b_audit$
declare
  v_register_id uuid;
  v_insert_count integer;
  v_update_count integer;
  v_bad_actor integer;
  v_bad_batch integer;
  v_bad_reason integer;
begin
  select id into v_register_id
  from attendance.daily_registers
  where class_id='00000000-0000-0000-0000-000000000004'::uuid
    and attendance_date=date '2026-04-01';

  select
    count(*) filter(where a.action='INSERT'),
    count(*) filter(where a.action='UPDATE'),
    count(*) filter(where a.changed_by is distinct from '00000000-0000-0000-0000-000000000100'::uuid),
    count(*) filter(where a.change_batch_id is null),
    count(*) filter(
      where a.action='UPDATE'
        and a.correction_reason is distinct from 'Phase 5B synthetic correction'
    )
  into v_insert_count, v_update_count, v_bad_actor, v_bad_batch, v_bad_reason
  from attendance_private.attendance_record_audit a
  join attendance.attendance_records ar on ar.id=a.attendance_record_id
  where ar.daily_register_id=v_register_id;

  if v_insert_count <> 25
     or v_update_count <> 1
     or v_bad_actor <> 0
     or v_bad_batch <> 0
     or v_bad_reason <> 0 then
    raise exception
      'Correction audit contract failed inserts=% updates=% bad_actor=% bad_batch=% bad_reason=%',
      v_insert_count, v_update_count, v_bad_actor, v_bad_batch, v_bad_reason;
  end if;
end
$phase5b_audit$;

rollback;

-- 14. Assigned teacher cannot use the admin movement RPC; admin can.
begin;
set local role authenticated;
do $phase5a$
declare
  v_blocked boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );
  begin
    perform public.attendance_admin_transfer_in(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      'SEC5A-DENIED',
      'Synthetic Denied Transfer',
      'Male',
      date '2026-04-01',
      'Mainstream',
      true,
      null
    );
  exception
    when others then
      if position('administrator access' in lower(sqlerrm))>0 then
        v_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_blocked then
    raise exception 'Assigned teacher unexpectedly used admin transfer-in';
  end if;
end
$phase5a$;
rollback;

begin;
set local role authenticated;
do $phase5a$
declare
  v_roster jsonb;
  v_transfer jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select public.attendance_admin_student_roster(
    '00000000-0000-0000-0000-000000000001'::uuid
  ) into v_roster;
  if (v_roster->>'total_current')::int <> 25 then
    raise exception 'Synthetic admin roster baseline changed';
  end if;

  select public.attendance_admin_transfer_in(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'SEC5A-ALLOWED',
    'Synthetic Allowed Transfer',
    'Female',
    date '2026-04-01',
    'Mainstream',
    true,
    'Phase 5A rollback-only transfer'
  ) into v_transfer;

  if coalesce((v_transfer->>'ok')::boolean,false) is not true
     or v_transfer->>'class_id' <> '00000000-0000-0000-0000-000000000004' then
    raise exception 'Synthetic admin transfer-in baseline failed: %', v_transfer;
  end if;
end
$phase5a$;
rollback;

-- 15. Private audit tables remain unreachable to an authenticated client.
begin;
set local role authenticated;
do $phase5a$
declare
  v_blocked boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );
  begin
    execute 'select 1 from attendance_private.attendance_record_audit limit 1';
  exception
    when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Authenticated client unexpectedly read private audit history';
  end if;
end
$phase5a$;
rollback;
