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

async function captureStudentManageMessages(page) {
  await page.locator('#studentManageMsg').evaluate(el => {
    window.__attendanceStudentManageMessages = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const text = node.textContent;
          if (text) window.__attendanceStudentManageMessages.push(text);
        }
      }
    });
    observer.observe(el, { childList: true });
  });
}

async function studentManageMessages(page) {
  return page.evaluate(() => window.__attendanceStudentManageMessages || []);
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
  await captureStudentManageMessages(page);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#toSaveBtn').click();

  await expect(page.locator('#studentAdminCount')).toHaveText('1 current pupils');
  await expect(page.locator('#adminStudentList')).not.toContainText(pupilA.full_name);
  await expect(page.locator('#movementList')).toContainText('transfer out');
  expect(await studentManageMessages(page)).toContain('Transfer Out saved. 5 attendance record(s) preserved.');

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
  await captureStudentManageMessages(page);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#mcSaveBtn').click();

  const movedCard = page.locator('#adminStudentList .list-card').filter({ hasText: pupilA.full_name });
  await expect(movedCard).toContainText('3B');
  await expect(page.locator('#movementList')).toContainText('3A → 3B');
  expect(await studentManageMessages(page)).toContain('Class move saved. 4 old-class attendance record(s) preserved. 1 saved destination register(s) exist from the move date and should be reviewed.');

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

test('admin roster search and class filter escape hostile pupil text', async ({ page }) => {
  const hostile = {
    ...pupilA,
    enrolment_id: 'enrol-hostile',
    full_name: 'Synthetic <strong>Pupil</strong>',
    student_ref: '<img src=x onerror=alert(1)>'
  };
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_student_roster: roster([hostile, pupilB])
    }
  });

  await page.locator('#studentsTabBtn').click();
  const list = page.locator('#adminStudentList');
  await expect(list).toContainText('Synthetic <strong>Pupil</strong>');
  await expect(list).toContainText('<img src=x onerror=alert(1)>');
  await expect(list.locator('strong')).toHaveCount(0);
  await expect(list.locator('img')).toHaveCount(0);

  await page.locator('#studentClassFilter').selectOption('class-3b');
  await expect(list).toContainText(pupilB.full_name);
  await expect(list).not.toContainText(hostile.full_name);
  await expect(list.locator('.move-class')).toHaveCount(1);
  await expect(list.locator('.transfer-out')).toHaveCount(1);

  await page.locator('#studentSearch').fill('no such pupil');
  await expect(list).toContainText('No pupils match this filter.');
  await harness.expectNoProductionRequests();
});

test('Transfer In dialog preserves Brunei date and reporting-group statistics defaults', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_student_roster: roster([pupilA, pupilB])
    }
  });

  await page.locator('#studentsTabBtn').click();
  await page.locator('#transferInBtn').click();
  await expect(page.locator('#transferInDialog')).toBeVisible();
  const expectedDate = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Brunei', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const values = {};
    for (const part of parts) values[part.type] = part.value;
    return values.year + '-' + values.month + '-' + values.day;
  });
  await expect(page.locator('#tiDate')).toHaveValue(expectedDate);
  await expect(page.locator('#tiStats')).toBeChecked();
  await expect(page.locator('#tiClass option')).toHaveCount(2);

  await page.locator('#tiGroup').selectOption('SEN / UPK / PRAVOC');
  await expect(page.locator('#tiStats')).not.toBeChecked();
  await page.locator('#tiGroup').selectOption('Mainstream');
  await expect(page.locator('#tiStats')).toBeChecked();
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

test('teacher admin escapes hostile request and teacher text while approval controls remain functional', async ({ page }) => {
  const request = teacherRequest({
    request_id: 'request-hostile',
    full_name: 'Synthetic <strong>Teacher</strong>',
    email: 'request.<img src=x onerror=alert(1)>@example.test',
    requested_class_code: '<svg onload=alert(1)>'
  });
  const approved = teacher({
    userId: 'teacher-hostile',
    email: 'approved.<em>teacher</em>@example.test',
    active: true,
    classCode: '<b>3B</b>'
  });
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_teacher_requests: [
        { data: [request], error: null },
        { data: [], error: null }
      ],
      attendance_admin_teachers: [
        { data: [approved], error: null },
        { data: [approved], error: null }
      ],
      attendance_admin_review_teacher_request: { status: 'approved' }
    }
  });

  await page.locator('#teachersTabBtn').click();
  const requestList = page.locator('#teacherRequestList');
  const teacherList = page.locator('#teacherList');
  await expect(requestList).toContainText('Synthetic <strong>Teacher</strong>');
  await expect(requestList).toContainText('request.<img src=x onerror=alert(1)>@example.test');
  await expect(requestList).toContainText('<svg onload=alert(1)>');
  await expect(requestList.locator('strong')).toHaveCount(0);
  await expect(requestList.locator('img')).toHaveCount(0);
  await expect(requestList.locator('svg')).toHaveCount(0);
  await expect(teacherList).toContainText('approved.<em>teacher</em>@example.test');
  await expect(teacherList).toContainText('<b>3B</b>');
  await expect(teacherList.locator('em')).toHaveCount(0);
  await expect(teacherList.locator('b')).toHaveCount(0);

  const card = requestList.locator('.list-card').filter({ hasText: request.email });
  await expect(card.locator('.approve-teacher')).toHaveCount(1);
  await expect(card.locator('.reject-teacher')).toHaveCount(1);
  await card.locator('.approve-class').selectOption('class-3b');
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.approve-teacher').click();
  await expect(page.locator('#pendingTeacherCount')).toHaveText('0');

  const calls = await harness.calls();
  const review = calls.rpc.find(call => call.name === 'attendance_admin_review_teacher_request');
  expect(review.args).toEqual({
    p_request_id: 'request-hostile',
    p_action: 'approve',
    p_class_id: 'class-3b',
    p_assignment_type: 'class_teacher',
    p_admin_note: null
  });
  await harness.expectNoProductionRequests();
});