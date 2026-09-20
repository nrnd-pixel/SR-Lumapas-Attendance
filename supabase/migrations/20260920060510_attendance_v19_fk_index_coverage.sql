-- Phase 6A: cover the six remaining Attendance foreign keys reported by
-- Supabase Performance Advisor. Additive indexes only; no data, function,
-- privilege, RLS, policy, constraint, Science, Auth, or frontend changes.

create index teacher_signup_requests_approved_class_idx
  on attendance.teacher_signup_requests using btree (approved_class_id);

create index teacher_signup_requests_requested_class_idx
  on attendance.teacher_signup_requests using btree (requested_class_id);

create index teacher_signup_requests_reviewed_by_idx
  on attendance.teacher_signup_requests using btree (reviewed_by);

create index teacher_access_audit_actor_idx
  on attendance_private.teacher_access_audit using btree (actor_user_id);

create index teacher_access_audit_class_idx
  on attendance_private.teacher_access_audit using btree (class_id);

create index teacher_access_audit_request_idx
  on attendance_private.teacher_access_audit using btree (request_id);
