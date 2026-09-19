-- SR Lumapas Attendance Phase 5F1 structural-admin write boundary.
-- Repository/local candidate only. Production application requires separate approval.
--
-- The cleanup frontend has no direct structural table writers. Keep authenticated
-- read access/RLS semantics intact, but require future structural administration
-- to use an explicitly designed controlled backend boundary rather than Data API DML.

begin;

revoke insert, update, delete on table
  attendance.academic_years,
  attendance.calendar_dates,
  attendance.classes,
  attendance.schools,
  attendance.settings,
  attendance.terms
from authenticated;

commit;
