-- SR Lumapas Attendance v1.0 non-sensitive reference data
-- Fresh reconstruction target ONLY.
-- Contains no school, class, pupil, teacher, enrolment, register or attendance rows.

begin;

insert into attendance.attendance_codes
  (code, label, category, counts_as_present, counts_as_absent, is_late, sort_order, active)
values
  ('P', 'Present', 'present', true, false, false, 10, true),
  ('PP', 'Present (PP)', 'present', true, false, false, 20, true),
  ('A', 'Absent', 'absent', false, true, false, 30, true),
  ('L', 'Late', 'late', true, false, true, 40, true),
  ('PM', 'Permission', 'excused', true, false, false, 50, true),
  ('TM', 'Absent — no information', 'absent', false, true, false, 60, true),
  ('T', 'Transfer Out', 'other', false, false, false, 70, true),
  ('SS', 'SEN', 'other', false, false, false, 80, true),
  ('D', 'Deferred', 'other', false, false, false, 90, true),
  ('X', 'Deceased', 'other', false, false, false, 100, true),
  ('SP', 'Student Pass', 'other', false, false, false, 110, true),
  ('W', 'Withdrawn From Registration', 'other', false, false, false, 120, true),
  ('Q', 'Quit', 'other', false, false, false, 130, true);

insert into attendance.absence_reasons
  (code, label, requires_note, sort_order, active)
values
  ('NONE', 'No reason / Tiada makluman', false, 10, true),
  ('MEDICAL', 'Medical / Sakit', false, 20, true),
  ('FAMILY', 'Family matter / Urusan keluarga', false, 30, true),
  ('OFFICIAL', 'Official activity / Aktiviti rasmi', false, 40, true),
  ('PERMISSION', 'Permission / Kebenaran', false, 50, true),
  ('OTHER', 'Other / Lain-lain', true, 60, true);

commit;
