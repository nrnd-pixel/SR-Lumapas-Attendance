-- Attendance v16 — Phase 5D teacher-management write boundary
-- Repository/local candidate only. Do not apply to production without separate approval.
--
-- The Attendance frontend already uses the coordinated teacher-management RPCs:
--   public.attendance_admin_review_teacher_request(...)
--   public.attendance_admin_set_teacher_active(...)
--
-- Both RPCs are existing SECURITY DEFINER functions with internal school-admin
-- authorization and teacher-access audit writes. This migration changes only
-- direct authenticated table-write privileges so an authorized admin cannot
-- bypass those coordinated RPC/audit semantics through the Data API.
--
-- SELECT remains available for bootstrap/status/RLS-scoped reads.
-- Existing RLS policies and service_role privileges remain unchanged.

begin;

revoke insert, update, delete
on attendance.teacher_school_memberships,
   attendance.teacher_class_assignments
from authenticated;

commit;
