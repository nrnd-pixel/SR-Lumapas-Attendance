-- SR Lumapas Attendance Phase 6B enrolment-lifecycle verifier
-- Synthetic/local validation ONLY. No production data or credentials.
--
-- PASS condition:
--   * every SELECT below returns zero rows;
--   * every DO block completes without raising;
--   * every synthetic write exercise is transaction-isolated and ROLLBACKs.
--
-- This verifier intentionally proves that active remains independent from
-- lifecycle state: closed historical enrolments stay active=true so reports for
-- dates on/before their end_date remain equivalent.

-- 1. The lifecycle CHECK exists and is fully validated.
select
  'enrolment_lifecycle_constraint' as check_name,
  coalesce(c.conname,'missing') as mismatch
from (values(1)) v(x)
left join pg_constraint c
  on c.conrelid='attendance.enrolments'::regclass
 and c.conname='attendance_enrolments_lifecycle_status_check'
 and c.contype='c'
where c.oid is null
   or c.convalidated is not true;

-- 2. Seed/current data must already satisfy the intended lifecycle shape.
select
  'enrolment_lifecycle_existing_shape' as check_name,
  e.id::text as mismatch
from attendance.enrolments e
where not (
  (
    e.end_date is null
    and e.enrolment_status in ('ENROLLED','TRANSFERRED IN')
  )
  or
  (
    e.end_date is not null
    and e.enrolment_status in ('TRANSFERRED OUT','MOVED CLASS')
  )
);

-- 3. Malformed lifecycle combinations must fail closed at the database layer.
begin;
do $phase6b_invalid_shapes$
declare
  v_blocked boolean;
begin
  v_blocked := false;
  begin
    update attendance.enrolments
    set enrolment_status='TRANSFERRED OUT'
    where id='20000000-0000-0000-0000-000000000001'::uuid;
  exception when check_violation then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Current enrolment accepted TRANSFERRED OUT with NULL end_date';
  end if;

  v_blocked := false;
  begin
    update attendance.enrolments
    set end_date=date '2026-03-12',
        enrolment_status='ENROLLED'
    where id='20000000-0000-0000-0000-000000000001'::uuid;
  exception when check_violation then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Ended enrolment accepted ENROLLED status';
  end if;

  v_blocked := false;
  begin
    update attendance.enrolments
    set enrolment_status='UNREVIEWED STATUS'
    where id='20000000-0000-0000-0000-000000000001'::uuid;
  exception when check_violation then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Unknown enrolment lifecycle status was accepted';
  end if;
end
$phase6b_invalid_shapes$;
rollback;

-- 4. Transfer Out closes by end_date/status while preserving active=true and
--    exact historical report facts through the pupil's last eligible day.
begin;
do $phase6b_transfer_out_history$
declare
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select attendance.reporting_class_period_facts(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-01-03',
    date '2026-03-12',
    'whole_class'
  ) into v_before;

  select public.attendance_admin_transfer_out(
    '20000000-0000-0000-0000-000000000001'::uuid,
    date '2026-03-12',
    'Phase 6B rollback-only history equivalence'
  ) into v_result;

  if not exists (
    select 1
    from attendance.enrolments e
    where e.id='20000000-0000-0000-0000-000000000001'::uuid
      and e.active
      and e.end_date=date '2026-03-12'
      and e.enrolment_status='TRANSFERRED OUT'
  ) then
    raise exception 'Transfer Out did not preserve active historical enrolment semantics';
  end if;

  if coalesce((v_result->>'ok')::boolean,false) is not true then
    raise exception 'Transfer Out result contract failed during lifecycle verification: %', v_result;
  end if;

  select attendance.reporting_class_period_facts(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-01-03',
    date '2026-03-12',
    'whole_class'
  ) into v_after;

  if v_after is distinct from v_before then
    raise exception 'Transfer Out changed historical report facts before=% after=%', v_before, v_after;
  end if;
end
$phase6b_transfer_out_history$;
rollback;

-- 5. Move Class closes the old row with active=true, creates one valid current
--    destination row, and leaves old-class report facts through the day before
--    the move byte-equivalent.
begin;

insert into attendance.classes(
  id,academic_year_id,class_code,class_name,year_level,active
) values (
  '00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '3C-P6B',
  'Synthetic Phase 6B Destination',
  3,
  true
);

do $phase6b_move_class_history$
declare
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_new_id uuid;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000099',
    true
  );

  select attendance.reporting_class_period_facts(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-01-03',
    date '2026-03-12',
    'whole_class'
  ) into v_before;

  select public.attendance_admin_move_class(
    '20000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    date '2026-03-13',
    'Phase 6B rollback-only history equivalence'
  ) into v_result;

  v_new_id := (v_result->>'to_enrolment_id')::uuid;

  if not exists (
    select 1
    from attendance.enrolments e
    where e.id='20000000-0000-0000-0000-000000000002'::uuid
      and e.active
      and e.end_date=date '2026-03-12'
      and e.enrolment_status='MOVED CLASS'
  ) then
    raise exception 'Move Class old enrolment did not preserve active historical semantics';
  end if;

  if not exists (
    select 1
    from attendance.enrolments e
    where e.id=v_new_id
      and e.active
      and e.end_date is null
      and e.enrolment_status='ENROLLED'
      and e.class_id='00000000-0000-0000-0000-000000000006'::uuid
  ) then
    raise exception 'Move Class destination enrolment violates current lifecycle shape';
  end if;

  if coalesce((v_result->>'ok')::boolean,false) is not true then
    raise exception 'Move Class result contract failed during lifecycle verification: %', v_result;
  end if;

  select attendance.reporting_class_period_facts(
    '00000000-0000-0000-0000-000000000004'::uuid,
    date '2026-01-03',
    date '2026-03-12',
    'whole_class'
  ) into v_after;

  if v_after is distinct from v_before then
    raise exception 'Move Class changed old-class historical report facts before=% after=%', v_before, v_after;
  end if;
end
$phase6b_move_class_history$;

rollback;
