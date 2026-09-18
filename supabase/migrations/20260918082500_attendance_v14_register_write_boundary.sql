-- Phase 5B — Attendance register write boundary
-- Repository/local validation first. Do not apply to production without separate approval.
--
-- Preserve the existing public RPC signature/body/return shape and read/RLS policy
-- surface while making attendance_save_register the controlled write boundary.

begin;

alter function public.attendance_save_register(uuid,date,jsonb,text)
  security definer;

revoke insert, update, delete
  on attendance.daily_registers, attendance.attendance_records
  from authenticated;

commit;
