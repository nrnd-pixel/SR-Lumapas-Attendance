-- Attendance v17 — Phase 5E authoritative teacher assignment-role persistence
-- Repository/local candidate only. Do not apply to production without separate approval.
--
-- Preserve school-level membership roles and class-access semantics while storing the
-- already-approved class_teacher / assistant_teacher value on class assignments.

begin;

alter table attendance.teacher_class_assignments
  drop constraint if exists teacher_class_assignments_role_check;

alter table attendance.teacher_class_assignments
  add constraint teacher_class_assignments_role_check
  check (role in ('teacher','viewer','class_teacher','assistant_teacher'));

create or replace function public.attendance_admin_review_teacher_request(
  p_request_id uuid,
  p_action text,
  p_class_id uuid default null,
  p_assignment_type text default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_req attendance.teacher_signup_requests%rowtype;
  v_target_class uuid;
  v_assignment_type text;
  v_class_code text;
begin
  if v_admin is null then raise exception 'Authentication required'; end if;
  if v_action not in ('approve','reject') then raise exception 'Action must be approve or reject'; end if;

  select * into v_req
  from attendance.teacher_signup_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Teacher request not found'; end if;
  if not attendance.is_school_admin(v_req.school_id) then raise exception 'Admin access required'; end if;
  if v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  if v_action='reject' then
    update attendance.teacher_signup_requests
    set status='rejected', admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),
        reviewed_by=v_admin, reviewed_at=now(), updated_at=now()
    where id=p_request_id;

    insert into attendance_private.teacher_access_audit(
      request_id, subject_user_id, school_id, class_id, action, actor_user_id, details
    ) values (
      p_request_id, v_req.user_id, v_req.school_id, v_req.requested_class_id,
      'request_rejected', v_admin,
      jsonb_build_object('admin_note', nullif(btrim(coalesce(p_admin_note,'')),''))
    );

    return jsonb_build_object('ok',true,'status','rejected','request_id',p_request_id);
  end if;

  v_target_class := coalesce(p_class_id, v_req.requested_class_id);
  v_assignment_type := lower(btrim(coalesce(p_assignment_type, v_req.requested_role)));
  if v_assignment_type not in ('class_teacher','assistant_teacher') then
    raise exception 'Invalid assignment type';
  end if;

  select c.class_code into v_class_code
  from attendance.classes c
  join attendance.academic_years ay on ay.id=c.academic_year_id
  where c.id=v_target_class and c.active and ay.active and ay.school_id=v_req.school_id;
  if v_class_code is null then raise exception 'Approved class is not available for this school'; end if;

  insert into attendance.teacher_school_memberships(user_id,school_id,role,active)
  values(v_req.user_id,v_req.school_id,'teacher',true)
  on conflict (user_id,school_id) do update
    set role = case when attendance.teacher_school_memberships.role='admin' then 'admin' else 'teacher' end,
        active=true,
        updated_at=now();

  insert into attendance.teacher_class_assignments(user_id,class_id,role,active)
  values(v_req.user_id,v_target_class,v_assignment_type,true)
  on conflict (user_id,class_id) do update
    set role=v_assignment_type, active=true, updated_at=now();

  update attendance.teacher_signup_requests
  set status='approved', approved_class_id=v_target_class,
      approved_assignment_type=v_assignment_type,
      admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),
      reviewed_by=v_admin, reviewed_at=now(), updated_at=now()
  where id=p_request_id;

  insert into attendance_private.teacher_access_audit(
    request_id, subject_user_id, school_id, class_id, action, actor_user_id, details
  ) values (
    p_request_id, v_req.user_id, v_req.school_id, v_target_class,
    'request_approved', v_admin,
    jsonb_build_object('class_code',v_class_code,'assignment_type',v_assignment_type,'admin_note',nullif(btrim(coalesce(p_admin_note,'')),''))
  );

  return jsonb_build_object(
    'ok',true,'status','approved','request_id',p_request_id,
    'user_id',v_req.user_id,'class_id',v_target_class,'class_code',v_class_code,
    'assignment_type',v_assignment_type
  );
end;
$function$;

-- Deterministic historical backfill: only generic teacher assignments whose exact
-- user/class pair has one unambiguous approved assignment type are promoted.
with authoritative as (
  select
    user_id,
    approved_class_id as class_id,
    min(approved_assignment_type) as assignment_type
  from attendance.teacher_signup_requests
  where status='approved'
    and approved_class_id is not null
    and approved_assignment_type in ('class_teacher','assistant_teacher')
  group by user_id, approved_class_id
  having count(distinct approved_assignment_type)=1
)
update attendance.teacher_class_assignments a
set role=authoritative.assignment_type,
    updated_at=now()
from authoritative
where a.user_id=authoritative.user_id
  and a.class_id=authoritative.class_id
  and a.role='teacher';

commit;
