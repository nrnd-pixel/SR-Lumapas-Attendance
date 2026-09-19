-- Phase 5E teacher-role persistence verifier
-- Synthetic/local-only. Every write exercise is rollback-isolated.
-- PASS condition: every top-level SELECT returns zero rows and no DO block raises.

-- 1. Class-assignment role domain now supports both authoritative teacher types
--    while retaining legacy teacher/viewer values.
select 'teacher_assignment_role_constraint' as check_name,
       pg_get_constraintdef(con.oid) as mismatch
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='attendance'
  and c.relname='teacher_class_assignments'
  and con.conname='teacher_class_assignments_role_check'
  and not (
    pg_get_constraintdef(con.oid) ilike '%teacher%'
    and pg_get_constraintdef(con.oid) ilike '%viewer%'
    and pg_get_constraintdef(con.oid) ilike '%class_teacher%'
    and pg_get_constraintdef(con.oid) ilike '%assistant_teacher%'
  );

-- 2. Approval RPC keeps the existing security boundary and signature.
with actual as (
  select
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
    ) as public_execute,
    pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='attendance_admin_review_teacher_request'
)
select 'teacher_role_approval_rpc_contract' as check_name,
       coalesce(identity_args,'<missing>') as mismatch
from actual
where identity_args <> 'p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text'
   or result_type <> 'jsonb'
   or security_definer is not true
   or not (proconfig @> array['search_path=""']::text[])
   or authenticated_execute is not true
   or service_execute is not true
   or anon_execute is true
   or public_execute is true
   or def not like '%values(v_req.user_id,v_req.school_id,''teacher'',true)%'
   or def not like '%values(v_req.user_id,v_target_class,v_assignment_type,true)%'
   or def not like '%set role=v_assignment_type, active=true, updated_at=now()%';

-- 3. V16 direct-DML boundary remains closed.
select 'teacher_role_table_privilege' as check_name, table_name as mismatch
from unnest(array[
  'attendance.teacher_school_memberships',
  'attendance.teacher_class_assignments'
]) table_name
where not has_table_privilege('authenticated',table_name,'SELECT')
   or has_table_privilege('authenticated',table_name,'INSERT')
   or has_table_privilege('authenticated',table_name,'UPDATE')
   or has_table_privilege('authenticated',table_name,'DELETE');

-- 4. Both approved role types persist authoritatively; school membership remains
--    generic teacher; access semantics, status reads, audit, and enable/disable
--    behavior stay unchanged.
begin;

insert into auth.users(id,email,aud,role,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000102'::uuid,'phase5e-class@example.invalid','authenticated','authenticated',now(),now()),
  ('00000000-0000-0000-0000-000000000103'::uuid,'phase5e-assistant@example.invalid','authenticated','authenticated',now(),now()),
  ('00000000-0000-0000-0000-000000000104'::uuid,'phase5e-legacy@example.invalid','authenticated','authenticated',now(),now()),
  ('00000000-0000-0000-0000-000000000105'::uuid,'phase5e-viewer@example.invalid','authenticated','authenticated',now(),now())
on conflict (id) do nothing;

insert into attendance.teacher_signup_requests(
  id,user_id,school_id,requested_class_id,full_name,email,requested_role,status
) values
  (
    '50000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Synthetic Phase 5E Class Teacher',
    'phase5e-class@example.invalid',
    'class_teacher',
    'pending'
  ),
  (
    '50000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Synthetic Phase 5E Assistant Teacher',
    'phase5e-assistant@example.invalid',
    'assistant_teacher',
    'pending'
  );

-- Legacy role values remain valid and class-access equivalent.
insert into attendance.teacher_school_memberships(user_id,school_id,role,active)
values
  ('00000000-0000-0000-0000-000000000104'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'teacher',true),
  ('00000000-0000-0000-0000-000000000105'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'viewer',true)
on conflict (user_id,school_id) do update set role=excluded.role,active=true;

insert into attendance.teacher_class_assignments(user_id,class_id,role,active)
values
  ('00000000-0000-0000-0000-000000000104'::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'teacher',true),
  ('00000000-0000-0000-0000-000000000105'::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'viewer',true)
on conflict (user_id,class_id) do update set role=excluded.role,active=true;

set local role authenticated;

do $phase5e_admin_approvals$
declare
  v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);

  select public.attendance_admin_review_teacher_request(
    '50000000-0000-0000-0000-000000000001'::uuid,
    'approve',
    '00000000-0000-0000-0000-000000000004'::uuid,
    'class_teacher',
    null
  ) into v_result;
  if v_result->>'assignment_type' <> 'class_teacher' then
    raise exception 'Class Teacher approval result changed: %',v_result;
  end if;

  select public.attendance_admin_review_teacher_request(
    '50000000-0000-0000-0000-000000000002'::uuid,
    'approve',
    '00000000-0000-0000-0000-000000000004'::uuid,
    'assistant_teacher',
    null
  ) into v_result;
  if v_result->>'assignment_type' <> 'assistant_teacher' then
    raise exception 'Assistant Teacher approval result changed: %',v_result;
  end if;
end
$phase5e_admin_approvals$;

reset role;

do $phase5e_persistence$
begin
  if not exists (
    select 1 from attendance.teacher_school_memberships
    where user_id='00000000-0000-0000-0000-000000000102'::uuid
      and school_id='00000000-0000-0000-0000-000000000001'::uuid
      and role='teacher' and active
  ) or not exists (
    select 1 from attendance.teacher_school_memberships
    where user_id='00000000-0000-0000-0000-000000000103'::uuid
      and school_id='00000000-0000-0000-0000-000000000001'::uuid
      and role='teacher' and active
  ) then
    raise exception 'Generic school-membership role contract changed';
  end if;

  if not exists (
    select 1 from attendance.teacher_class_assignments
    where user_id='00000000-0000-0000-0000-000000000102'::uuid
      and class_id='00000000-0000-0000-0000-000000000004'::uuid
      and role='class_teacher' and active
  ) then
    raise exception 'Class Teacher assignment role was not persisted';
  end if;

  if not exists (
    select 1 from attendance.teacher_class_assignments
    where user_id='00000000-0000-0000-0000-000000000103'::uuid
      and class_id='00000000-0000-0000-0000-000000000004'::uuid
      and role='assistant_teacher' and active
  ) then
    raise exception 'Assistant Teacher assignment role was not persisted';
  end if;

  if (
    select count(*) from attendance_private.teacher_access_audit
    where request_id in (
      '50000000-0000-0000-0000-000000000001'::uuid,
      '50000000-0000-0000-0000-000000000002'::uuid
    )
      and action='request_approved'
      and details->>'assignment_type' in ('class_teacher','assistant_teacher')
  ) <> 2 then
    raise exception 'Phase 5E approval audit contract changed';
  end if;
end
$phase5e_persistence$;

set local role authenticated;

do $phase5e_role_reads$
declare
  v_uid uuid;
  v_expected text;
  v_status jsonb;
  v_bootstrap jsonb;
begin
  for v_uid,v_expected in
    select * from (values
      ('00000000-0000-0000-0000-000000000102'::uuid,'class_teacher'::text),
      ('00000000-0000-0000-0000-000000000103'::uuid,'assistant_teacher'::text),
      ('00000000-0000-0000-0000-000000000104'::uuid,'teacher'::text),
      ('00000000-0000-0000-0000-000000000105'::uuid,'viewer'::text)
    ) x(user_id,role_name)
  loop
    perform set_config('request.jwt.claim.sub',v_uid::text,true);

    if not attendance.can_access_class('00000000-0000-0000-0000-000000000004'::uuid) then
      raise exception 'Class access changed for assignment role %',v_expected;
    end if;

    select public.attendance_teacher_status() into v_status;
    if coalesce((v_status->>'authorized')::boolean,false) is not true
       or jsonb_array_length(coalesce(v_status->'assignments','[]'::jsonb)) <> 1
       or v_status #>> '{assignments,0,assignment_role}' <> v_expected then
      raise exception 'Teacher status role changed for %: %',v_expected,v_status;
    end if;

    select public.attendance_bootstrap() into v_bootstrap;
    if jsonb_array_length(coalesce(v_bootstrap->'classes','[]'::jsonb)) <> 1
       or v_bootstrap #>> '{classes,0,id}' <> '00000000-0000-0000-0000-000000000004' then
      raise exception 'Bootstrap class access changed for %: %',v_expected,v_bootstrap;
    end if;
  end loop;
end
$phase5e_role_reads$;

do $phase5e_toggle_preserves_role$
declare
  v_toggle jsonb;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);

  select public.attendance_admin_set_teacher_active(
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    false
  ) into v_toggle;

  select public.attendance_admin_set_teacher_active(
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    true
  ) into v_toggle;

  if not exists (
    select 1 from attendance.teacher_class_assignments
    where user_id='00000000-0000-0000-0000-000000000103'::uuid
      and class_id='00000000-0000-0000-0000-000000000004'::uuid
      and role='assistant_teacher'
      and active
  ) then
    raise exception 'Enable/disable changed authoritative assignment role';
  end if;
end
$phase5e_toggle_preserves_role$;

rollback;
