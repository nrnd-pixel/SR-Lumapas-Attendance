-- SR Lumapas Attendance Phase 5D teacher-management write-boundary verifier
-- Synthetic/local validation ONLY. No production identifiers, credentials, or exports.
--
-- PASS condition:
--   * every SELECT below returns zero rows;
--   * every DO block completes without raising;
--   * every synthetic write exercise occurs inside a transaction that ROLLBACKs.

-- 1. Authenticated keeps RLS-scoped SELECT but cannot bypass the teacher-admin RPCs.
select 'teacher_management_table_privilege' as check_name, table_name as mismatch
from unnest(array[
  'attendance.teacher_school_memberships',
  'attendance.teacher_class_assignments'
]) table_name
where not has_table_privilege('authenticated',table_name,'SELECT')
   or has_table_privilege('authenticated',table_name,'INSERT')
   or has_table_privilege('authenticated',table_name,'UPDATE')
   or has_table_privilege('authenticated',table_name,'DELETE')
   or not has_table_privilege('service_role',table_name,'SELECT')
   or not has_table_privilege('service_role',table_name,'INSERT')
   or not has_table_privilege('service_role',table_name,'UPDATE')
   or not has_table_privilege('service_role',table_name,'DELETE');

-- 2. Existing coordinated write RPCs retain their exact public security contract.
with expected(name,identity_args) as (
  values
    (
      'attendance_admin_review_teacher_request',
      'p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text'
    ),
    (
      'attendance_admin_set_teacher_active',
      'p_user_id uuid, p_school_id uuid, p_active boolean'
    )
), actual as (
  select
    p.proname as name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    coalesce(p.proconfig,'{}'::text[]) as proconfig,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    exists(
      select 1
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
      where x.grantee=0 and x.privilege_type='EXECUTE'
    ) as public_execute
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'attendance_admin_review_teacher_request',
      'attendance_admin_set_teacher_active'
    )
)
select 'teacher_management_rpc_contract' as check_name,
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
   or a.service_execute is not true
   or a.anon_execute is true
   or a.public_execute is true;

-- 3. Even a school administrator cannot bypass the coordinated RPCs with direct DML.
begin;

insert into auth.users(id,email,aud,role,created_at,updated_at)
values (
  '00000000-0000-0000-0000-000000000102'::uuid,
  'phase5d-direct-dml@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

set local role authenticated;

do $phase5d_direct_dml$
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
    insert into attendance.teacher_school_memberships(user_id,school_id,role,active)
    values (
      '00000000-0000-0000-0000-000000000102'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'teacher',
      true
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_school_memberships INSERT was not blocked';
  end if;

  v_blocked := false;
  begin
    update attendance.teacher_school_memberships
    set active=active
    where user_id='00000000-0000-0000-0000-000000000100'::uuid
      and school_id='00000000-0000-0000-0000-000000000001'::uuid;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_school_memberships UPDATE was not blocked';
  end if;

  v_blocked := false;
  begin
    delete from attendance.teacher_school_memberships
    where user_id='00000000-0000-0000-0000-000000000100'::uuid
      and school_id='00000000-0000-0000-0000-000000000001'::uuid;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_school_memberships DELETE was not blocked';
  end if;

  v_blocked := false;
  begin
    insert into attendance.teacher_class_assignments(user_id,class_id,role,active)
    values (
      '00000000-0000-0000-0000-000000000102'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      'teacher',
      true
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_class_assignments INSERT was not blocked';
  end if;

  v_blocked := false;
  begin
    update attendance.teacher_class_assignments
    set active=active
    where user_id='00000000-0000-0000-0000-000000000100'::uuid
      and class_id='00000000-0000-0000-0000-000000000004'::uuid;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_class_assignments UPDATE was not blocked';
  end if;

  v_blocked := false;
  begin
    delete from attendance.teacher_class_assignments
    where user_id='00000000-0000-0000-0000-000000000100'::uuid
      and class_id='00000000-0000-0000-0000-000000000004'::uuid;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Direct authenticated teacher_class_assignments DELETE was not blocked';
  end if;
end
$phase5d_direct_dml$;

rollback;

-- 4. Assigned teacher and outsider remain unable to invoke admin teacher-management writes.
begin;

insert into attendance.teacher_signup_requests(
  id,user_id,school_id,requested_class_id,full_name,email,requested_role,status
) values (
  '40000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Synthetic Phase 5D Unauthorized Request',
  'phase5d-unauthorized@example.invalid',
  'class_teacher',
  'pending'
);

set local role authenticated;

do $phase5d_non_admin_block$
declare
  v_blocked boolean;
  v_uid uuid;
begin
  foreach v_uid in array array[
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000101'::uuid
  ]
  loop
    perform set_config('request.jwt.claim.sub',v_uid::text,true);

    v_blocked := false;
    begin
      perform public.attendance_admin_review_teacher_request(
        '40000000-0000-0000-0000-000000000001'::uuid,
        'approve',
        '00000000-0000-0000-0000-000000000004'::uuid,
        'class_teacher',
        null
      );
    exception when others then
      if position('admin access required' in lower(sqlerrm))>0 then
        v_blocked := true;
      else
        raise;
      end if;
    end;
    if not v_blocked then
      raise exception 'Non-admin unexpectedly reviewed a teacher request';
    end if;

    v_blocked := false;
    begin
      perform public.attendance_admin_set_teacher_active(
        '00000000-0000-0000-0000-000000000100'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        false
      );
    exception when others then
      if position('admin access required' in lower(sqlerrm))>0 then
        v_blocked := true;
      else
        raise;
      end if;
    end;
    if not v_blocked then
      raise exception 'Non-admin unexpectedly changed teacher active state';
    end if;
  end loop;
end
$phase5d_non_admin_block$;

rollback;

-- 5. Authorized approval + disable/enable remains the complete coordinated write path.
begin;

insert into auth.users(id,email,aud,role,created_at,updated_at)
values (
  '00000000-0000-0000-0000-000000000102'::uuid,
  'phase5d-approved@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into attendance.teacher_signup_requests(
  id,user_id,school_id,requested_class_id,full_name,email,requested_role,status
) values (
  '40000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Synthetic Phase 5D Approved Teacher',
  'phase5d-approved@example.invalid',
  'assistant_teacher',
  'pending'
);

set local role authenticated;

do $phase5d_admin_path$
declare
  v_review jsonb;
  v_teachers jsonb;
  v_toggle jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select public.attendance_admin_review_teacher_request(
    '40000000-0000-0000-0000-000000000002'::uuid,
    'approve',
    '00000000-0000-0000-0000-000000000004'::uuid,
    'assistant_teacher',
    'Phase 5D rollback-only approval'
  ) into v_review;

  if coalesce((v_review->>'ok')::boolean,false) is not true
     or v_review->>'status' <> 'approved'
     or v_review->>'user_id' <> '00000000-0000-0000-0000-000000000102'
     or v_review->>'class_id' <> '00000000-0000-0000-0000-000000000004'
     or v_review->>'assignment_type' <> 'assistant_teacher' then
    raise exception 'Authorized teacher approval result contract changed: %', v_review;
  end if;

  if not exists (
    select 1
    from attendance.teacher_signup_requests r
    where r.id='40000000-0000-0000-0000-000000000002'::uuid
      and r.status='approved'
      and r.approved_class_id='00000000-0000-0000-0000-000000000004'::uuid
      and r.approved_assignment_type='assistant_teacher'
      and r.reviewed_by='00000000-0000-0000-0000-000000000099'::uuid
  ) then
    raise exception 'Approved signup-request semantics changed';
  end if;

  -- Phase 5E is separate: current membership/assignment roles must remain generic teacher.
  if not exists (
    select 1
    from attendance.teacher_school_memberships m
    where m.user_id='00000000-0000-0000-0000-000000000102'::uuid
      and m.school_id='00000000-0000-0000-0000-000000000001'::uuid
      and m.role='teacher'
      and m.active
  ) then
    raise exception 'Generic teacher school-membership contract changed';
  end if;

  if not exists (
    select 1
    from attendance.teacher_class_assignments a
    where a.user_id='00000000-0000-0000-0000-000000000102'::uuid
      and a.class_id='00000000-0000-0000-0000-000000000004'::uuid
      and a.role='teacher'
      and a.active
  ) then
    raise exception 'Generic teacher class-assignment contract changed';
  end if;

  select public.attendance_admin_teachers() into v_teachers;
  if not exists (
    select 1
    from jsonb_array_elements(v_teachers) t
    where t->>'user_id'='00000000-0000-0000-0000-000000000102'
      and coalesce((t->>'active')::boolean,false)
      and jsonb_array_length(coalesce(t->'classes','[]'::jsonb))=1
  ) then
    raise exception 'Approved teacher did not appear in admin teacher listing';
  end if;

  select public.attendance_admin_set_teacher_active(
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    false
  ) into v_toggle;

  if coalesce((v_toggle->>'ok')::boolean,false) is not true
     or coalesce((v_toggle->>'active')::boolean,true) is not false then
    raise exception 'Disable result contract changed: %', v_toggle;
  end if;

  if exists (
    select 1
    from attendance.teacher_school_memberships m
    where m.user_id='00000000-0000-0000-0000-000000000102'::uuid and m.active
  ) or exists (
    select 1
    from attendance.teacher_class_assignments a
    where a.user_id='00000000-0000-0000-0000-000000000102'::uuid and a.active
  ) then
    raise exception 'Disable did not coordinate membership and class assignments';
  end if;

  select public.attendance_admin_set_teacher_active(
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    true
  ) into v_toggle;

  if coalesce((v_toggle->>'ok')::boolean,false) is not true
     or coalesce((v_toggle->>'active')::boolean,false) is not true then
    raise exception 'Enable result contract changed: %', v_toggle;
  end if;

  if not exists (
    select 1
    from attendance.teacher_school_memberships m
    where m.user_id='00000000-0000-0000-0000-000000000102'::uuid and m.active
  ) or not exists (
    select 1
    from attendance.teacher_class_assignments a
    where a.user_id='00000000-0000-0000-0000-000000000102'::uuid and a.active
  ) then
    raise exception 'Enable did not coordinate membership and class assignments';
  end if;
end
$phase5d_admin_path$;

reset role;

do $phase5d_audit_path$
begin
  if (
    select count(*)
    from attendance_private.teacher_access_audit a
    where a.request_id='40000000-0000-0000-0000-000000000002'::uuid
      and a.subject_user_id='00000000-0000-0000-0000-000000000102'::uuid
      and a.actor_user_id='00000000-0000-0000-0000-000000000099'::uuid
      and a.action='request_approved'
      and a.details->>'assignment_type'='assistant_teacher'
  ) <> 1 then
    raise exception 'request_approved audit contract changed';
  end if;

  if (
    select count(*)
    from attendance_private.teacher_access_audit a
    where a.subject_user_id='00000000-0000-0000-0000-000000000102'::uuid
      and a.actor_user_id='00000000-0000-0000-0000-000000000099'::uuid
      and a.action='access_disabled'
      and coalesce((a.details->>'attendance_only')::boolean,false)
  ) <> 1 then
    raise exception 'access_disabled audit contract changed';
  end if;

  if (
    select count(*)
    from attendance_private.teacher_access_audit a
    where a.subject_user_id='00000000-0000-0000-0000-000000000102'::uuid
      and a.actor_user_id='00000000-0000-0000-0000-000000000099'::uuid
      and a.action='access_enabled'
      and coalesce((a.details->>'attendance_only')::boolean,false)
  ) <> 1 then
    raise exception 'access_enabled audit contract changed';
  end if;
end
$phase5d_audit_path$;

set local role authenticated;

do $phase5d_teacher_read_path$
declare
  v_status jsonb;
  v_bootstrap jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000102',
    true
  );

  select public.attendance_teacher_status() into v_status;
  if coalesce((v_status->>'authorized')::boolean,false) is not true
     or v_status->>'school_role' <> 'teacher'
     or jsonb_array_length(coalesce(v_status->'assignments','[]'::jsonb)) <> 1
     or v_status #>> '{assignments,0,assignment_role}' <> 'teacher'
     or v_status #>> '{assignments,0,class_id}' <> '00000000-0000-0000-0000-000000000004' then
    raise exception 'Teacher status/read contract changed after grant revocation: %', v_status;
  end if;

  select public.attendance_bootstrap() into v_bootstrap;
  if v_bootstrap #>> '{user,school_role}' <> 'teacher'
     or coalesce((v_bootstrap #>> '{user,all_classes}')::boolean,true)
     or jsonb_array_length(coalesce(v_bootstrap->'classes','[]'::jsonb)) <> 1
     or v_bootstrap #>> '{classes,0,id}' <> '00000000-0000-0000-0000-000000000004' then
    raise exception 'Invoker bootstrap/read contract changed after grant revocation: %', v_bootstrap;
  end if;
end
$phase5d_teacher_read_path$;

rollback;
