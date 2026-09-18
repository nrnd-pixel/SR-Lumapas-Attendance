-- Phase 5C — Student movement write boundary
-- Repository/local validation first. Do not apply to production without separate approval.
--
-- Preserve the existing public RPC signatures/return shapes and movement/history
-- semantics while making Transfer In / Transfer Out / Move Class the controlled
-- write boundary for students, enrolments, and student_movements.

begin;

alter function public.attendance_admin_transfer_in(
  uuid,uuid,text,text,text,date,text,boolean,text
) security definer;

create or replace function public.attendance_admin_transfer_out(
  p_enrolment_id uuid,
  p_last_date date,
  p_remarks text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_enrol attendance.enrolments%rowtype;
  v_school_id uuid;
  v_student_name text;
  v_latest date;
  v_note text := nullif(btrim(p_remarks), '');
  v_today date := (now() at time zone 'Asia/Brunei')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from attendance.teacher_school_memberships m
    where m.user_id = (select auth.uid())
      and m.active
      and m.role = 'admin'
  ) then
    raise exception 'School administrator access is required';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Remarks must be 500 characters or fewer';
  end if;

  select e.*
  into v_enrol
  from attendance.enrolments e
  join attendance.classes c on c.id = e.class_id
  join attendance.academic_years ay on ay.id = c.academic_year_id
  where e.id = p_enrolment_id
    and e.end_date is null
    and attendance.is_school_admin(ay.school_id)
  for update of e;
  if not found then
    raise exception 'Current enrolment not found';
  end if;

  select ay.school_id, s.full_name
  into v_school_id, v_student_name
  from attendance.classes c
  join attendance.academic_years ay on ay.id = c.academic_year_id
  join attendance.students s on s.id = v_enrol.student_id
  where c.id = v_enrol.class_id;

  if p_last_date is null
     or p_last_date < v_enrol.start_date
     or p_last_date > v_today then
    raise exception 'Last day must be on or after the start date and cannot be in the future';
  end if;

  select max(dr.attendance_date)
  into v_latest
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id = ar.daily_register_id
  where ar.enrolment_id = p_enrolment_id;

  if v_latest is not null and v_latest > p_last_date then
    raise exception
      'Attendance exists through %. Choose that date or later so no saved attendance is hidden.',
      v_latest;
  end if;

  update attendance.enrolments
  set end_date = p_last_date,
      enrolment_status = 'TRANSFERRED OUT',
      remarks = coalesce(v_note, remarks),
      updated_at = now()
  where id = p_enrolment_id;

  insert into attendance.student_movements(
    school_id,
    student_id,
    movement_type,
    effective_date,
    from_class_id,
    from_enrolment_id,
    note,
    details,
    created_by
  ) values (
    v_school_id,
    v_enrol.student_id,
    'TRANSFER_OUT',
    p_last_date,
    v_enrol.class_id,
    p_enrolment_id,
    v_note,
    jsonb_build_object('last_attendance_date', v_latest),
    (select auth.uid())
  );

  return jsonb_build_object(
    'ok', true,
    'student_id', v_enrol.student_id,
    'student_name', v_student_name,
    'enrolment_id', p_enrolment_id,
    'last_date', p_last_date,
    'preserved_attendance_records', (
      select count(*)
      from attendance.attendance_records
      where enrolment_id = p_enrolment_id
    )
  );
end;
$function$;

create or replace function public.attendance_admin_move_class(
  p_enrolment_id uuid,
  p_to_class_id uuid,
  p_move_date date,
  p_remarks text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old attendance.enrolments%rowtype;
  v_from attendance.classes%rowtype;
  v_to attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_school_id uuid;
  v_student_name text;
  v_new_id uuid;
  v_order smallint;
  v_latest date;
  v_note text := nullif(btrim(p_remarks), '');
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_backfill integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from attendance.teacher_school_memberships m
    where m.user_id = (select auth.uid())
      and m.active
      and m.role = 'admin'
  ) then
    raise exception 'School administrator access is required';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Remarks must be 500 characters or fewer';
  end if;

  select e.*
  into v_old
  from attendance.enrolments e
  join attendance.classes c on c.id = e.class_id
  join attendance.academic_years ay on ay.id = c.academic_year_id
  where e.id = p_enrolment_id
    and e.end_date is null
    and attendance.is_school_admin(ay.school_id)
  for update of e;
  if not found then
    raise exception 'Current enrolment not found';
  end if;

  select *
  into v_from
  from attendance.classes
  where id = v_old.class_id;

  select *
  into v_year
  from attendance.academic_years
  where id = v_from.academic_year_id;

  v_school_id := v_year.school_id;

  select full_name
  into v_student_name
  from attendance.students
  where id = v_old.student_id;

  select *
  into v_to
  from attendance.classes
  where id = p_to_class_id
    and active
    and academic_year_id = v_from.academic_year_id;
  if not found then
    raise exception 'Destination class was not found in the same academic year';
  end if;
  if v_to.id = v_from.id then
    raise exception 'Choose a different destination class';
  end if;
  if p_move_date is null
     or p_move_date <= v_old.start_date
     or p_move_date > v_today then
    raise exception 'Move date must be after the current enrolment start date and cannot be in the future';
  end if;

  select max(dr.attendance_date)
  into v_latest
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id = ar.daily_register_id
  where ar.enrolment_id = p_enrolment_id;

  if v_latest is not null and v_latest >= p_move_date then
    raise exception
      'Attendance exists through %. Move the pupil after that date so saved class history is not altered.',
      v_latest;
  end if;

  if exists (
    select 1
    from attendance.enrolments
    where student_id = v_old.student_id
      and end_date is null
      and id <> p_enrolment_id
  ) then
    raise exception 'This pupil already has another current class enrolment';
  end if;

  select (coalesce(max(roster_order), 0) + 1)::smallint
  into v_order
  from attendance.enrolments
  where class_id = p_to_class_id
    and end_date is null;

  update attendance.enrolments
  set end_date = p_move_date - 1,
      enrolment_status = 'MOVED CLASS',
      remarks = coalesce(v_note, remarks),
      updated_at = now()
  where id = p_enrolment_id;

  insert into attendance.enrolments(
    student_id,
    class_id,
    start_date,
    end_date,
    reporting_group,
    include_in_class_stats,
    active,
    enrolment_status,
    remarks,
    roster_order
  ) values (
    v_old.student_id,
    p_to_class_id,
    p_move_date,
    null,
    v_old.reporting_group,
    v_old.include_in_class_stats,
    true,
    'ENROLLED',
    v_note,
    v_order
  )
  returning id into v_new_id;

  select count(*)
  into v_backfill
  from attendance.daily_registers
  where class_id = p_to_class_id
    and attendance_date >= p_move_date;

  insert into attendance.student_movements(
    school_id,
    student_id,
    movement_type,
    effective_date,
    from_class_id,
    to_class_id,
    from_enrolment_id,
    to_enrolment_id,
    note,
    details,
    created_by
  ) values (
    v_school_id,
    v_old.student_id,
    'MOVE_CLASS',
    p_move_date,
    v_from.id,
    v_to.id,
    p_enrolment_id,
    v_new_id,
    v_note,
    jsonb_build_object(
      'from_class_code', v_from.class_code,
      'to_class_code', v_to.class_code,
      'preserved_attendance_records', (
        select count(*)
        from attendance.attendance_records
        where enrolment_id = p_enrolment_id
      ),
      'backfill_registers', v_backfill
    ),
    (select auth.uid())
  );

  return jsonb_build_object(
    'ok', true,
    'student_id', v_old.student_id,
    'student_name', v_student_name,
    'from_class_id', v_from.id,
    'to_class_id', v_to.id,
    'from_enrolment_id', p_enrolment_id,
    'to_enrolment_id', v_new_id,
    'move_date', p_move_date,
    'backfill_registers', v_backfill,
    'preserved_attendance_records', (
      select count(*)
      from attendance.attendance_records
      where enrolment_id = p_enrolment_id
    )
  );
end;
$function$;

revoke insert, update, delete
  on attendance.students, attendance.enrolments, attendance.student_movements
  from authenticated;

commit;
