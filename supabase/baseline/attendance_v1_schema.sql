-- SR Lumapas Attendance v1.0 reconstructed backend baseline
-- Source: Phase 0B live structural snapshot from Supabase project rojetehazryfpcxlwtbi
-- Snapshot captured: 2026-09-13
--
-- SAFETY
--   * Fresh Supabase reconstruction target ONLY.
--   * Do NOT apply this file to the existing production project.
--   * This file intentionally uses CREATE SCHEMA without IF NOT EXISTS so an
--     accidental run against the existing project fails at the first statement.
--   * Contains no Science objects and no production pupil/teacher/attendance rows.
--
-- The live project remains the operational source of truth until this baseline
-- has been recreated and verified in a fresh non-production database.

begin;

create schema attendance;
create schema attendance_private;

revoke all on schema attendance from public, anon, authenticated, service_role;
grant usage on schema attendance to authenticated, service_role;

revoke all on schema attendance_private from public, anon, authenticated, service_role;


create table attendance.schools (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_code text NOT NULL,
  school_name text NOT NULL,
  timezone text DEFAULT 'Asia/Brunei'::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.academic_years (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  year_no smallint NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.terms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academic_year_id uuid NOT NULL,
  term_no smallint NOT NULL,
  term_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.classes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academic_year_id uuid NOT NULL,
  class_code text NOT NULL,
  class_name text NOT NULL,
  year_level smallint,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  student_ref text NOT NULL,
  full_name text NOT NULL,
  gender text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.enrolments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date,
  reporting_group text DEFAULT 'Mainstream'::text NOT NULL,
  include_in_class_stats boolean DEFAULT true NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  enrolment_status text DEFAULT 'ENROLLED'::text NOT NULL,
  remarks text,
  roster_order smallint
);


create table attendance.attendance_codes (
  code text NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  counts_as_present boolean DEFAULT false NOT NULL,
  counts_as_absent boolean DEFAULT false NOT NULL,
  is_late boolean DEFAULT false NOT NULL,
  active boolean DEFAULT true NOT NULL,
  sort_order smallint DEFAULT 100 NOT NULL
);


create table attendance.absence_reasons (
  code text NOT NULL,
  label text NOT NULL,
  requires_note boolean DEFAULT false NOT NULL,
  active boolean DEFAULT true NOT NULL,
  sort_order smallint DEFAULT 100 NOT NULL
);


create table attendance.calendar_dates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academic_year_id uuid NOT NULL,
  calendar_date date NOT NULL,
  is_school_day boolean DEFAULT true NOT NULL,
  term_id uuid,
  label text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.settings (
  school_id uuid NOT NULL,
  good_threshold numeric(5,4) DEFAULT 0.95 NOT NULL,
  monitor_threshold numeric(5,4) DEFAULT 0.90 NOT NULL,
  decline_threshold numeric(5,4) DEFAULT 0.05 NOT NULL,
  min_term_recorded_days smallint DEFAULT 10 NOT NULL,
  late_count_for_one_absence smallint DEFAULT 3 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.teacher_school_memberships (
  user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  role text DEFAULT 'teacher'::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.teacher_class_assignments (
  user_id uuid NOT NULL,
  class_id uuid NOT NULL,
  role text DEFAULT 'teacher'::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.teacher_signup_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  requested_class_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  requested_role text DEFAULT 'class_teacher'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  approved_class_id uuid,
  approved_assignment_type text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.daily_registers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  attendance_date date NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  started_by uuid DEFAULT auth.uid(),
  submitted_by uuid,
  submitted_at timestamp with time zone,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  correction_count integer DEFAULT 0 NOT NULL,
  last_corrected_at timestamp with time zone,
  last_corrected_by uuid,
  last_correction_reason text
);


create table attendance.attendance_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daily_register_id uuid NOT NULL,
  enrolment_id uuid NOT NULL,
  status_code text NOT NULL,
  reason_code text,
  note text,
  source text DEFAULT 'web'::text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance.student_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  movement_type text NOT NULL,
  effective_date date NOT NULL,
  from_class_id uuid,
  to_class_id uuid,
  from_enrolment_id uuid,
  to_enrolment_id uuid,
  note text,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid DEFAULT auth.uid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);


create table attendance_private.attendance_record_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  attendance_record_id uuid,
  action text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  old_row jsonb,
  new_row jsonb,
  change_batch_id uuid,
  correction_reason text
);


create table attendance_private.teacher_access_audit (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid,
  subject_user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Constraints

alter table attendance.absence_reasons add constraint absence_reasons_pkey PRIMARY KEY (code);
alter table attendance.academic_years add constraint academic_years_check CHECK (end_date >= start_date);
alter table attendance.academic_years add constraint academic_years_pkey PRIMARY KEY (id);
alter table attendance.academic_years add constraint academic_years_school_id_year_no_key UNIQUE (school_id, year_no);
alter table attendance.academic_years add constraint academic_years_year_no_check CHECK (year_no >= 2000 AND year_no <= 2100);
alter table attendance.attendance_codes add constraint attendance_codes_category_check CHECK (category = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text, 'other'::text]));
alter table attendance.attendance_codes add constraint attendance_codes_check CHECK (NOT (counts_as_present AND counts_as_absent));
alter table attendance.attendance_codes add constraint attendance_codes_pkey PRIMARY KEY (code);
alter table attendance.attendance_records add constraint attendance_records_daily_register_id_enrolment_id_key UNIQUE (daily_register_id, enrolment_id);
alter table attendance.attendance_records add constraint attendance_records_pkey PRIMARY KEY (id);
alter table attendance.attendance_records add constraint attendance_records_source_check CHECK (source = ANY (ARRAY['web'::text, 'import'::text, 'admin'::text]));
alter table attendance.calendar_dates add constraint calendar_dates_academic_year_id_calendar_date_key UNIQUE (academic_year_id, calendar_date);
alter table attendance.calendar_dates add constraint calendar_dates_pkey PRIMARY KEY (id);
alter table attendance.classes add constraint classes_academic_year_id_class_code_key UNIQUE (academic_year_id, class_code);
alter table attendance.classes add constraint classes_pkey PRIMARY KEY (id);
alter table attendance.daily_registers add constraint daily_registers_class_id_attendance_date_key UNIQUE (class_id, attendance_date);
alter table attendance.daily_registers add constraint daily_registers_correction_count_check CHECK (correction_count >= 0);
alter table attendance.daily_registers add constraint daily_registers_last_correction_reason_check CHECK (last_correction_reason IS NULL OR char_length(last_correction_reason) <= 500);
alter table attendance.daily_registers add constraint daily_registers_pkey PRIMARY KEY (id);
alter table attendance.daily_registers add constraint daily_registers_status_check CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text]));
alter table attendance.enrolments add constraint enrolments_check CHECK (end_date IS NULL OR end_date >= start_date);
alter table attendance.enrolments add constraint enrolments_pkey PRIMARY KEY (id);
alter table attendance.enrolments add constraint enrolments_student_id_class_id_start_date_key UNIQUE (student_id, class_id, start_date);
alter table attendance.schools add constraint schools_pkey PRIMARY KEY (id);
alter table attendance.schools add constraint schools_school_code_key UNIQUE (school_code);
alter table attendance.settings add constraint settings_check CHECK (good_threshold >= monitor_threshold);
alter table attendance.settings add constraint settings_decline_threshold_check CHECK (decline_threshold >= 0::numeric AND decline_threshold <= 1::numeric);
alter table attendance.settings add constraint settings_good_threshold_check CHECK (good_threshold >= 0::numeric AND good_threshold <= 1::numeric);
alter table attendance.settings add constraint settings_late_count_for_one_absence_check CHECK (late_count_for_one_absence > 0);
alter table attendance.settings add constraint settings_min_term_recorded_days_check CHECK (min_term_recorded_days >= 0);
alter table attendance.settings add constraint settings_monitor_threshold_check CHECK (monitor_threshold >= 0::numeric AND monitor_threshold <= 1::numeric);
alter table attendance.settings add constraint settings_pkey PRIMARY KEY (school_id);
alter table attendance.student_movements add constraint student_movements_details_check CHECK (jsonb_typeof(details) = 'object'::text);
alter table attendance.student_movements add constraint student_movements_movement_type_check CHECK (movement_type = ANY (ARRAY['TRANSFER_IN'::text, 'TRANSFER_OUT'::text, 'MOVE_CLASS'::text]));
alter table attendance.student_movements add constraint student_movements_note_check CHECK (note IS NULL OR char_length(note) <= 500);
alter table attendance.student_movements add constraint student_movements_pkey PRIMARY KEY (id);
alter table attendance.students add constraint students_pkey PRIMARY KEY (id);
alter table attendance.students add constraint students_school_id_student_ref_key UNIQUE (school_id, student_ref);
alter table attendance.teacher_class_assignments add constraint teacher_class_assignments_pkey PRIMARY KEY (user_id, class_id);
alter table attendance.teacher_class_assignments add constraint teacher_class_assignments_role_check CHECK (role = ANY (ARRAY['teacher'::text, 'viewer'::text]));
alter table attendance.teacher_school_memberships add constraint teacher_school_memberships_pkey PRIMARY KEY (user_id, school_id);
alter table attendance.teacher_school_memberships add constraint teacher_school_memberships_role_check CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'viewer'::text]));
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_approved_assignment_type_check CHECK (approved_assignment_type IS NULL OR (approved_assignment_type = ANY (ARRAY['class_teacher'::text, 'assistant_teacher'::text])));
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_full_name_check CHECK (char_length(btrim(full_name)) >= 2 AND char_length(btrim(full_name)) <= 120);
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_pkey PRIMARY KEY (id);
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_requested_role_check CHECK (requested_role = ANY (ARRAY['class_teacher'::text, 'assistant_teacher'::text]));
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
alter table attendance.terms add constraint terms_academic_year_id_term_no_key UNIQUE (academic_year_id, term_no);
alter table attendance.terms add constraint terms_check CHECK (end_date >= start_date);
alter table attendance.terms add constraint terms_pkey PRIMARY KEY (id);
alter table attendance.terms add constraint terms_term_no_check CHECK (term_no >= 1 AND term_no <= 12);
alter table attendance_private.attendance_record_audit add constraint attendance_record_audit_action_check CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]));
alter table attendance_private.attendance_record_audit add constraint attendance_record_audit_pkey PRIMARY KEY (audit_id);
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_pkey PRIMARY KEY (id);
alter table attendance.academic_years add constraint academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance.attendance_records add constraint attendance_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.attendance_records add constraint attendance_records_daily_register_id_fkey FOREIGN KEY (daily_register_id) REFERENCES attendance.daily_registers(id) ON DELETE CASCADE;
alter table attendance.attendance_records add constraint attendance_records_enrolment_id_fkey FOREIGN KEY (enrolment_id) REFERENCES attendance.enrolments(id) ON DELETE CASCADE;
alter table attendance.attendance_records add constraint attendance_records_reason_code_fkey FOREIGN KEY (reason_code) REFERENCES attendance.absence_reasons(code);
alter table attendance.attendance_records add constraint attendance_records_status_code_fkey FOREIGN KEY (status_code) REFERENCES attendance.attendance_codes(code);
alter table attendance.attendance_records add constraint attendance_records_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.calendar_dates add constraint calendar_dates_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES attendance.academic_years(id) ON DELETE CASCADE;
alter table attendance.calendar_dates add constraint calendar_dates_term_id_fkey FOREIGN KEY (term_id) REFERENCES attendance.terms(id) ON DELETE SET NULL;
alter table attendance.classes add constraint classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES attendance.academic_years(id) ON DELETE CASCADE;
alter table attendance.daily_registers add constraint daily_registers_class_id_fkey FOREIGN KEY (class_id) REFERENCES attendance.classes(id) ON DELETE CASCADE;
alter table attendance.daily_registers add constraint daily_registers_started_by_fkey FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.daily_registers add constraint daily_registers_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.daily_registers add constraint daily_registers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.enrolments add constraint enrolments_class_id_fkey FOREIGN KEY (class_id) REFERENCES attendance.classes(id) ON DELETE CASCADE;
alter table attendance.enrolments add constraint enrolments_student_id_fkey FOREIGN KEY (student_id) REFERENCES attendance.students(id) ON DELETE CASCADE;
alter table attendance.settings add constraint settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance.student_movements add constraint student_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table attendance.student_movements add constraint student_movements_from_class_id_fkey FOREIGN KEY (from_class_id) REFERENCES attendance.classes(id);
alter table attendance.student_movements add constraint student_movements_from_enrolment_id_fkey FOREIGN KEY (from_enrolment_id) REFERENCES attendance.enrolments(id);
alter table attendance.student_movements add constraint student_movements_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id);
alter table attendance.student_movements add constraint student_movements_student_id_fkey FOREIGN KEY (student_id) REFERENCES attendance.students(id);
alter table attendance.student_movements add constraint student_movements_to_class_id_fkey FOREIGN KEY (to_class_id) REFERENCES attendance.classes(id);
alter table attendance.student_movements add constraint student_movements_to_enrolment_id_fkey FOREIGN KEY (to_enrolment_id) REFERENCES attendance.enrolments(id);
alter table attendance.students add constraint students_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance.teacher_class_assignments add constraint teacher_class_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES attendance.classes(id) ON DELETE CASCADE;
alter table attendance.teacher_class_assignments add constraint teacher_class_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table attendance.teacher_school_memberships add constraint teacher_school_memberships_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance.teacher_school_memberships add constraint teacher_school_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_approved_class_id_fkey FOREIGN KEY (approved_class_id) REFERENCES attendance.classes(id) ON DELETE RESTRICT;
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_requested_class_id_fkey FOREIGN KEY (requested_class_id) REFERENCES attendance.classes(id) ON DELETE RESTRICT;
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance.teacher_signup_requests add constraint teacher_signup_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table attendance.terms add constraint terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES attendance.academic_years(id) ON DELETE CASCADE;
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_class_id_fkey FOREIGN KEY (class_id) REFERENCES attendance.classes(id) ON DELETE SET NULL;
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_request_id_fkey FOREIGN KEY (request_id) REFERENCES attendance.teacher_signup_requests(id) ON DELETE SET NULL;
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_school_id_fkey FOREIGN KEY (school_id) REFERENCES attendance.schools(id) ON DELETE CASCADE;
alter table attendance_private.teacher_access_audit add constraint teacher_access_audit_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Non-constraint indexes

CREATE INDEX attendance_calendar_dates_date_idx ON attendance.calendar_dates USING btree (calendar_date);
CREATE INDEX attendance_calendar_term_idx ON attendance.calendar_dates USING btree (term_id);
CREATE INDEX attendance_class_assignments_class_idx ON attendance.teacher_class_assignments USING btree (class_id);
CREATE INDEX attendance_daily_registers_date_idx ON attendance.daily_registers USING btree (attendance_date);
CREATE INDEX attendance_enrolments_class_idx ON attendance.enrolments USING btree (class_id);
CREATE INDEX attendance_enrolments_class_roster_idx ON attendance.enrolments USING btree (class_id, roster_order);
CREATE INDEX attendance_enrolments_student_idx ON attendance.enrolments USING btree (student_id);
CREATE UNIQUE INDEX attendance_one_current_enrolment_per_student_idx ON attendance.enrolments USING btree (student_id) WHERE (end_date IS NULL);
CREATE INDEX attendance_records_created_by_idx ON attendance.attendance_records USING btree (created_by);
CREATE INDEX attendance_records_enrolment_idx ON attendance.attendance_records USING btree (enrolment_id);
CREATE INDEX attendance_records_reason_code_idx ON attendance.attendance_records USING btree (reason_code);
CREATE INDEX attendance_records_register_idx ON attendance.attendance_records USING btree (daily_register_id);
CREATE INDEX attendance_records_status_code_idx ON attendance.attendance_records USING btree (status_code);
CREATE INDEX attendance_records_updated_by_idx ON attendance.attendance_records USING btree (updated_by);
CREATE INDEX attendance_registers_started_by_idx ON attendance.daily_registers USING btree (started_by);
CREATE INDEX attendance_registers_submitted_by_idx ON attendance.daily_registers USING btree (submitted_by);
CREATE INDEX attendance_registers_updated_by_idx ON attendance.daily_registers USING btree (updated_by);
CREATE INDEX attendance_school_memberships_school_idx ON attendance.teacher_school_memberships USING btree (school_id);
CREATE INDEX attendance_student_movements_created_by_idx ON attendance.student_movements USING btree (created_by);
CREATE INDEX attendance_student_movements_from_class_idx ON attendance.student_movements USING btree (from_class_id);
CREATE INDEX attendance_student_movements_from_enrolment_idx ON attendance.student_movements USING btree (from_enrolment_id);
CREATE INDEX attendance_student_movements_school_idx ON attendance.student_movements USING btree (school_id, created_at DESC);
CREATE INDEX attendance_student_movements_student_idx ON attendance.student_movements USING btree (student_id, effective_date DESC, created_at DESC);
CREATE INDEX attendance_student_movements_to_class_idx ON attendance.student_movements USING btree (to_class_id);
CREATE INDEX attendance_student_movements_to_enrolment_idx ON attendance.student_movements USING btree (to_enrolment_id);
CREATE UNIQUE INDEX teacher_signup_requests_one_pending_per_user ON attendance.teacher_signup_requests USING btree (user_id) WHERE (status = 'pending'::text);
CREATE INDEX teacher_signup_requests_school_status_idx ON attendance.teacher_signup_requests USING btree (school_id, status, created_at DESC);
CREATE INDEX teacher_signup_requests_user_created_idx ON attendance.teacher_signup_requests USING btree (user_id, created_at DESC);
CREATE INDEX teacher_access_audit_school_idx ON attendance_private.teacher_access_audit USING btree (school_id, created_at DESC);
CREATE INDEX teacher_access_audit_subject_idx ON attendance_private.teacher_access_audit USING btree (subject_user_id, created_at DESC);

-- Functions

CREATE OR REPLACE FUNCTION attendance_private.audit_attendance_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reason text := nullif(current_setting('attendance.correction_reason', true), '');
  v_batch_text text := nullif(current_setting('attendance.change_batch_id', true), '');
  v_batch uuid;
begin
  if v_batch_text is not null then
    v_batch := v_batch_text::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into attendance_private.attendance_record_audit(
      attendance_record_id, action, changed_by, old_row, new_row,
      change_batch_id, correction_reason
    ) values (
      new.id, 'INSERT', auth.uid(), null, to_jsonb(new),
      v_batch, v_reason
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into attendance_private.attendance_record_audit(
      attendance_record_id, action, changed_by, old_row, new_row,
      change_batch_id, correction_reason
    ) values (
      new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new),
      v_batch, v_reason
    );
    return new;
  else
    insert into attendance_private.attendance_record_audit(
      attendance_record_id, action, changed_by, old_row, new_row,
      change_batch_id, correction_reason
    ) values (
      old.id, 'DELETE', auth.uid(), to_jsonb(old), null,
      v_batch, v_reason
    );
    return old;
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION attendance_private.stamp_record_actor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION attendance_private.stamp_register_actor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.started_by := coalesce(new.started_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
    if new.status = 'submitted' then
      new.submitted_at := coalesce(new.submitted_at, now());
      new.submitted_by := coalesce(new.submitted_by, auth.uid());
    end if;
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    if new.status = 'submitted' and (old.status is distinct from 'submitted' or old.submitted_at is null) then
      new.submitted_at := now();
      new.submitted_by := auth.uid();
    end if;
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION attendance_private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION attendance.can_access_class(target_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from attendance.classes c
       join attendance.academic_years ay on ay.id = c.academic_year_id
       where c.id = target_class_id
         and (
           exists (
             select 1
             from attendance.teacher_school_memberships m
             where m.school_id = ay.school_id
               and m.user_id = (select auth.uid())
               and m.active
               and m.role = 'admin'
           )
           or exists (
             select 1
             from attendance.teacher_class_assignments a
             where a.class_id = c.id
               and a.user_id = (select auth.uid())
               and a.active
           )
         )
     );
$function$

CREATE OR REPLACE FUNCTION attendance.is_school_admin(target_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from attendance.teacher_school_memberships m
       where m.school_id = target_school_id
         and m.user_id = (select auth.uid())
         and m.active
         and m.role = 'admin'
     );
$function$

CREATE OR REPLACE FUNCTION attendance.is_school_member(target_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from attendance.teacher_school_memberships m
       where m.school_id = target_school_id
         and m.user_id = (select auth.uid())
         and m.active
     );
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_move_class(p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Remarks must be 500 characters or fewer';
  end if;

  select e.* into v_old
  from attendance.enrolments e
  where e.id = p_enrolment_id and e.end_date is null
  for update;
  if not found then raise exception 'Current enrolment not found'; end if;

  select * into v_from from attendance.classes where id = v_old.class_id;
  select * into v_year from attendance.academic_years where id = v_from.academic_year_id;
  v_school_id := v_year.school_id;
  select full_name into v_student_name
  from attendance.students where id = v_old.student_id;
  if not attendance.is_school_admin(v_school_id) then
    raise exception 'School administrator access is required';
  end if;

  select * into v_to from attendance.classes
  where id = p_to_class_id and active and academic_year_id = v_from.academic_year_id;
  if not found then raise exception 'Destination class was not found in the same academic year'; end if;
  if v_to.id = v_from.id then raise exception 'Choose a different destination class'; end if;
  if p_move_date is null or p_move_date <= v_old.start_date or p_move_date > v_today then
    raise exception 'Move date must be after the current enrolment start date and cannot be in the future';
  end if;

  select max(dr.attendance_date) into v_latest
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id = ar.daily_register_id
  where ar.enrolment_id = p_enrolment_id;
  if v_latest is not null and v_latest >= p_move_date then
    raise exception 'Attendance exists through %. Move the pupil after that date so saved class history is not altered.', v_latest;
  end if;

  if exists (
    select 1 from attendance.enrolments
    where student_id = v_old.student_id and end_date is null and id <> p_enrolment_id
  ) then
    raise exception 'This pupil already has another current class enrolment';
  end if;

  select (coalesce(max(roster_order), 0) + 1)::smallint into v_order
  from attendance.enrolments
  where class_id = p_to_class_id and end_date is null;

  update attendance.enrolments
  set end_date = p_move_date - 1,
      enrolment_status = 'MOVED CLASS',
      remarks = coalesce(v_note, remarks),
      updated_at = now()
  where id = p_enrolment_id;

  insert into attendance.enrolments(
    student_id, class_id, start_date, end_date, reporting_group,
    include_in_class_stats, active, enrolment_status, remarks, roster_order
  ) values (
    v_old.student_id, p_to_class_id, p_move_date, null, v_old.reporting_group,
    v_old.include_in_class_stats, true, 'ENROLLED', v_note, v_order
  ) returning id into v_new_id;

  select count(*) into v_backfill
  from attendance.daily_registers
  where class_id = p_to_class_id and attendance_date >= p_move_date;

  insert into attendance.student_movements(
    school_id, student_id, movement_type, effective_date,
    from_class_id, to_class_id, from_enrolment_id, to_enrolment_id,
    note, details, created_by
  ) values (
    v_school_id, v_old.student_id, 'MOVE_CLASS', p_move_date,
    v_from.id, v_to.id, p_enrolment_id, v_new_id,
    v_note,
    jsonb_build_object(
      'from_class_code', v_from.class_code,
      'to_class_code', v_to.class_code,
      'preserved_attendance_records', (
        select count(*) from attendance.attendance_records where enrolment_id = p_enrolment_id
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
      select count(*) from attendance.attendance_records where enrolment_id = p_enrolment_id
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_review_teacher_request(p_request_id uuid, p_action text, p_class_id uuid DEFAULT NULL::uuid, p_assignment_type text DEFAULT NULL::text, p_admin_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  values(v_req.user_id,v_target_class,'teacher',true)
  on conflict (user_id,class_id) do update
    set role='teacher', active=true, updated_at=now();

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
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_school_dashboard(p_school_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_month_start date;
  v_month_end date;
  v_year attendance.academic_years%rowtype;
  v_latest_school_day date;
  v_class record;
  v_stats jsonb;
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
  if not attendance.is_school_admin(p_school_id) then raise exception 'School administrator access is required'; end if;

  v_month_start := date_trunc('month', p_month)::date;
  v_month_end := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;

  select ay.* into v_year
  from attendance.academic_years ay
  where ay.school_id = p_school_id
    and ay.active
    and ay.start_date <= v_month_end
    and ay.end_date >= v_month_start
  order by ay.year_no desc
  limit 1;
  if not found then raise exception 'No active academic year covers this month'; end if;

  select max(cd.calendar_date) into v_latest_school_day
  from attendance.calendar_dates cd
  where cd.academic_year_id = v_year.id
    and cd.is_school_day
    and cd.calendar_date between greatest(v_month_start, v_year.start_date)
                             and least(v_month_end, v_year.end_date, v_today);

  for v_class in
    select c.id, c.class_code, c.class_name, c.year_level
    from attendance.classes c
    where c.academic_year_id = v_year.id and c.active
    order by c.year_level, c.class_code
  loop
    v_class_count := v_class_count + 1;
    v_stats := public.attendance_monthly_class_stats(v_class.id, v_month_start);

    v_total_cumulative := v_total_cumulative + coalesce((v_stats #>> '{summary,cumulative_total}')::integer,0);
    v_total_possible := v_total_possible + coalesce((v_stats #>> '{summary,possible_attendance}')::integer,0);
    v_total_completed := v_total_completed + coalesce((v_stats #>> '{summary,registers_completed}')::integer,0);
    v_total_missing := v_total_missing + coalesce((v_stats #>> '{summary,registers_missing}')::integer,0);
    if coalesce((v_stats #>> '{roster,gender_complete}')::boolean,false) = false then
      v_gender_incomplete := v_gender_incomplete + 1;
    end if;

    v_classes := v_classes || jsonb_build_array(jsonb_build_object(
      'class_id', v_class.id,
      'class_code', v_class.class_code,
      'class_name', v_class.class_name,
      'year_level', v_class.year_level,
      'pupils', coalesce((v_stats #>> '{roster,pupils_seen_in_month}')::integer,0),
      'gender_complete', coalesce((v_stats #>> '{roster,gender_complete}')::boolean,false),
      'gender_unknown_pupils', coalesce((v_stats #>> '{roster,gender_unknown_pupils}')::integer,0),
      'registers_completed', coalesce((v_stats #>> '{summary,registers_completed}')::integer,0),
      'registers_missing', coalesce((v_stats #>> '{summary,registers_missing}')::integer,0),
      'possible_attendance', coalesce((v_stats #>> '{summary,possible_attendance}')::integer,0),
      'cumulative_total', coalesce((v_stats #>> '{summary,cumulative_total}')::integer,0),
      'average_attendance', case when (v_stats #>> '{summary,average_attendance}') is null then null else (v_stats #>> '{summary,average_attendance}')::numeric end,
      'attendance_percentage', case when (v_stats #>> '{summary,attendance_percentage}') is null then null else (v_stats #>> '{summary,attendance_percentage}')::numeric end,
      'provisional', coalesce((v_stats #>> '{summary,provisional}')::boolean,true)
    ));

    if v_latest_school_day is not null then
      select exists(
        select 1 from attendance.daily_registers dr
        where dr.class_id = v_class.id and dr.attendance_date = v_latest_school_day
      ) into v_latest_exists;

      select count(*)::int into v_latest_eligible
      from attendance.enrolments e
      join attendance.students s on s.id=e.student_id and s.active
      where e.class_id=v_class.id and e.active
        and e.start_date <= v_latest_school_day
        and (e.end_date is null or e.end_date >= v_latest_school_day);

      select count(*)::int into v_latest_attendance
      from attendance.daily_registers dr
      join attendance.attendance_records ar on ar.daily_register_id=dr.id
      join attendance.attendance_codes ac on ac.code=ar.status_code and ac.counts_as_present
      where dr.class_id=v_class.id and dr.attendance_date=v_latest_school_day;

      if v_latest_exists then v_latest_completed := v_latest_completed + 1;
      else v_latest_missing := v_latest_missing + 1; end if;

      v_latest_items := v_latest_items || jsonb_build_array(jsonb_build_object(
        'class_id',v_class.id,
        'class_code',v_class.class_code,
        'year_level',v_class.year_level,
        'register_exists',v_latest_exists,
        'eligible_students',coalesce(v_latest_eligible,0),
        'attendance',coalesce(v_latest_attendance,0)
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'school_id', p_school_id,
    'year_no', v_year.year_no,
    'month', to_char(v_month_start,'YYYY-MM'),
    'as_of_date', least(v_month_end,v_year.end_date,v_today),
    'summary', jsonb_build_object(
      'class_count',v_class_count,
      'registers_completed',v_total_completed,
      'registers_missing',v_total_missing,
      'cumulative_total',v_total_cumulative,
      'possible_attendance',v_total_possible,
      'average_attendance',case when v_total_possible>0 then round(v_total_cumulative::numeric/v_total_possible,4) else null end,
      'attendance_percentage',case when v_total_possible>0 then round((v_total_cumulative::numeric/v_total_possible)*100,2) else null end,
      'gender_incomplete_classes',v_gender_incomplete,
      'provisional',(v_total_missing>0 or least(v_month_end,v_year.end_date,v_today)<v_month_end)
    ),
    'latest_school_day', jsonb_build_object(
      'date',v_latest_school_day,
      'classes_completed',v_latest_completed,
      'classes_missing',v_latest_missing,
      'classes',v_latest_items
    ),
    'classes',v_classes
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_set_teacher_active(p_user_id uuid, p_school_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin uuid := (select auth.uid());
begin
  if v_admin is null then raise exception 'Authentication required'; end if;
  if not attendance.is_school_admin(p_school_id) then raise exception 'Admin access required'; end if;
  if not exists(
    select 1 from attendance.teacher_school_memberships m
    where m.user_id=p_user_id and m.school_id=p_school_id and m.role <> 'admin'
  ) then raise exception 'Teacher membership not found'; end if;

  update attendance.teacher_school_memberships
  set active=p_active, updated_at=now()
  where user_id=p_user_id and school_id=p_school_id and role <> 'admin';

  update attendance.teacher_class_assignments a
  set active=p_active, updated_at=now()
  where a.user_id=p_user_id
    and exists(
      select 1 from attendance.classes c
      join attendance.academic_years ay on ay.id=c.academic_year_id
      where c.id=a.class_id and ay.school_id=p_school_id
    );

  insert into attendance_private.teacher_access_audit(
    subject_user_id, school_id, action, actor_user_id, details
  ) values (
    p_user_id, p_school_id, case when p_active then 'access_enabled' else 'access_disabled' end,
    v_admin, jsonb_build_object('attendance_only',true)
  );

  return jsonb_build_object('ok',true,'user_id',p_user_id,'school_id',p_school_id,'active',p_active);
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_student_roster(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not attendance.is_school_admin(p_school_id) then
    raise exception 'School administrator access is required';
  end if;

  select jsonb_build_object(
    'school_id', p_school_id,
    'total_current', (
      select count(*)
      from attendance.enrolments e
      join attendance.students s on s.id = e.student_id
      join attendance.classes c on c.id = e.class_id
      join attendance.academic_years ay on ay.id = c.academic_year_id
      where ay.school_id = p_school_id
        and ay.active and c.active and e.active and s.active
        and e.end_date is null
    ),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'class_code', q.class_code,
        'class_name', q.class_name,
        'year_level', q.year_level,
        'current_pupils', q.current_pupils
      ) order by q.year_level, q.class_code)
      from (
        select c.id, c.class_code, c.class_name, c.year_level,
          count(e.id) filter (
            where e.active and e.end_date is null and s.active
          ) as current_pupils
        from attendance.classes c
        join attendance.academic_years ay on ay.id = c.academic_year_id
        left join attendance.enrolments e on e.class_id = c.id
        left join attendance.students s on s.id = e.student_id
        where ay.school_id = p_school_id and ay.active and c.active
        group by c.id
      ) q
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', q.student_id,
        'student_ref', q.student_ref,
        'full_name', q.full_name,
        'gender', q.gender,
        'enrolment_id', q.enrolment_id,
        'class_id', q.class_id,
        'class_code', q.class_code,
        'class_name', q.class_name,
        'year_level', q.year_level,
        'start_date', q.start_date,
        'reporting_group', q.reporting_group,
        'include_in_class_stats', q.include_in_class_stats,
        'enrolment_status', q.enrolment_status,
        'remarks', q.remarks,
        'attendance_records', q.attendance_records,
        'last_attendance_date', q.last_attendance_date
      ) order by q.year_level, q.class_code, q.roster_order nulls last, q.full_name)
      from (
        select s.id student_id, s.student_ref, s.full_name, s.gender,
          e.id enrolment_id, e.class_id, c.class_code, c.class_name, c.year_level,
          e.start_date, e.reporting_group, e.include_in_class_stats,
          e.enrolment_status, e.remarks, e.roster_order,
          count(ar.id) as attendance_records,
          max(dr.attendance_date) as last_attendance_date
        from attendance.enrolments e
        join attendance.students s on s.id = e.student_id
        join attendance.classes c on c.id = e.class_id
        join attendance.academic_years ay on ay.id = c.academic_year_id
        left join attendance.attendance_records ar on ar.enrolment_id = e.id
        left join attendance.daily_registers dr on dr.id = ar.daily_register_id
        where ay.school_id = p_school_id
          and ay.active and c.active and e.active and s.active
          and e.end_date is null
        group by s.id, e.id, c.id
      ) q
    ), '[]'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select sm.id, sm.movement_type, sm.effective_date, sm.note, sm.created_at,
          s.student_ref, s.full_name,
          fc.class_code as from_class_code,
          tc.class_code as to_class_code
        from attendance.student_movements sm
        join attendance.students s on s.id = sm.student_id
        left join attendance.classes fc on fc.id = sm.from_class_id
        left join attendance.classes tc on tc.id = sm.to_class_id
        where sm.school_id = p_school_id
        order by sm.created_at desc
        limit 50
      ) q
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_teacher_requests(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_status text := lower(btrim(coalesce(p_status,'pending')));
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_status not in ('pending','approved','rejected','all') then
    raise exception 'Invalid status filter';
  end if;
  if not exists (
    select 1 from attendance.teacher_school_memberships m
    where m.user_id=v_user_id and m.active and m.role='admin'
  ) then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id', r.id,
    'user_id', r.user_id,
    'full_name', r.full_name,
    'email', r.email,
    'status', r.status,
    'requested_class_id', r.requested_class_id,
    'requested_class_code', rc.class_code,
    'requested_role', r.requested_role,
    'approved_class_id', r.approved_class_id,
    'approved_class_code', ac.class_code,
    'approved_assignment_type', r.approved_assignment_type,
    'admin_note', r.admin_note,
    'created_at', r.created_at,
    'reviewed_at', r.reviewed_at
  ) order by case r.status when 'pending' then 0 when 'approved' then 1 else 2 end, r.created_at desc), '[]'::jsonb)
  into v_result
  from attendance.teacher_signup_requests r
  join attendance.classes rc on rc.id=r.requested_class_id
  left join attendance.classes ac on ac.id=r.approved_class_id
  where attendance.is_school_admin(r.school_id)
    and (v_status='all' or r.status=v_status);

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_teachers()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from attendance.teacher_school_memberships m where m.user_id=v_user_id and m.active and m.role='admin') then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id,
    'email', u.email,
    'school_id', m.school_id,
    'school_name', s.school_name,
    'role', m.role,
    'active', m.active,
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('class_id',c.id,'class_code',c.class_code,'class_name',c.class_name) order by c.year_level,c.class_code)
      from attendance.teacher_class_assignments a
      join attendance.classes c on c.id=a.class_id
      join attendance.academic_years ay on ay.id=c.academic_year_id
      where a.user_id=m.user_id and a.active and ay.school_id=m.school_id
    ),'[]'::jsonb)
  ) order by lower(coalesce(u.email,''))), '[]'::jsonb)
  into v_result
  from attendance.teacher_school_memberships m
  join attendance.schools s on s.id=m.school_id
  join auth.users u on u.id=m.user_id
  where attendance.is_school_admin(m.school_id)
    and m.role <> 'admin';

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_transfer_in(p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text DEFAULT 'Mainstream'::text, p_include_in_class_stats boolean DEFAULT true, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_student attendance.students%rowtype;
  v_enrolment_id uuid;
  v_order smallint;
  v_note text := nullif(btrim(p_remarks), '');
  v_ref text := nullif(btrim(p_student_ref), '');
  v_name text := nullif(btrim(p_full_name), '');
  v_group text := coalesce(nullif(btrim(p_reporting_group), ''), 'Mainstream');
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_backfill integer;
  v_returning boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not attendance.is_school_admin(p_school_id) then
    raise exception 'School administrator access is required';
  end if;
  if v_ref is null or char_length(v_ref) > 120 then
    raise exception 'Student ID is required and must be 120 characters or fewer';
  end if;
  if v_name is null or char_length(v_name) > 220 then
    raise exception 'Student name is required and must be 220 characters or fewer';
  end if;
  if p_gender is not null and p_gender not in ('Male', 'Female', 'Other') then
    raise exception 'Gender must be Male, Female, Other, or blank';
  end if;
  if char_length(v_group) > 100 then raise exception 'Reporting group is too long'; end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Remarks must be 500 characters or fewer';
  end if;

  select c.* into v_class
  from attendance.classes c
  join attendance.academic_years ay on ay.id = c.academic_year_id
  where c.id = p_class_id and c.active and ay.active and ay.school_id = p_school_id;
  if not found then raise exception 'Class not found in this school'; end if;

  select * into v_year from attendance.academic_years where id = v_class.academic_year_id;
  if p_start_date is null or p_start_date < v_year.start_date or p_start_date > v_today then
    raise exception 'Start date must be within the academic year and cannot be in the future';
  end if;

  select * into v_student
  from attendance.students
  where school_id = p_school_id and student_ref = v_ref
  for update;

  if found then
    v_returning := true;
    if lower(btrim(v_student.full_name)) <> lower(v_name) then
      raise exception 'This Student ID already belongs to %. Check the ID or use the matching name.', v_student.full_name;
    end if;
    if exists (
      select 1 from attendance.enrolments
      where student_id = v_student.id and end_date is null
    ) then
      raise exception 'This pupil already has a current class enrolment';
    end if;
    update attendance.students
    set active = true,
        gender = coalesce(p_gender, gender),
        updated_at = now()
    where id = v_student.id;
  else
    insert into attendance.students(school_id, student_ref, full_name, gender, active)
    values (p_school_id, v_ref, v_name, p_gender, true)
    returning * into v_student;
  end if;

  select (coalesce(max(roster_order), 0) + 1)::smallint into v_order
  from attendance.enrolments
  where class_id = p_class_id and end_date is null;

  insert into attendance.enrolments(
    student_id, class_id, start_date, end_date, reporting_group,
    include_in_class_stats, active, enrolment_status, remarks, roster_order
  ) values (
    v_student.id, p_class_id, p_start_date, null, v_group,
    p_include_in_class_stats, true, 'TRANSFERRED IN', v_note, v_order
  ) returning id into v_enrolment_id;

  select count(*) into v_backfill
  from attendance.daily_registers
  where class_id = p_class_id and attendance_date >= p_start_date;

  insert into attendance.student_movements(
    school_id, student_id, movement_type, effective_date,
    to_class_id, to_enrolment_id, note, details, created_by
  ) values (
    p_school_id, v_student.id, 'TRANSFER_IN', p_start_date,
    p_class_id, v_enrolment_id, v_note,
    jsonb_build_object('returning_student', v_returning, 'backfill_registers', v_backfill),
    (select auth.uid())
  );

  return jsonb_build_object(
    'ok', true,
    'student_id', v_student.id,
    'enrolment_id', v_enrolment_id,
    'class_id', p_class_id,
    'start_date', p_start_date,
    'returning_student', v_returning,
    'backfill_registers', v_backfill
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_admin_transfer_out(p_enrolment_id uuid, p_last_date date, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_enrol attendance.enrolments%rowtype;
  v_school_id uuid;
  v_student_name text;
  v_latest date;
  v_note text := nullif(btrim(p_remarks), '');
  v_today date := (now() at time zone 'Asia/Brunei')::date;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Remarks must be 500 characters or fewer';
  end if;

  select e.* into v_enrol
  from attendance.enrolments e
  where e.id = p_enrolment_id and e.end_date is null
  for update;
  if not found then raise exception 'Current enrolment not found'; end if;

  select ay.school_id, s.full_name
  into v_school_id, v_student_name
  from attendance.classes c
  join attendance.academic_years ay on ay.id = c.academic_year_id
  join attendance.students s on s.id = v_enrol.student_id
  where c.id = v_enrol.class_id;
  if not attendance.is_school_admin(v_school_id) then
    raise exception 'School administrator access is required';
  end if;
  if p_last_date is null or p_last_date < v_enrol.start_date or p_last_date > v_today then
    raise exception 'Last day must be on or after the start date and cannot be in the future';
  end if;

  select max(dr.attendance_date) into v_latest
  from attendance.attendance_records ar
  join attendance.daily_registers dr on dr.id = ar.daily_register_id
  where ar.enrolment_id = p_enrolment_id;
  if v_latest is not null and v_latest > p_last_date then
    raise exception 'Attendance exists through %. Choose that date or later so no saved attendance is hidden.', v_latest;
  end if;

  update attendance.enrolments
  set end_date = p_last_date,
      enrolment_status = 'TRANSFERRED OUT',
      remarks = coalesce(v_note, remarks),
      updated_at = now()
  where id = p_enrolment_id;

  insert into attendance.student_movements(
    school_id, student_id, movement_type, effective_date,
    from_class_id, from_enrolment_id, note, details, created_by
  ) values (
    v_school_id, v_enrol.student_id, 'TRANSFER_OUT', p_last_date,
    v_enrol.class_id, p_enrolment_id, v_note,
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
      select count(*) from attendance.attendance_records where enrolment_id = p_enrolment_id
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_bootstrap()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', (select auth.uid()),
      'email', coalesce((select auth.jwt()->>'email'), ''),
      'school_role', coalesce((
        select case when bool_or(tsm.role = 'admin') then 'admin' else max(tsm.role) end
        from attendance.teacher_school_memberships tsm
        where tsm.user_id = (select auth.uid()) and tsm.active
      ), 'teacher'),
      'all_classes', coalesce((
        select bool_or(tsm.role = 'admin')
        from attendance.teacher_school_memberships tsm
        where tsm.user_id = (select auth.uid()) and tsm.active
      ), false)
    ),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'class_code', c.class_code,
        'class_name', c.class_name,
        'year_level', c.year_level,
        'school_id', ay.school_id,
        'school_name', s.school_name,
        'year_no', ay.year_no
      ) order by c.year_level, c.class_code)
      from attendance.classes c
      join attendance.academic_years ay on ay.id = c.academic_year_id
      join attendance.schools s on s.id = ay.school_id
      where c.active
        and ay.active
        and attendance.can_access_class(c.id)
    ), '[]'::jsonb),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code,
        'label', label,
        'category', category,
        'counts_as_present', counts_as_present,
        'counts_as_absent', counts_as_absent,
        'is_late', is_late
      ) order by sort_order, code)
      from attendance.attendance_codes
      where active
    ), '[]'::jsonb),
    'reasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code,
        'label', label,
        'requires_note', requires_note
      ) order by sort_order, code)
      from attendance.absence_reasons
      where active
    ), '[]'::jsonb)
  );
$function$

CREATE OR REPLACE FUNCTION public.attendance_class_period_report(p_class_id uuid, p_period_type text, p_term_id uuid DEFAULT NULL::uuid, p_as_of_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_type text := lower(btrim(coalesce(p_period_type,'')));
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_term attendance.terms%rowtype;
  v_start date;
  v_end date;
  v_effective_end date;
  v_label text;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not attendance.can_access_class(p_class_id) then raise exception 'You do not have access to this class'; end if;
  if v_type not in ('term','ytd') then raise exception 'Period type must be term or ytd'; end if;

  select * into v_class from attendance.classes where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;
  select * into v_year from attendance.academic_years where id=v_class.academic_year_id;

  if v_type='term' then
    if p_term_id is null then raise exception 'Term is required'; end if;
    select * into v_term from attendance.terms where id=p_term_id and academic_year_id=v_year.id;
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

  with school_days as (
    select cd.calendar_date as attendance_date
    from attendance.calendar_dates cd
    where cd.academic_year_id=v_year.id
      and cd.calendar_date between v_start and v_effective_end
      and cd.is_school_day
  ),
  eligible as (
    select sd.attendance_date,e.id enrolment_id,e.student_id,coalesce(s.gender,'') gender
    from school_days sd
    join attendance.enrolments e on e.class_id=p_class_id and e.active
      and e.start_date<=sd.attendance_date and (e.end_date is null or e.end_date>=sd.attendance_date)
    join attendance.students s on s.id=e.student_id and s.active
  ),
  marked as (
    select el.attendance_date,el.enrolment_id,el.student_id,el.gender,ar.status_code,
      coalesce(ac.counts_as_present,false) counts_as_attendance,
      (dr.id is not null) register_exists
    from eligible el
    left join attendance.daily_registers dr on dr.class_id=p_class_id and dr.attendance_date=el.attendance_date
    left join attendance.attendance_records ar on ar.daily_register_id=dr.id and ar.enrolment_id=el.enrolment_id
    left join attendance.attendance_codes ac on ac.code=ar.status_code
  ),
  daily as (
    select sd.attendance_date,
      count(el.enrolment_id)::int eligible_students,
      count(*) filter(where m.counts_as_attendance)::int total_attendance,
      count(*) filter(where m.gender='Male' and m.counts_as_attendance)::int male_attendance,
      count(*) filter(where m.gender='Female' and m.counts_as_attendance)::int female_attendance,
      count(*) filter(where m.gender not in('Male','Female') and m.counts_as_attendance)::int unknown_gender_attendance,
      count(*) filter(where m.status_code is null and m.register_exists)::int unmarked_students,
      exists(select 1 from attendance.daily_registers dr2 where dr2.class_id=p_class_id and dr2.attendance_date=sd.attendance_date) register_exists
    from school_days sd
    left join eligible el on el.attendance_date=sd.attendance_date
    left join marked m on m.attendance_date=sd.attendance_date and m.enrolment_id=el.enrolment_id
    group by sd.attendance_date
  ),
  running as (
    select d.*,
      sum(case when d.register_exists then d.male_attendance else 0 end) over(order by d.attendance_date)::int cumulative_male,
      sum(case when d.register_exists then d.female_attendance else 0 end) over(order by d.attendance_date)::int cumulative_female,
      sum(case when d.register_exists then d.unknown_gender_attendance else 0 end) over(order by d.attendance_date)::int cumulative_unknown_gender,
      sum(case when d.register_exists then d.total_attendance else 0 end) over(order by d.attendance_date)::int cumulative_total
    from daily d
  ),
  overall as (
    select count(*)::int scheduled_school_days,
      count(*) filter(where register_exists)::int school_days,
      coalesce(sum(eligible_students) filter(where register_exists),0)::int possible_attendance,
      coalesce(sum(total_attendance) filter(where register_exists),0)::int cumulative_total,
      coalesce(sum(male_attendance) filter(where register_exists),0)::int cumulative_male,
      coalesce(sum(female_attendance) filter(where register_exists),0)::int cumulative_female,
      coalesce(sum(unknown_gender_attendance) filter(where register_exists),0)::int cumulative_unknown_gender,
      count(*) filter(where register_exists)::int registers_completed,
      count(*) filter(where not register_exists)::int registers_missing,
      coalesce(sum(unmarked_students),0)::int unmarked_students
    from daily
  ),
  monthly as (
    select date_trunc('month',attendance_date)::date month_start,
      count(*)::int scheduled_school_days,
      count(*) filter(where register_exists)::int school_days,
      coalesce(sum(eligible_students) filter(where register_exists),0)::int possible_attendance,
      coalesce(sum(total_attendance) filter(where register_exists),0)::int cumulative_total,
      coalesce(sum(male_attendance) filter(where register_exists),0)::int cumulative_male,
      coalesce(sum(female_attendance) filter(where register_exists),0)::int cumulative_female,
      count(*) filter(where register_exists)::int registers_completed,
      count(*) filter(where not register_exists)::int registers_missing
    from daily
    group by date_trunc('month',attendance_date)::date
  ),
  roster as (
    select count(distinct e.student_id)::int pupils_seen,
      count(distinct e.student_id) filter(where s.gender='Male')::int male_pupils,
      count(distinct e.student_id) filter(where s.gender='Female')::int female_pupils,
      count(distinct e.student_id) filter(where s.gender is null or s.gender not in('Male','Female'))::int gender_unknown_pupils
    from attendance.enrolments e
    join attendance.students s on s.id=e.student_id and s.active
    where e.class_id=p_class_id and e.active
      and e.start_date<=v_effective_end
      and (e.end_date is null or e.end_date>=v_start)
  )
  select jsonb_build_object(
    'class',jsonb_build_object('id',v_class.id,'class_code',v_class.class_code,'class_name',v_class.class_name,'year_level',v_class.year_level,'year_no',v_year.year_no),
    'period',jsonb_build_object('type',v_type,'label',v_label,'start_date',v_start,'end_date',v_end,'as_of_date',v_effective_end,'term_id',case when v_type='term' then v_term.id else null end),
    'summary',jsonb_build_object(
      'school_days',o.school_days,'scheduled_school_days',o.scheduled_school_days,'possible_attendance',o.possible_attendance,
      'cumulative_male',o.cumulative_male,'cumulative_female',o.cumulative_female,'cumulative_unknown_gender',o.cumulative_unknown_gender,'cumulative_total',o.cumulative_total,
      'average_attendance',case when o.possible_attendance>0 then round(o.cumulative_total::numeric/o.possible_attendance,4) else null end,
      'attendance_percentage',case when o.possible_attendance>0 then round((o.cumulative_total::numeric/o.possible_attendance)*100,2) else null end,
      'registers_completed',o.registers_completed,'registers_missing',o.registers_missing,'unmarked_students',o.unmarked_students,
      'provisional',(o.registers_missing>0 or v_effective_end<v_end)
    ),
    'roster',jsonb_build_object('pupils_seen',r.pupils_seen,'male_pupils',r.male_pupils,'female_pupils',r.female_pupils,'gender_unknown_pupils',r.gender_unknown_pupils,'gender_complete',(r.gender_unknown_pupils=0)),
    'months',coalesce((select jsonb_agg(jsonb_build_object(
      'month',to_char(m.month_start,'YYYY-MM'),'school_days',m.school_days,'scheduled_school_days',m.scheduled_school_days,
      'possible_attendance',m.possible_attendance,'cumulative_male',m.cumulative_male,'cumulative_female',m.cumulative_female,'cumulative_total',m.cumulative_total,
      'average_attendance',case when m.possible_attendance>0 then round(m.cumulative_total::numeric/m.possible_attendance,4) else null end,
      'attendance_percentage',case when m.possible_attendance>0 then round((m.cumulative_total::numeric/m.possible_attendance)*100,2) else null end,
      'registers_completed',m.registers_completed,'registers_missing',m.registers_missing
    ) order by m.month_start) from monthly m),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(jsonb_build_object(
      'date',rr.attendance_date,'eligible_students',rr.eligible_students,'register_exists',rr.register_exists,
      'male_attendance',rr.male_attendance,'female_attendance',rr.female_attendance,'unknown_gender_attendance',rr.unknown_gender_attendance,'total_attendance',rr.total_attendance,
      'cumulative_male',rr.cumulative_male,'cumulative_female',rr.cumulative_female,'cumulative_unknown_gender',rr.cumulative_unknown_gender,'cumulative_total',rr.cumulative_total,
      'unmarked_students',rr.unmarked_students
    ) order by rr.attendance_date) from running rr),'[]'::jsonb)
  ) into v_result
  from overall o cross join roster r;

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_class_report_options(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not attendance.can_access_class(p_class_id) then raise exception 'You do not have access to this class'; end if;
  select * into v_class from attendance.classes where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;
  select * into v_year from attendance.academic_years where id=v_class.academic_year_id;
  return jsonb_build_object(
    'class',jsonb_build_object('id',v_class.id,'class_code',v_class.class_code,'class_name',v_class.class_name,'year_level',v_class.year_level),
    'academic_year',jsonb_build_object('id',v_year.id,'year_no',v_year.year_no,'start_date',v_year.start_date,'end_date',v_year.end_date),
    'terms',coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'term_no',t.term_no,'term_name',t.term_name,'start_date',t.start_date,'end_date',t.end_date) order by t.term_no)
      from attendance.terms t where t.academic_year_id=v_year.id
    ),'[]'::jsonb)
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_load_register(p_class_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_calendar attendance.calendar_dates%rowtype;
  v_register attendance.daily_registers%rowtype;
  v_students jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not attendance.can_access_class(p_class_id) then
    raise exception 'You do not have access to this class';
  end if;

  select * into v_class
  from attendance.classes
  where id = p_class_id and active;
  if not found then
    raise exception 'Class not found';
  end if;

  select * into v_year
  from attendance.academic_years
  where id = v_class.academic_year_id;

  select * into v_calendar
  from attendance.calendar_dates
  where academic_year_id = v_year.id
    and calendar_date = p_date;

  select * into v_register
  from attendance.daily_registers
  where class_id = p_class_id
    and attendance_date = p_date;

  select coalesce(jsonb_agg(jsonb_build_object(
      'enrolment_id', e.id,
      'student_id', s.id,
      'student_ref', s.student_ref,
      'full_name', s.full_name,
      'gender', s.gender,
      'reporting_group', e.reporting_group,
      'include_in_class_stats', e.include_in_class_stats,
      'enrolment_status', e.enrolment_status,
      'remarks', e.remarks,
      'status_code', ar.status_code,
      'reason_code', ar.reason_code,
      'note', ar.note
    ) order by e.roster_order nulls last, s.full_name), '[]'::jsonb)
  into v_students
  from attendance.enrolments e
  join attendance.students s on s.id = e.student_id
  left join attendance.attendance_records ar
    on ar.enrolment_id = e.id
   and ar.daily_register_id = v_register.id
  where e.class_id = p_class_id
    and e.active
    and s.active
    and e.start_date <= p_date
    and (e.end_date is null or e.end_date >= p_date);

  return jsonb_build_object(
    'class', jsonb_build_object(
      'id', v_class.id,
      'class_code', v_class.class_code,
      'class_name', v_class.class_name,
      'year_level', v_class.year_level,
      'year_no', v_year.year_no
    ),
    'date', p_date,
    'is_school_day', coalesce(v_calendar.is_school_day, false),
    'calendar_label', v_calendar.label,
    'term_name', (
      select t.term_name
      from attendance.terms t
      where t.id = v_calendar.term_id
    ),
    'register', case when v_register.id is null then null else jsonb_build_object(
      'id', v_register.id,
      'status', v_register.status,
      'submitted_at', v_register.submitted_at,
      'submitted_by', v_register.submitted_by,
      'updated_at', v_register.updated_at,
      'updated_by', v_register.updated_by,
      'correction_count', v_register.correction_count,
      'last_corrected_at', v_register.last_corrected_at,
      'last_corrected_by', v_register.last_corrected_by,
      'last_correction_reason', v_register.last_correction_reason
    ) end,
    'students', v_students
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_monthly_class_stats(p_class_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_month_start date;
  v_month_end date;
  v_effective_end date;
  v_today date := (now() at time zone 'Asia/Brunei')::date;
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_class_id is null or p_month is null then raise exception 'Class and month are required'; end if;
  if not attendance.can_access_class(p_class_id) then raise exception 'You do not have access to this class'; end if;

  select * into v_class from attendance.classes where id=p_class_id and active;
  if not found then raise exception 'Class not found'; end if;
  select * into v_year from attendance.academic_years where id=v_class.academic_year_id;

  v_month_start := date_trunc('month',p_month)::date;
  v_month_end := (date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  if v_month_end < v_year.start_date or v_month_start > v_year.end_date then
    raise exception 'Month is outside the class academic year';
  end if;
  v_effective_end := least(v_month_end,v_year.end_date,v_today);

  with school_days as (
    select cd.calendar_date as attendance_date
    from attendance.calendar_dates cd
    where cd.academic_year_id=v_class.academic_year_id
      and cd.calendar_date between greatest(v_month_start,v_year.start_date) and v_effective_end
      and cd.is_school_day
  ),
  eligible as (
    select sd.attendance_date,e.id enrolment_id,e.student_id,coalesce(s.gender,'') gender
    from school_days sd
    join attendance.enrolments e on e.class_id=p_class_id and e.active
      and e.start_date<=sd.attendance_date and (e.end_date is null or e.end_date>=sd.attendance_date)
    join attendance.students s on s.id=e.student_id and s.active
  ),
  marked as (
    select el.attendance_date,el.enrolment_id,el.student_id,el.gender,ar.status_code,
           coalesce(ac.counts_as_present,false) counts_as_attendance,
           (dr.id is not null) register_exists
    from eligible el
    left join attendance.daily_registers dr on dr.class_id=p_class_id and dr.attendance_date=el.attendance_date
    left join attendance.attendance_records ar on ar.daily_register_id=dr.id and ar.enrolment_id=el.enrolment_id
    left join attendance.attendance_codes ac on ac.code=ar.status_code
  ),
  daily as (
    select sd.attendance_date,
      count(el.enrolment_id)::int eligible_students,
      count(*) filter(where m.counts_as_attendance)::int total_attendance,
      count(*) filter(where m.gender='Male' and m.counts_as_attendance)::int male_attendance,
      count(*) filter(where m.gender='Female' and m.counts_as_attendance)::int female_attendance,
      count(*) filter(where m.gender not in('Male','Female') and m.counts_as_attendance)::int unknown_gender_attendance,
      count(*) filter(where m.status_code is null and m.register_exists)::int unmarked_students,
      exists(select 1 from attendance.daily_registers dr2 where dr2.class_id=p_class_id and dr2.attendance_date=sd.attendance_date) register_exists
    from school_days sd
    left join eligible el on el.attendance_date=sd.attendance_date
    left join marked m on m.attendance_date=sd.attendance_date and m.enrolment_id=el.enrolment_id
    group by sd.attendance_date
  ),
  daily_running as (
    select d.*,
      sum(case when d.register_exists then d.male_attendance else 0 end) over(order by d.attendance_date)::int cumulative_male,
      sum(case when d.register_exists then d.female_attendance else 0 end) over(order by d.attendance_date)::int cumulative_female,
      sum(case when d.register_exists then d.unknown_gender_attendance else 0 end) over(order by d.attendance_date)::int cumulative_unknown_gender,
      sum(case when d.register_exists then d.total_attendance else 0 end) over(order by d.attendance_date)::int cumulative_total
    from daily d
  ),
  monthly as (
    select
      count(*)::int scheduled_school_days,
      count(*) filter(where register_exists)::int school_days,
      coalesce(sum(eligible_students) filter(where register_exists),0)::int possible_attendance,
      coalesce(sum(total_attendance) filter(where register_exists),0)::int cumulative_total,
      coalesce(sum(male_attendance) filter(where register_exists),0)::int cumulative_male,
      coalesce(sum(female_attendance) filter(where register_exists),0)::int cumulative_female,
      coalesce(sum(unknown_gender_attendance) filter(where register_exists),0)::int cumulative_unknown_gender,
      count(*) filter(where register_exists)::int registers_completed,
      count(*) filter(where not register_exists)::int registers_missing,
      coalesce(sum(unmarked_students),0)::int unmarked_students
    from daily
  ),
  roster_snapshot as (
    select
      count(distinct e.student_id)::int pupils_seen_in_month,
      count(distinct e.student_id) filter(where s.gender='Male')::int male_pupils,
      count(distinct e.student_id) filter(where s.gender='Female')::int female_pupils,
      count(distinct e.student_id) filter(where s.gender is null or s.gender not in('Male','Female'))::int gender_unknown_pupils
    from attendance.enrolments e
    join attendance.students s on s.id=e.student_id and s.active
    where e.class_id=p_class_id and e.active
      and e.start_date<=v_effective_end
      and (e.end_date is null or e.end_date>=greatest(v_month_start,v_year.start_date))
  )
  select jsonb_build_object(
    'class',jsonb_build_object('id',v_class.id,'class_code',v_class.class_code,'class_name',v_class.class_name,'year_level',v_class.year_level,'year_no',v_year.year_no),
    'month',to_char(v_month_start,'YYYY-MM'),
    'as_of_date',v_effective_end,
    'summary',jsonb_build_object(
      'school_days',mo.school_days,
      'scheduled_school_days',mo.scheduled_school_days,
      'possible_attendance',mo.possible_attendance,
      'cumulative_male',mo.cumulative_male,
      'cumulative_female',mo.cumulative_female,
      'cumulative_unknown_gender',mo.cumulative_unknown_gender,
      'cumulative_total',mo.cumulative_total,
      'average_attendance',case when mo.possible_attendance>0 then round(mo.cumulative_total::numeric/mo.possible_attendance,4) else null end,
      'attendance_percentage',case when mo.possible_attendance>0 then round((mo.cumulative_total::numeric/mo.possible_attendance)*100,2) else null end,
      'registers_completed',mo.registers_completed,
      'registers_missing',mo.registers_missing,
      'unmarked_students',mo.unmarked_students,
      'provisional',(mo.registers_missing>0 or v_effective_end<v_month_end)
    ),
    'roster',jsonb_build_object(
      'pupils_seen_in_month',rs.pupils_seen_in_month,
      'male_pupils',rs.male_pupils,
      'female_pupils',rs.female_pupils,
      'gender_unknown_pupils',rs.gender_unknown_pupils,
      'gender_complete',(rs.gender_unknown_pupils=0)
    ),
    'daily',coalesce((select jsonb_agg(jsonb_build_object(
      'date',dr.attendance_date,'eligible_students',dr.eligible_students,
      'male_attendance',dr.male_attendance,'female_attendance',dr.female_attendance,'unknown_gender_attendance',dr.unknown_gender_attendance,
      'total_attendance',dr.total_attendance,'cumulative_male',dr.cumulative_male,'cumulative_female',dr.cumulative_female,
      'cumulative_unknown_gender',dr.cumulative_unknown_gender,'cumulative_total',dr.cumulative_total,
      'register_exists',dr.register_exists,'unmarked_students',dr.unmarked_students
    ) order by dr.attendance_date) from daily_running dr),'[]'::jsonb)
  ) into v_result
  from monthly mo cross join roster_snapshot rs;

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_save_register(p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_class attendance.classes%rowtype;
  v_year attendance.academic_years%rowtype;
  v_calendar attendance.calendar_dates%rowtype;
  v_register attendance.daily_registers%rowtype;
  v_register_id uuid;
  v_expected integer;
  v_received integer;
  v_bad integer;
  v_present integer;
  v_absent integer;
  v_late integer;
  v_main integer;
  v_changed integer := 0;
  v_existing boolean := false;
  v_reason text := nullif(btrim(p_correction_reason), '');
  v_batch uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not attendance.can_access_class(p_class_id) then
    raise exception 'You do not have access to this class';
  end if;

  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'Records must be a JSON array';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Correction reason must be 500 characters or fewer';
  end if;

  select * into v_class
  from attendance.classes
  where id = p_class_id and active;
  if not found then raise exception 'Class not found'; end if;

  select * into v_year
  from attendance.academic_years
  where id = v_class.academic_year_id;

  select * into v_calendar
  from attendance.calendar_dates
  where academic_year_id = v_year.id and calendar_date = p_date;

  if v_calendar.id is null or not v_calendar.is_school_day then
    raise exception 'Attendance cannot be saved for a non-school day';
  end if;

  select count(*) into v_expected
  from attendance.enrolments e
  join attendance.students s on s.id = e.student_id
  where e.class_id = p_class_id
    and e.active and s.active
    and e.start_date <= p_date
    and (e.end_date is null or e.end_date >= p_date);

  v_received := jsonb_array_length(p_records);
  if v_received <> v_expected then
    raise exception 'Expected % attendance records but received %', v_expected, v_received;
  end if;

  select count(*) into v_bad
  from (
    select x.enrolment_id, count(*)
    from jsonb_to_recordset(p_records)
      as x(enrolment_id uuid, status_code text, reason_code text, note text)
    group by x.enrolment_id
    having count(*) <> 1
  ) q;
  if v_bad > 0 then
    raise exception 'Duplicate enrolment records are not allowed';
  end if;

  select count(*) into v_bad
  from jsonb_to_recordset(p_records)
    as x(enrolment_id uuid, status_code text, reason_code text, note text)
  left join attendance.enrolments e on e.id = x.enrolment_id
  left join attendance.students s on s.id = e.student_id
  left join attendance.attendance_codes ac on ac.code = x.status_code and ac.active
  left join attendance.absence_reasons rr on rr.code = x.reason_code and rr.active
  where e.id is null
     or e.class_id <> p_class_id
     or not e.active
     or not s.active
     or e.start_date > p_date
     or (e.end_date is not null and e.end_date < p_date)
     or ac.code is null
     or (x.reason_code is not null and rr.code is null)
     or (x.reason_code = 'OTHER' and coalesce(btrim(x.note), '') = '');
  if v_bad > 0 then
    raise exception 'One or more attendance records are invalid';
  end if;

  select * into v_register
  from attendance.daily_registers
  where class_id = p_class_id
    and attendance_date = p_date
  for update;
  v_existing := found;

  if v_existing then
    select count(*) into v_changed
    from jsonb_to_recordset(p_records)
      as x(enrolment_id uuid, status_code text, reason_code text, note text)
    left join attendance.attendance_records ar
      on ar.daily_register_id = v_register.id
     and ar.enrolment_id = x.enrolment_id
    where ar.id is null
       or ar.status_code is distinct from x.status_code
       or ar.reason_code is distinct from nullif(x.reason_code, '')
       or ar.note is distinct from nullif(btrim(x.note), '');

    if v_changed = 0 then
      select
        count(*) filter (where ac.counts_as_present),
        count(*) filter (where ac.counts_as_absent),
        count(*) filter (where ac.is_late),
        count(*) filter (where e.include_in_class_stats)
      into v_present, v_absent, v_late, v_main
      from attendance.attendance_records ar
      join attendance.attendance_codes ac on ac.code = ar.status_code
      join attendance.enrolments e on e.id = ar.enrolment_id
      where ar.daily_register_id = v_register.id;

      return jsonb_build_object(
        'ok', true,
        'no_changes', true,
        'register_id', v_register.id,
        'date', p_date,
        'recorded', v_expected,
        'changed_records', 0,
        'present_like', v_present,
        'absent_like', v_absent,
        'late', v_late,
        'main_class_records', v_main,
        'correction_count', v_register.correction_count,
        'saved_at', v_register.updated_at
      );
    end if;

    if v_reason is null then
      raise exception 'Correction reason is required when changing a saved attendance register';
    end if;

    perform set_config('attendance.correction_reason', v_reason, true);
    perform set_config('attendance.change_batch_id', v_batch::text, true);

    update attendance.daily_registers
    set status = 'submitted',
        updated_by = (select auth.uid()),
        updated_at = v_now,
        correction_count = correction_count + 1,
        last_corrected_at = v_now,
        last_corrected_by = (select auth.uid()),
        last_correction_reason = v_reason
    where id = v_register.id
    returning id into v_register_id;
  else
    perform set_config('attendance.correction_reason', '', true);
    perform set_config('attendance.change_batch_id', v_batch::text, true);

    insert into attendance.daily_registers(
      class_id, attendance_date, status, started_by,
      submitted_by, submitted_at, updated_by
    ) values (
      p_class_id, p_date, 'submitted', (select auth.uid()),
      (select auth.uid()), v_now, (select auth.uid())
    )
    returning id into v_register_id;
  end if;

  insert into attendance.attendance_records(
    daily_register_id, enrolment_id, status_code, reason_code, note,
    source, created_by, updated_by
  )
  select
    v_register_id,
    x.enrolment_id,
    x.status_code,
    nullif(x.reason_code, ''),
    nullif(btrim(x.note), ''),
    'web',
    (select auth.uid()),
    (select auth.uid())
  from jsonb_to_recordset(p_records)
    as x(enrolment_id uuid, status_code text, reason_code text, note text)
  on conflict (daily_register_id, enrolment_id)
  do update set
    status_code = excluded.status_code,
    reason_code = excluded.reason_code,
    note = excluded.note,
    source = 'web',
    updated_by = (select auth.uid()),
    updated_at = v_now
  where attendance.attendance_records.status_code is distinct from excluded.status_code
     or attendance.attendance_records.reason_code is distinct from excluded.reason_code
     or attendance.attendance_records.note is distinct from excluded.note;

  select
    count(*) filter (where ac.counts_as_present),
    count(*) filter (where ac.counts_as_absent),
    count(*) filter (where ac.is_late),
    count(*) filter (where e.include_in_class_stats)
  into v_present, v_absent, v_late, v_main
  from attendance.attendance_records ar
  join attendance.attendance_codes ac on ac.code = ar.status_code
  join attendance.enrolments e on e.id = ar.enrolment_id
  where ar.daily_register_id = v_register_id;

  return jsonb_build_object(
    'ok', true,
    'no_changes', false,
    'register_id', v_register_id,
    'date', p_date,
    'recorded', v_expected,
    'changed_records', case when v_existing then v_changed else v_expected end,
    'present_like', v_present,
    'absent_like', v_absent,
    'late', v_late,
    'main_class_records', v_main,
    'correction', v_existing,
    'correction_count', case
      when v_existing then v_register.correction_count + 1
      else 0
    end,
    'change_batch_id', v_batch,
    'saved_at', v_now
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_signup_options()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'schools', coalesce(jsonb_agg(school_obj order by school_name), '[]'::jsonb)
  )
  from (
    select
      s.school_name,
      jsonb_build_object(
        'school_id', s.id,
        'school_code', s.school_code,
        'school_name', s.school_name,
        'classes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id,
            'class_code', c.class_code,
            'class_name', c.class_name,
            'year_level', c.year_level,
            'year_no', ay.year_no
          ) order by c.year_level, c.class_code)
          from attendance.academic_years ay
          join attendance.classes c on c.academic_year_id = ay.id
          where ay.school_id = s.id
            and ay.active
            and c.active
        ), '[]'::jsonb)
      ) as school_obj
    from attendance.schools s
    where s.active
      and exists (
        select 1
        from attendance.academic_years ay
        where ay.school_id = s.id and ay.active
      )
  ) q;
$function$

CREATE OR REPLACE FUNCTION public.attendance_submit_teacher_request(p_full_name text, p_requested_class_id uuid, p_requested_role text DEFAULT 'class_teacher'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_school_id uuid;
  v_class_code text;
  v_role text := lower(btrim(coalesce(p_requested_role, 'class_teacher')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;
  if v_role not in ('class_teacher','assistant_teacher') then
    raise exception 'Invalid requested teacher role';
  end if;

  select coalesce(nullif((select auth.jwt()->>'email'), ''), u.email)
    into v_email
  from auth.users u
  where u.id = v_user_id;
  if coalesce(v_email, '') = '' then
    raise exception 'A verified email account is required';
  end if;

  select ay.school_id, c.class_code
    into v_school_id, v_class_code
  from attendance.classes c
  join attendance.academic_years ay on ay.id = c.academic_year_id
  where c.id = p_requested_class_id
    and c.active
    and ay.active;
  if v_school_id is null then
    raise exception 'Requested class is not available';
  end if;

  if exists (
    select 1 from attendance.teacher_school_memberships m
    where m.user_id = v_user_id and m.school_id = v_school_id and m.active and m.role = 'admin'
  ) or exists (
    select 1
    from attendance.teacher_class_assignments a
    join attendance.classes c on c.id = a.class_id
    join attendance.academic_years ay on ay.id = c.academic_year_id
    where a.user_id = v_user_id and a.active and ay.school_id = v_school_id
  ) then
    return jsonb_build_object('ok', true, 'already_authorized', true, 'status', 'approved');
  end if;

  select id into v_request_id
  from attendance.teacher_signup_requests
  where user_id = v_user_id and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if v_request_id is null then
    insert into attendance.teacher_signup_requests(
      user_id, school_id, requested_class_id, full_name, email, requested_role
    ) values (
      v_user_id, v_school_id, p_requested_class_id, v_name, v_email, v_role
    ) returning id into v_request_id;
  else
    update attendance.teacher_signup_requests
    set school_id = v_school_id,
        requested_class_id = p_requested_class_id,
        full_name = v_name,
        email = v_email,
        requested_role = v_role,
        updated_at = now()
    where id = v_request_id;
  end if;

  insert into attendance_private.teacher_access_audit(
    request_id, subject_user_id, school_id, class_id, action, actor_user_id, details
  ) values (
    v_request_id, v_user_id, v_school_id, p_requested_class_id,
    'request_submitted', v_user_id,
    jsonb_build_object('class_code', v_class_code, 'requested_role', v_role)
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'status', 'pending',
    'class_code', v_class_code,
    'requested_role', v_role
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.attendance_teacher_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_request jsonb;
  v_assignments jsonb;
  v_membership_role text;
  v_authorized boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(nullif((select auth.jwt()->>'email'), ''), u.email)
    into v_email
  from auth.users u where u.id = v_user_id;

  select max(case when m.role='admin' then 'admin' else m.role end)
    into v_membership_role
  from attendance.teacher_school_memberships m
  where m.user_id = v_user_id and m.active;

  select (
    exists(select 1 from attendance.teacher_school_memberships m where m.user_id=v_user_id and m.active and m.role='admin')
    or exists(select 1 from attendance.teacher_class_assignments a where a.user_id=v_user_id and a.active)
  ) into v_authorized;

  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id,
    'class_code', c.class_code,
    'class_name', c.class_name,
    'year_level', c.year_level,
    'assignment_role', a.role,
    'school_id', ay.school_id
  ) order by c.year_level, c.class_code), '[]'::jsonb)
  into v_assignments
  from attendance.teacher_class_assignments a
  join attendance.classes c on c.id=a.class_id
  join attendance.academic_years ay on ay.id=c.academic_year_id
  where a.user_id=v_user_id and a.active and c.active and ay.active;

  select jsonb_build_object(
    'request_id', r.id,
    'status', r.status,
    'full_name', r.full_name,
    'requested_class_id', r.requested_class_id,
    'requested_class_code', rc.class_code,
    'requested_role', r.requested_role,
    'admin_note', r.admin_note,
    'reviewed_at', r.reviewed_at
  )
  into v_request
  from attendance.teacher_signup_requests r
  join attendance.classes rc on rc.id=r.requested_class_id
  where r.user_id=v_user_id
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'user_id', v_user_id,
    'email', coalesce(v_email,''),
    'authorized', coalesce(v_authorized,false),
    'school_role', v_membership_role,
    'assignments', coalesce(v_assignments,'[]'::jsonb),
    'signup_request', v_request
  );
end;
$function$


-- Triggers

CREATE TRIGGER attendance_years_touch BEFORE UPDATE ON attendance.academic_years FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_record_audit AFTER INSERT OR DELETE OR UPDATE ON attendance.attendance_records FOR EACH ROW EXECUTE FUNCTION attendance_private.audit_attendance_record();
CREATE TRIGGER attendance_record_stamp BEFORE INSERT OR UPDATE ON attendance.attendance_records FOR EACH ROW EXECUTE FUNCTION attendance_private.stamp_record_actor();
CREATE TRIGGER attendance_calendar_touch BEFORE UPDATE ON attendance.calendar_dates FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_classes_touch BEFORE UPDATE ON attendance.classes FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_register_stamp BEFORE INSERT OR UPDATE ON attendance.daily_registers FOR EACH ROW EXECUTE FUNCTION attendance_private.stamp_register_actor();
CREATE TRIGGER attendance_enrolments_touch BEFORE UPDATE ON attendance.enrolments FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_schools_touch BEFORE UPDATE ON attendance.schools FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_settings_touch BEFORE UPDATE ON attendance.settings FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_students_touch BEFORE UPDATE ON attendance.students FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_class_assignments_touch BEFORE UPDATE ON attendance.teacher_class_assignments FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_school_memberships_touch BEFORE UPDATE ON attendance.teacher_school_memberships FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();
CREATE TRIGGER attendance_terms_touch BEFORE UPDATE ON attendance.terms FOR EACH ROW EXECUTE FUNCTION attendance_private.touch_updated_at();

-- Row level security

alter table attendance.absence_reasons enable row level security;
alter table attendance.academic_years enable row level security;
alter table attendance.attendance_codes enable row level security;
alter table attendance.attendance_records enable row level security;
alter table attendance.calendar_dates enable row level security;
alter table attendance.classes enable row level security;
alter table attendance.daily_registers enable row level security;
alter table attendance.enrolments enable row level security;
alter table attendance.schools enable row level security;
alter table attendance.settings enable row level security;
alter table attendance.student_movements enable row level security;
alter table attendance.students enable row level security;
alter table attendance.teacher_class_assignments enable row level security;
alter table attendance.teacher_school_memberships enable row level security;
alter table attendance.teacher_signup_requests enable row level security;
alter table attendance.terms enable row level security;
alter table attendance_private.teacher_access_audit enable row level security;

-- RLS policies

create policy absence_reasons_read on attendance.absence_reasons as permissive for select to authenticated
  using (true);
create policy years_admin_delete on attendance.academic_years as permissive for delete to authenticated
  using (attendance.is_school_admin(school_id));
create policy years_admin_insert on attendance.academic_years as permissive for insert to authenticated
  with check (attendance.is_school_admin(school_id));
create policy years_admin_update on attendance.academic_years as permissive for update to authenticated
  using (attendance.is_school_admin(school_id))
  with check (attendance.is_school_admin(school_id));
create policy years_read on attendance.academic_years as permissive for select to authenticated
  using (attendance.is_school_member(school_id));
create policy attendance_codes_read on attendance.attendance_codes as permissive for select to authenticated
  using (true);
create policy records_delete on attendance.attendance_records as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.daily_registers r
  WHERE ((r.id = attendance_records.daily_register_id) AND attendance.can_access_class(r.class_id)))));
create policy records_insert on attendance.attendance_records as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM attendance.daily_registers r
  WHERE ((r.id = attendance_records.daily_register_id) AND attendance.can_access_class(r.class_id)))));
create policy records_read on attendance.attendance_records as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.daily_registers r
  WHERE ((r.id = attendance_records.daily_register_id) AND attendance.can_access_class(r.class_id)))));
create policy records_update on attendance.attendance_records as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.daily_registers r
  WHERE ((r.id = attendance_records.daily_register_id) AND attendance.can_access_class(r.class_id)))))
  with check ((EXISTS ( SELECT 1
   FROM attendance.daily_registers r
  WHERE ((r.id = attendance_records.daily_register_id) AND attendance.can_access_class(r.class_id)))));
create policy calendar_admin_delete on attendance.calendar_dates as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = calendar_dates.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy calendar_admin_insert on attendance.calendar_dates as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = calendar_dates.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy calendar_admin_update on attendance.calendar_dates as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = calendar_dates.academic_year_id) AND attendance.is_school_admin(ay.school_id)))))
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = calendar_dates.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy calendar_read on attendance.calendar_dates as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = calendar_dates.academic_year_id) AND attendance.is_school_member(ay.school_id)))));
create policy classes_admin_delete on attendance.classes as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = classes.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy classes_admin_insert on attendance.classes as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = classes.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy classes_admin_update on attendance.classes as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = classes.academic_year_id) AND attendance.is_school_admin(ay.school_id)))))
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = classes.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy classes_read on attendance.classes as permissive for select to authenticated
  using (attendance.can_access_class(id));
create policy registers_delete on attendance.daily_registers as permissive for delete to authenticated
  using (attendance.can_access_class(class_id));
create policy registers_insert on attendance.daily_registers as permissive for insert to authenticated
  with check (attendance.can_access_class(class_id));
create policy registers_read on attendance.daily_registers as permissive for select to authenticated
  using (attendance.can_access_class(class_id));
create policy registers_update on attendance.daily_registers as permissive for update to authenticated
  using (attendance.can_access_class(class_id))
  with check (attendance.can_access_class(class_id));
create policy enrolments_admin_delete on attendance.enrolments as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = enrolments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy enrolments_admin_insert on attendance.enrolments as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = enrolments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy enrolments_admin_update on attendance.enrolments as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = enrolments.class_id) AND attendance.is_school_admin(ay.school_id)))))
  with check ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = enrolments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy enrolments_read on attendance.enrolments as permissive for select to authenticated
  using (attendance.can_access_class(class_id));
create policy schools_admin_update on attendance.schools as permissive for update to authenticated
  using (attendance.is_school_admin(id))
  with check (attendance.is_school_admin(id));
create policy schools_read on attendance.schools as permissive for select to authenticated
  using (attendance.is_school_member(id));
create policy settings_admin_delete on attendance.settings as permissive for delete to authenticated
  using (attendance.is_school_admin(school_id));
create policy settings_admin_insert on attendance.settings as permissive for insert to authenticated
  with check (attendance.is_school_admin(school_id));
create policy settings_admin_update on attendance.settings as permissive for update to authenticated
  using (attendance.is_school_admin(school_id))
  with check (attendance.is_school_admin(school_id));
create policy settings_read on attendance.settings as permissive for select to authenticated
  using (attendance.is_school_member(school_id));
create policy student_movements_admin_insert on attendance.student_movements as permissive for insert to authenticated
  with check ((attendance.is_school_admin(school_id) AND (created_by = ( SELECT auth.uid() AS uid))));
create policy student_movements_admin_read on attendance.student_movements as permissive for select to authenticated
  using (attendance.is_school_admin(school_id));
create policy students_admin_delete on attendance.students as permissive for delete to authenticated
  using (attendance.is_school_admin(school_id));
create policy students_admin_insert on attendance.students as permissive for insert to authenticated
  with check (attendance.is_school_admin(school_id));
create policy students_admin_update on attendance.students as permissive for update to authenticated
  using (attendance.is_school_admin(school_id))
  with check (attendance.is_school_admin(school_id));
create policy students_read on attendance.students as permissive for select to authenticated
  using ((attendance.is_school_admin(school_id) OR (EXISTS ( SELECT 1
   FROM attendance.enrolments e
  WHERE ((e.student_id = students.id) AND attendance.can_access_class(e.class_id))))));
create policy class_assignments_admin_delete on attendance.teacher_class_assignments as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = teacher_class_assignments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy class_assignments_admin_insert on attendance.teacher_class_assignments as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = teacher_class_assignments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy class_assignments_admin_update on attendance.teacher_class_assignments as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = teacher_class_assignments.class_id) AND attendance.is_school_admin(ay.school_id)))))
  with check ((EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = teacher_class_assignments.class_id) AND attendance.is_school_admin(ay.school_id)))));
create policy class_assignments_read on attendance.teacher_class_assignments as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (attendance.classes c
     JOIN attendance.academic_years ay ON ((ay.id = c.academic_year_id)))
  WHERE ((c.id = teacher_class_assignments.class_id) AND attendance.is_school_admin(ay.school_id))))));
create policy school_memberships_admin_delete on attendance.teacher_school_memberships as permissive for delete to authenticated
  using (attendance.is_school_admin(school_id));
create policy school_memberships_admin_insert on attendance.teacher_school_memberships as permissive for insert to authenticated
  with check (attendance.is_school_admin(school_id));
create policy school_memberships_admin_update on attendance.teacher_school_memberships as permissive for update to authenticated
  using (attendance.is_school_admin(school_id))
  with check (attendance.is_school_admin(school_id));
create policy school_memberships_read on attendance.teacher_school_memberships as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR attendance.is_school_admin(school_id)));
create policy terms_admin_delete on attendance.terms as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = terms.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy terms_admin_insert on attendance.terms as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = terms.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy terms_admin_update on attendance.terms as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = terms.academic_year_id) AND attendance.is_school_admin(ay.school_id)))))
  with check ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = terms.academic_year_id) AND attendance.is_school_admin(ay.school_id)))));
create policy terms_read on attendance.terms as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM attendance.academic_years ay
  WHERE ((ay.id = terms.academic_year_id) AND attendance.is_school_member(ay.school_id)))));

-- Effective client table grants captured from production

revoke all privileges on table attendance.absence_reasons from public, anon, authenticated, service_role;
grant select on table attendance.absence_reasons to authenticated;
grant all privileges on table attendance.absence_reasons to service_role;
revoke all privileges on table attendance.academic_years from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.academic_years to authenticated;
grant all privileges on table attendance.academic_years to service_role;
revoke all privileges on table attendance.attendance_codes from public, anon, authenticated, service_role;
grant select on table attendance.attendance_codes to authenticated;
grant all privileges on table attendance.attendance_codes to service_role;
revoke all privileges on table attendance.attendance_records from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.attendance_records to authenticated;
grant all privileges on table attendance.attendance_records to service_role;
revoke all privileges on table attendance.calendar_dates from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.calendar_dates to authenticated;
grant all privileges on table attendance.calendar_dates to service_role;
revoke all privileges on table attendance.classes from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.classes to authenticated;
grant all privileges on table attendance.classes to service_role;
revoke all privileges on table attendance.daily_registers from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.daily_registers to authenticated;
grant all privileges on table attendance.daily_registers to service_role;
revoke all privileges on table attendance.enrolments from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.enrolments to authenticated;
grant all privileges on table attendance.enrolments to service_role;
revoke all privileges on table attendance.schools from public, anon, authenticated, service_role;
grant select, update on table attendance.schools to authenticated;
grant all privileges on table attendance.schools to service_role;
revoke all privileges on table attendance.settings from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.settings to authenticated;
grant all privileges on table attendance.settings to service_role;
revoke all privileges on table attendance.student_movements from public, anon, authenticated, service_role;
grant select, insert on table attendance.student_movements to authenticated;
grant all privileges on table attendance.student_movements to service_role;
revoke all privileges on table attendance.students from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.students to authenticated;
grant all privileges on table attendance.students to service_role;
revoke all privileges on table attendance.teacher_class_assignments from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.teacher_class_assignments to authenticated;
grant all privileges on table attendance.teacher_class_assignments to service_role;
revoke all privileges on table attendance.teacher_school_memberships from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.teacher_school_memberships to authenticated;
grant all privileges on table attendance.teacher_school_memberships to service_role;
revoke all privileges on table attendance.teacher_signup_requests from public, anon, authenticated, service_role;
revoke all privileges on table attendance.terms from public, anon, authenticated, service_role;
grant select, insert, update, delete on table attendance.terms to authenticated;
grant all privileges on table attendance.terms to service_role;
revoke all privileges on table attendance_private.attendance_record_audit from public, anon, authenticated, service_role;
revoke all privileges on table attendance_private.teacher_access_audit from public, anon, authenticated, service_role;

-- The private identity sequence is owner-only in the captured baseline

revoke all privileges on sequence attendance_private.attendance_record_audit_audit_id_seq from public, anon, authenticated, service_role;

-- Function EXECUTE grants captured from production

revoke all privileges on function attendance.can_access_class(target_class_id uuid) from public, anon, authenticated, service_role;
grant execute on function attendance.can_access_class(target_class_id uuid) to authenticated;
grant execute on function attendance.can_access_class(target_class_id uuid) to service_role;
revoke all privileges on function attendance.is_school_admin(target_school_id uuid) from public, anon, authenticated, service_role;
grant execute on function attendance.is_school_admin(target_school_id uuid) to authenticated;
grant execute on function attendance.is_school_admin(target_school_id uuid) to service_role;
revoke all privileges on function attendance.is_school_member(target_school_id uuid) from public, anon, authenticated, service_role;
grant execute on function attendance.is_school_member(target_school_id uuid) to authenticated;
grant execute on function attendance.is_school_member(target_school_id uuid) to service_role;
revoke all privileges on function attendance_private.audit_attendance_record() from public, anon, authenticated, service_role;
revoke all privileges on function public.attendance_admin_move_class(p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_move_class(p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text) to authenticated;
grant execute on function public.attendance_admin_move_class(p_enrolment_id uuid, p_to_class_id uuid, p_move_date date, p_remarks text) to service_role;
revoke all privileges on function public.attendance_admin_review_teacher_request(p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_review_teacher_request(p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text) to authenticated;
grant execute on function public.attendance_admin_review_teacher_request(p_request_id uuid, p_action text, p_class_id uuid, p_assignment_type text, p_admin_note text) to service_role;
revoke all privileges on function public.attendance_admin_school_dashboard(p_school_id uuid, p_month date) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_school_dashboard(p_school_id uuid, p_month date) to authenticated;
grant execute on function public.attendance_admin_school_dashboard(p_school_id uuid, p_month date) to service_role;
revoke all privileges on function public.attendance_admin_set_teacher_active(p_user_id uuid, p_school_id uuid, p_active boolean) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_set_teacher_active(p_user_id uuid, p_school_id uuid, p_active boolean) to authenticated;
grant execute on function public.attendance_admin_set_teacher_active(p_user_id uuid, p_school_id uuid, p_active boolean) to service_role;
revoke all privileges on function public.attendance_admin_student_roster(p_school_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_student_roster(p_school_id uuid) to authenticated;
grant execute on function public.attendance_admin_student_roster(p_school_id uuid) to service_role;
revoke all privileges on function public.attendance_admin_teacher_requests(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_teacher_requests(p_status text) to authenticated;
grant execute on function public.attendance_admin_teacher_requests(p_status text) to service_role;
revoke all privileges on function public.attendance_admin_teachers() from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_teachers() to authenticated;
grant execute on function public.attendance_admin_teachers() to service_role;
revoke all privileges on function public.attendance_admin_transfer_in(p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text, p_include_in_class_stats boolean, p_remarks text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_transfer_in(p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text, p_include_in_class_stats boolean, p_remarks text) to authenticated;
grant execute on function public.attendance_admin_transfer_in(p_school_id uuid, p_class_id uuid, p_student_ref text, p_full_name text, p_gender text, p_start_date date, p_reporting_group text, p_include_in_class_stats boolean, p_remarks text) to service_role;
revoke all privileges on function public.attendance_admin_transfer_out(p_enrolment_id uuid, p_last_date date, p_remarks text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_admin_transfer_out(p_enrolment_id uuid, p_last_date date, p_remarks text) to authenticated;
grant execute on function public.attendance_admin_transfer_out(p_enrolment_id uuid, p_last_date date, p_remarks text) to service_role;
revoke all privileges on function public.attendance_bootstrap() from public, anon, authenticated, service_role;
grant execute on function public.attendance_bootstrap() to authenticated;
grant execute on function public.attendance_bootstrap() to service_role;
revoke all privileges on function public.attendance_class_period_report(p_class_id uuid, p_period_type text, p_term_id uuid, p_as_of_date date) from public, anon, authenticated, service_role;
grant execute on function public.attendance_class_period_report(p_class_id uuid, p_period_type text, p_term_id uuid, p_as_of_date date) to authenticated;
grant execute on function public.attendance_class_period_report(p_class_id uuid, p_period_type text, p_term_id uuid, p_as_of_date date) to service_role;
revoke all privileges on function public.attendance_class_report_options(p_class_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.attendance_class_report_options(p_class_id uuid) to authenticated;
grant execute on function public.attendance_class_report_options(p_class_id uuid) to service_role;
revoke all privileges on function public.attendance_load_register(p_class_id uuid, p_date date) from public, anon, authenticated, service_role;
grant execute on function public.attendance_load_register(p_class_id uuid, p_date date) to authenticated;
grant execute on function public.attendance_load_register(p_class_id uuid, p_date date) to service_role;
revoke all privileges on function public.attendance_monthly_class_stats(p_class_id uuid, p_month date) from public, anon, authenticated, service_role;
grant execute on function public.attendance_monthly_class_stats(p_class_id uuid, p_month date) to authenticated;
grant execute on function public.attendance_monthly_class_stats(p_class_id uuid, p_month date) to service_role;
revoke all privileges on function public.attendance_save_register(p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_save_register(p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text) to authenticated;
grant execute on function public.attendance_save_register(p_class_id uuid, p_date date, p_records jsonb, p_correction_reason text) to service_role;
revoke all privileges on function public.attendance_signup_options() from public, anon, authenticated, service_role;
grant execute on function public.attendance_signup_options() to anon;
grant execute on function public.attendance_signup_options() to authenticated;
grant execute on function public.attendance_signup_options() to service_role;
revoke all privileges on function public.attendance_submit_teacher_request(p_full_name text, p_requested_class_id uuid, p_requested_role text) from public, anon, authenticated, service_role;
grant execute on function public.attendance_submit_teacher_request(p_full_name text, p_requested_class_id uuid, p_requested_role text) to authenticated;
grant execute on function public.attendance_submit_teacher_request(p_full_name text, p_requested_class_id uuid, p_requested_role text) to service_role;
revoke all privileges on function public.attendance_teacher_status() from public, anon, authenticated, service_role;
grant execute on function public.attendance_teacher_status() to authenticated;
grant execute on function public.attendance_teacher_status() to service_role;

commit;
