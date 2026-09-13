import { test, expect } from '@playwright/test';
import { openAuthorized, syntheticClass } from './harness.mjs';

const classes = [
  syntheticClass(),
  syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
];

const pupilA = {
  enrolment_id: 'enrol-admin-1',
  full_name: 'Synthetic Pupil Alpha',
  class_id: 'class-3a',
  class_code: '3A',
  student_ref: 'TEST-001',
  reporting_group: 'Mainstream',
  start_date: '2026-01-05',
  last_attendance_date: '2026-02-01'
};

const pupilB = {
  enrolment_id: 'enrol-admin-2',
  full_name: 'Synthetic Pupil Beta',
  class_id: 'class-3b',
  class_code: '3B',
  student_ref: 'TEST-002',
  reporting_group: 'Mainstream',
  start_date: '2026-01-05',
  last_attendance_date: null
};

function roster(students, recentMovements = []) {
  return {
    total_current: students.length,
    classes,
    students,
    recent_movements: recentMovements
  };
}

function teacherRequest(overrides = {}) {
  return {
    request_id: 'request-1',
    full_name: 'Synthetic Teacher Request',
    email: 'request.teacher@example.test',
    requested_class_id: 'class-3a',
    requested_class_code: '3A',
    requested_role: 'class_teacher',
    ...overrides
  };
}

function teacher({ userId, email, active, classCode = '3A' }) {
  return {
    user_id: userId,
    school_id: 'school-test',
    email,
    active,
    classes: [{ class_code: classCode }]
  };
}

test('admin Transfer In sends exact eligibility payload and refreshes current roster', async ({ page }) => {
  const transferred = {
    enrolment_id: 'enrol-admin-3',
    full_name: 'Synthetic Transfer In',
    class_id: 'class-3b',
    class_code: '3B',
    student_ref: 'TEST-003',
    reporting_group: 'Mainstream',
    start_date: '2026-02-03',
    last_attendance_date: null
  };
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_student_roster: [roster([pupilA, pupilB]), roster([pupilA, pupilB, transferred])],
      attendance_admin_transfer_in: { backfill_registers: 2 }
    }
  });

  await page.locator('#studentsTabBtn').click();
  await expect(page.locator('#studentAdminCount')).toHaveText('2 current pupils');
  await page.locator('#transferInBtn').click();
  await expect(page.locator('#transferInDialog')).toBeVisible();

  await page.locator('#tiRef').fill('TEST-003');
  await page.locator('#tiName').fill('Synthetic Transfer In');
  await page.locator('#tiGender').selectOption({ label: 'Female' });
  await page.locator('#tiClass').selectOption('class-3b');
  await page.locator('#tiDate').fill('2026-02-03');
  await page.locator('#tiRemarks').fill('Synthetic transfer fixture');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#tiSaveBtn').click();

  await expect(page.locator('#transferInDialog')).toBeHidden();
  await expect(page.locator('#studentAdminCount')).toHaveText('3 current pupils');
  await expect(page.locator('#adminStudentList')).toContainText('Synthetic Transfer In');

  const calls = await harness.calls();
  const transfer = calls.rpc.find(call => call.name === 'attendance_admin_transfer_in');
  expect(transfer.args).toEqual({
    p_school_id: 'school-test',
    p_class_id: 'class-3b',
    p_student_ref: 'TEST-003',
    p_full_name: 'Synthetic Transfer In',
    p_gender: 'Female',
    p_start_date: '2026-02-03',
    p_reporting_group: 'Mainstream',
    p_include_in_class_stats: true,
    p_remarks: 'Synthetic transfer fixture'
  });
  expect(calls.rpc.filter(call => call.name === 'attendance_admin_student_roster')).toHaveLength(2);
  await harness.expectNoProductionRequests();
});

test('admin Transfer Out preserves history contract and removes pupil from current roster', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_student_roster: [roster([pupilA, pupilB]), roster([pupilB], [{
        full_name: pupilA.full_name,
        movement_type: 'transfer_out',
        effective_date: '2026-02-10',
        from_class_code: '3A',
        to_class_code: null,
        note: 'Synthetic transfer out'
      }])],
      attendance_admin_transfer_out: { preserved_attendance_records: 5 }
    }
  });

  await page.locator('#studentsTabBtn').click();
  const card = page.locator('#adminStudentList .list-card').filter({ hasText: pupilA.full_name });
  await card.locator('.transfer-out').click();
  await expect(page.locator('#transferOutDialog')).toBeVisible();
  await page.locator('#toDate').fill('2026-02-10');
  await page.locator('#toRemarks').fill('Synthetic transfer out');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#toSaveBtn').click();

  await expect(page.locator('#studentManageMsg')).toContainText('5 attendance record(s) preserved');
  await expect(page.locator('#studentAdminCount')).toHaveText('1 current pupils');
  await expect(page.locator('#adminStudentList')).not.toContainText(pupilA.full_name);
  await expect(page.locator('#movementList')).toContainText('transfer out');

  const calls = await harness.calls();
  const transfer = calls.rpc.find(call => call.name === 'attendance_admin_transfer_out');
  expect(transfer.args).toEqual({
    p_enrolment_id: 'enrol-admin-1',
    p_last_date: '2026-02-10',
    p_remarks: 'Synthetic transfer out'
  });
  await harness.expectNoProductionRequests();
});

test('admin Move Class sends effective-date payload and refreshes pupil into destination class', async ({ page }) => {
  const moved = { ...pupilA, class_id: 'class-3b', class_code: '3B' };
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_student_roster: [roster([pupilA, pupilB]), roster([moved, pupilB], [{
        full_name: pupilA.full_name,
        movement_type: 'class_move',
        effective_date: '2026-02-09',
        from_class_code: '3A',
        to_class_code: '3B',
        note: 'Synthetic class move'
      }])],
      attendance_admin_move_class: { preserved_attendance_records: 4, backfill_registers: 1 }
    }
  });

  await page.locator('#studentsTabBtn').click();
  const card = page.locator('#adminStudentList .list-card').filter({ hasText: pupilA.full_name });
  await card.locator('.move-class').click();
  await expect(page.locator('#moveClassDialog')).toBeVisible();
  await page.locator('#mcClass').selectOption('class-3b');
  await page.locator('#mcDate').fill('2026-02-09');
  await page.locator('#mcRemarks').fill('Synthetic class move');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#mcSaveBtn').click();

  await expect(page.locator('#studentManageMsg')).toContainText('4 old-class attendance record(s) preserved');
  await expect(page.locator('#studentManageMsg')).toContainText('1 saved destination register(s) exist from the move date');
  const movedCard = page.locator('#adminStudentList .list-card').filter({ hasText: pupilA.full_name });
  await expect(movedCard).toContainText('3B');
  await expect(page.locator('#movementList')).toContainText('3A → 3B');

  const calls = await harness.calls();
  const move = calls.rpc.find(call => call.name === 'attendance_admin_move_class');
  expect(move.args).toEqual({
    p_enrolment_id: 'enrol-admin-1',
    p_to_class_id: 'class-3b',
    p_move_date: '2026-02-09',
    p_remarks: 'Synthetic class move'
  });
  await harness.expectNoProductionRequests();
});

test('admin approves a teacher with the selected class and assignment type', async ({ page }) => {
  const request = teacherRequest();
  const approved = teacher({ userId: 'teacher-approved', email: request.email, active: true, classCode: '3B' });
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_teacher_requests: [
        { data: [request], error: null },
        { data: [], error: null }
      ],
      attendance_admin_teachers: [
        { data: [], error: null },
        { data: [approved], error: null }
      ],
      attendance_admin_review_teacher_request: { status: 'approved' }
    }
  });

  await page.locator('#teachersTabBtn').click();
  await expect(page.locator('#pendingTeacherCount')).toHaveText('1');
  const card = page.locator('#teacherRequestList .list-card').filter({ hasText: request.email });
  await card.locator('.approve-class').selectOption('class-3b');
  await card.locator('.approve-role').selectOption('assistant_teacher');
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.approve-teacher').click();

  await expect(page.locator('#pendingTeacherCount')).toHaveText('0');
  await expect(page.locator('#activeTeacherCount')).toHaveText('1');
  await expect(page.locator('#teacherList')).toContainText(request.email);

  const calls = await harness.calls();
  const review = calls.rpc.find(call => call.name === 'attendance_admin_review_teacher_request');
  expect(review.args).toEqual({
    p_request_id: 'request-1',
    p_action: 'approve',
    p_class_id: 'class-3b',
    p_assignment_type: 'assistant_teacher',
    p_admin_note: null
  });
  await harness.expectNoProductionRequests();
});

test('admin rejection keeps class assignment null and records the optional admin note', async ({ page }) => {
  const request = teacherRequest({ request_id: 'request-reject' });
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_teacher_requests: [
        { data: [request], error: null },
        { data: [], error: null }
      ],
      attendance_admin_teachers: [
        { data: [], error: null },
        { data: [], error: null }
      ],
      attendance_admin_review_teacher_request: { status: 'rejected' }
    }
  });

  await page.locator('#teachersTabBtn').click();
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('Duplicate synthetic request');
    else await dialog.accept();
  });
  await page.locator('#teacherRequestList .reject-teacher').click();
  await expect(page.locator('#pendingTeacherCount')).toHaveText('0');

  const calls = await harness.calls();
  const review = calls.rpc.find(call => call.name === 'attendance_admin_review_teacher_request');
  expect(review.args).toEqual({
    p_request_id: 'request-reject',
    p_action: 'reject',
    p_class_id: null,
    p_assignment_type: null,
    p_admin_note: 'Duplicate synthetic request'
  });
  await harness.expectNoProductionRequests();
});

test('admin can disable and enable Attendance access without touching other account scope', async ({ page }) => {
  const activeTeacher = teacher({ userId: 'teacher-active', email: 'active.teacher@example.test', active: true });
  const disabledTeacher = teacher({ userId: 'teacher-disabled', email: 'disabled.teacher@example.test', active: false, classCode: '3B' });
  const afterDisable = [
    { ...activeTeacher, active: false },
    disabledTeacher
  ];
  const afterEnable = [
    { ...activeTeacher, active: false },
    { ...disabledTeacher, active: true }
  ];
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_teacher_requests: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ],
      attendance_admin_teachers: [
        { data: [activeTeacher, disabledTeacher], error: null },
        { data: afterDisable, error: null },
        { data: afterEnable, error: null }
      ],
      attendance_admin_set_teacher_active: [{ ok: true }, { ok: true }]
    }
  });

  await page.locator('#teachersTabBtn').click();
  await expect(page.locator('#activeTeacherCount')).toHaveText('1');
  await expect(page.locator('#inactiveTeacherCount')).toHaveText('1');

  let card = page.locator('#teacherList .list-card').filter({ hasText: activeTeacher.email });
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.toggle-teacher').click();
  await expect(page.locator('#activeTeacherCount')).toHaveText('0');
  await expect(page.locator('#inactiveTeacherCount')).toHaveText('2');

  card = page.locator('#teacherList .list-card').filter({ hasText: disabledTeacher.email });
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.toggle-teacher').click();
  await expect(page.locator('#activeTeacherCount')).toHaveText('1');
  await expect(page.locator('#inactiveTeacherCount')).toHaveText('1');

  const calls = await harness.calls();
  const toggles = calls.rpc.filter(call => call.name === 'attendance_admin_set_teacher_active');
  expect(toggles).toEqual([
    {
      name: 'attendance_admin_set_teacher_active',
      args: { p_user_id: 'teacher-active', p_school_id: 'school-test', p_active: false }
    },
    {
      name: 'attendance_admin_set_teacher_active',
      args: { p_user_id: 'teacher-disabled', p_school_id: 'school-test', p_active: true }
    }
  ]);
  await harness.expectNoProductionRequests();
});
