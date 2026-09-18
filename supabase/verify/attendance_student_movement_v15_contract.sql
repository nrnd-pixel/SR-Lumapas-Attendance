-- SR Lumapas Attendance Phase 5C student-movement write-boundary verifier
-- Synthetic/local validation ONLY. No production data or credentials.
--
-- PASS condition:
--   * every SELECT below returns zero rows;
--   * every DO block completes without raising;
--   * every synthetic write exercise occurs inside a transaction that ROLLBACKs.

-- 1. Exact movement RPC signatures and SECURITY DEFINER modes.
with expected(name, identity_args) as (
  values
    (
      'attendance_admin_transfer_in',
      'p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text, p_include_in_class_stats boolean, p_remarks text'
    ),
    (
      'attendance_admin_transfer_out',
      'p_enrolment_id uuid, p_last_date date, p_remarks text'
    ),
    (
      'attendance_admin_move_class',
      'p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text'
    )
), actual as (
  select
    p.proname as name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    coalesce(p.proconfig,'{}'::text[]) as proconfig,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'attendance_admin_transfer_in',
      'attendance_admin_transfer_out',
      'attendance_admin_move_class'
    )
)
select
  'movement_rpc_contract' as check_name,
  coalesce(e.name,a.name) as mismatch
from expected e
full join actual a using(name)
where e.name is null
   or a.name is null
   or e.identity_args is distinct from a.identity_args
   or a.result_type <> 'jsonb'
   or a.security_definer is not true
   or not (a.proconfig @> array['search_path=""']::text[])
   or a.authenticated_execute is not true
   or a.anon_execute is true;

-- 2. Authenticated clients retain SELECT but no direct movement-table writes.
select 'movement_table_privilege' as check_name, table_name as mismatch
from unnest(array[
  'attendance.students',
  'attendance.enrolments',
  'attendance.student_movements'
]) table_name
where not has_table_privilege('authenticated',table_name,'SELECT')
   or has_table_privilege('authenticated',table_name,'INSERT')
   or has_table_privilege('authenticated',table_name,'UPDATE')
   or has_table_privilege('authenticated',table_name,'DELETE');

-- 3. A school admin cannot bypass the RPCs with direct DML.
begin;
set local role authenticated;
do $phase5c_direct_dml$
declare
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  v_blocked := false;
  begin
    insert into attendance.students(
      id,school_id,student_ref,full_name,active
    ) values (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'P5C-DIRECT',
      'Direct DML Must Fail',
      true
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated students INSERT was not blocked';
  end if;

  v_blocked := false;
  begin
    update attendance.enrolments
    set remarks=remarks
    where id='20000000-0000-0000-0000-000000000001'::uuid;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated enrolments UPDATE was not blocked';
  end if;

  v_blocked := false;
  begin
    insert into attendance.student_movements(
      school_id,student_id,movement_type,effective_date,created_by
    ) values (
      '00000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000001'::uuid,
      'TRANSFER_OUT',
      date '2026-03-12',
      '00000000-0000-0000-0000-000000000099'::uuid
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated student_movements INSERT was not blocked';
  end if;
end
$phase5c_direct_dml$;
rollback;

-- 4. Assigned teacher cannot invoke any movement RPC.
begin;
set local role authenticated;
do $phase5c_teacher_block$
declare
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000100',
    true
  );

  v_blocked := false;
  begin
    perform public.attendance_admin_transfer_in(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      'P5C-TEACHER',
      'Teacher Must Be Blocked',
      'Male',
      date '2026-04-01',
      'Mainstream',
      true,
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Assigned teacher unexpectedly used transfer-in';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_admin_transfer_out(
      '20000000-0000-0000-0000-000000000001'::uuid,
      date '2026-03-12',
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Assigned teacher unexpectedly used transfer-out';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_admin_move_class(
      '20000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000005'::uuid,
      date '2026-03-13',
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Assigned teacher unexpectedly used move-class';
  end if;
end
$phase5c_teacher_block$;
rollback;

-- 5. Completely unaffiliated authenticated caller cannot invoke any movement RPC.
begin;
set local role authenticated;
do $phase5c_outsider_block$
declare
  v_blocked boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000101',
    true
  );

  v_blocked := false;
  begin
    perform public.attendance_admin_transfer_in(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      'P5C-OUTSIDER',
      'Outsider Must Be Blocked',
      'Female',
      date '2026-04-01',
      'Mainstream',
      true,
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly used transfer-in';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_admin_transfer_out(
      '20000000-0000-0000-0000-000000000001'::uuid,
      date '2026-03-12',
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly used transfer-out';
  end if;

  v_blocked := false;
  begin
    perform public.attendance_admin_move_class(
      '20000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000005'::uuid,
      date '2026-03-13',
      null
    );
  exception when others then
    if position('administrator access' in lower(sqlerrm))>0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'Outsider unexpectedly used move-class';
  end if;
end
$phase5c_outsider_block$;
rollback;

-- 6. Authorized Transfer In writes identity, enrolment and movement atomically.
begin;
set local role authenticated;
do $phase5c_transfer_in$
declare
  v_result jsonb;
  v_student_id uuid;
  v_enrolment_id uuid;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select public.attendance_admin_transfer_in(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'P5C-ALLOWED',
    'Synthetic Phase 5C Transfer In',
    'Female',
    date '2026-04-01',
    'Mainstream',
    true,
    'Phase 5C rollback-only transfer in'
  ) into v_result;

  v_student_id := (v_result->>'student_id')::uuid;
  v_enrolment_id := (v_result->>'enrolment_id')::uuid;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or v_result->>'class_id' <> '00000000-0000-0000-0000-000000000004'
     or v_result->>'start_date' <> '2026-04-01'
     or coalesce((v_result->>'returning_student')::boolean,true) is not false then
    raise exception 'Transfer-in result contract changed: %', v_result;
  end if;

  if not exists (
    select 1
    from attendance.students s
    where s.id=v_student_id
      and s.student_ref='P5C-ALLOWED'
      and s.full_name='Synthetic Phase 5C Transfer In'
      and s.active
  ) then
    raise exception 'Transfer-in student identity was not created';
  end if;

  if not exists (
    select 1
    from attendance.enrolments e
    where e.id=v_enrolment_id
      and e.student_id=v_student_id
      and e.class_id='00000000-0000-0000-0000-000000000004'::uuid
      and e.start_date=date '2026-04-01'
      and e.end_date is null
      and e.enrolment_status='TRANSFERRED IN'
      and e.include_in_class_stats
  ) then
    raise exception 'Transfer-in enrolment contract changed';
  end if;

  if not exists (
    select 1
    from attendance.student_movements m
    where m.student_id=v_student_id
      and m.movement_type='TRANSFER_IN'
      and m.effective_date=date '2026-04-01'
      and m.to_class_id='00000000-0000-0000-0000-000000000004'::uuid
      and m.to_enrolment_id=v_enrolment_id
      and m.created_by='00000000-0000-0000-0000-000000000099'::uuid
  ) then
    raise exception 'Transfer-in movement history was not written';
  end if;
end
$phase5c_transfer_in$;
rollback;

-- 7. Authorized Transfer Out preserves saved attendance history.
begin;
set local role authenticated;
do $phase5c_transfer_out$
declare
  v_result jsonb;
  v_before integer;
  v_after integer;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select count(*) into v_before
  from attendance.attendance_records
  where enrolment_id='20000000-0000-0000-0000-000000000001'::uuid;

  select public.attendance_admin_transfer_out(
    '20000000-0000-0000-0000-000000000001'::uuid,
    date '2026-03-12',
    'Phase 5C rollback-only transfer out'
  ) into v_result;

  select count(*) into v_after
  from attendance.attendance_records
  where enrolment_id='20000000-0000-0000-0000-000000000001'::uuid;

  if v_before <= 0 or v_after <> v_before then
    raise exception 'Transfer-out changed saved attendance history before=% after=%', v_before, v_after;
  end if;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or v_result->>'enrolment_id' <> '20000000-0000-0000-0000-000000000001'
     or v_result->>'last_date' <> '2026-03-12'
     or (v_result->>'preserved_attendance_records')::int <> v_before then
    raise exception 'Transfer-out result contract changed: %', v_result;
  end if;

  if not exists (
    select 1 from attendance.enrolments e
    where e.id='20000000-0000-0000-0000-000000000001'::uuid
      and e.end_date=date '2026-03-12'
      and e.enrolment_status='TRANSFERRED OUT'
  ) then
    raise exception 'Transfer-out enrolment history contract changed';
  end if;

  if not exists (
    select 1 from attendance.student_movements m
    where m.student_id='10000000-0000-0000-0000-000000000001'::uuid
      and m.movement_type='TRANSFER_OUT'
      and m.effective_date=date '2026-03-12'
      and m.from_enrolment_id='20000000-0000-0000-0000-000000000001'::uuid
      and m.created_by='00000000-0000-0000-0000-000000000099'::uuid
  ) then
    raise exception 'Transfer-out movement history was not written';
  end if;
end
$phase5c_transfer_out$;
rollback;

-- 8. Authorized Move Class preserves old attendance and eligibility boundaries.
begin;

insert into attendance.classes(
  id,academic_year_id,class_code,class_name,year_level,active
) values (
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '3B-P5C',
  'Synthetic Phase 5C Destination',
  3,
  true
);

set local role authenticated;
do $phase5c_move_class$
declare
  v_result jsonb;
  v_before integer;
  v_after integer;
  v_new_id uuid;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select count(*) into v_before
  from attendance.attendance_records
  where enrolment_id='20000000-0000-0000-0000-000000000002'::uuid;

  select public.attendance_admin_move_class(
    '20000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000005'::uuid,
    date '2026-03-13',
    'Phase 5C rollback-only class move'
  ) into v_result;

  v_new_id := (v_result->>'to_enrolment_id')::uuid;

  select count(*) into v_after
  from attendance.attendance_records
  where enrolment_id='20000000-0000-0000-0000-000000000002'::uuid;

  if v_before <= 0 or v_after <> v_before then
    raise exception 'Move Class changed old attendance history before=% after=%', v_before, v_after;
  end if;

  if coalesce((v_result->>'ok')::boolean,false) is not true
     or v_result->>'from_enrolment_id' <> '20000000-0000-0000-0000-000000000002'
     or v_result->>'to_class_id' <> '00000000-0000-0000-0000-000000000005'
     or v_result->>'move_date' <> '2026-03-13'
     or (v_result->>'preserved_attendance_records')::int <> v_before then
    raise exception 'Move Class result contract changed: %', v_result;
  end if;

  if not exists (
    select 1 from attendance.enrolments e
    where e.id='20000000-0000-0000-0000-000000000002'::uuid
      and e.end_date=date '2026-03-12'
      and e.enrolment_status='MOVED CLASS'
  ) then
    raise exception 'Move Class old enrolment boundary changed';
  end if;

  if not exists (
    select 1 from attendance.enrolments e
    where e.id=v_new_id
      and e.student_id='10000000-0000-0000-0000-000000000002'::uuid
      and e.class_id='00000000-0000-0000-0000-000000000005'::uuid
      and e.start_date=date '2026-03-13'
      and e.end_date is null
      and e.reporting_group='Mainstream'
      and e.include_in_class_stats
      and e.enrolment_status='ENROLLED'
  ) then
    raise exception 'Move Class destination enrolment contract changed';
  end if;

  if not exists (
    select 1 from attendance.student_movements m
    where m.student_id='10000000-0000-0000-0000-000000000002'::uuid
      and m.movement_type='MOVE_CLASS'
      and m.effective_date=date '2026-03-13'
      and m.from_enrolment_id='20000000-0000-0000-0000-000000000002'::uuid
      and m.to_enrolment_id=v_new_id
      and m.from_class_id='00000000-0000-0000-0000-000000000004'::uuid
      and m.to_class_id='00000000-0000-0000-0000-000000000005'::uuid
      and m.created_by='00000000-0000-0000-0000-000000000099'::uuid
  ) then
    raise exception 'Move Class movement history was not written';
  end if;
end
$phase5c_move_class$;

rollback;
