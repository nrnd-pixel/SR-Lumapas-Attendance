import { test, expect } from '@playwright/test';
import { openAuthorized, syntheticClass } from './harness.mjs';

const classes = [
  syntheticClass(),
  syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
];

const dashboardFixture = {
  month: '2026-02',
  as_of_date: '2026-02-28',
  summary: {
    cumulative_total: 0,
    average_attendance: null,
    attendance_percentage: null,
    registers_completed: 0,
    registers_missing: 0,
    class_count: 2,
    gender_incomplete_classes: 0,
    provisional: true
  },
  latest_school_day: {
    date: null,
    classes_completed: 0,
    classes_missing: 0,
    classes: []
  },
  classes: [
    {
      class_id: 'class-3a',
      class_code: '3A',
      pupils: 25,
      registers_completed: 0,
      registers_missing: 0,
      cumulative_total: 0,
      average_attendance: null,
      attendance_percentage: null
    }
  ]
};

const statsFixture = {
  month: '2026-02',
  as_of_date: '2026-02-28',
  summary: {
    cumulative_total: 0,
    average_attendance: null,
    attendance_percentage: null,
    school_days: 0,
    scheduled_school_days: 0,
    cumulative_male: 0,
    cumulative_female: 0,
    possible_attendance: 0,
    registers_missing: 0,
    registers_completed: 0,
    provisional: true
  },
  roster: {
    pupils_seen_in_month: 0,
    male_pupils: 0,
    female_pupils: 0,
    gender_complete: true,
    gender_unknown_pupils: 0
  },
  daily: []
};

const reportOptionsFixture = {
  class: { id: 'class-3a', class_code: '3A' },
  terms: [
    { id: 'term-1', term_name: 'Term 1', start_date: '2026-01-01', end_date: '2026-04-30' }
  ]
};

const rosterFixture = {
  total_current: 0,
  classes,
  students: [],
  recent_movements: []
};

const panelIds = {
  attendance: 'attendancePanel',
  dashboard: 'dashboardPanel',
  statistics: 'statisticsPanel',
  reports: 'reportsPanel',
  students: 'studentsPanel',
  teachers: 'teachersPanel'
};

async function expectOnlyPanel(page, name) {
  for (const [key, id] of Object.entries(panelIds)) {
    const panel = page.locator('#' + id);
    if (key === name) await expect(panel).toBeVisible();
    else await expect(panel).toBeHidden();
  }
  await expect(page.locator('#mainNav .nav-btn.active')).toHaveCount(1);
  await expect(page.locator('#' + name + 'TabBtn')).toHaveClass(/active/);
}

test('application navigation keeps one active panel, preserves class fallback, and invokes only the target lazy loader', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_school_dashboard: dashboardFixture,
      attendance_monthly_class_stats: statsFixture,
      attendance_class_report_options: reportOptionsFixture,
      attendance_admin_student_roster: rosterFixture,
      attendance_admin_teacher_requests: [],
      attendance_admin_teachers: []
    }
  });

  await expectOnlyPanel(page, 'attendance');
  await page.locator('#classSelect').selectOption('class-3b');
  await expect(page.locator('#classSelect')).toHaveValue('class-3b');

  await page.locator('#dashboardTabBtn').click();
  await expectOnlyPanel(page, 'dashboard');

  await page.locator('#dashboardClassBody .dashboard-view').click();
  await expectOnlyPanel(page, 'statistics');
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3a');
  await expect(page.locator('#statsMonth')).toHaveValue('2026-02');

  await page.locator('#attendanceTabBtn').click();
  await expectOnlyPanel(page, 'attendance');
  await page.locator('#statsClassSelect').evaluate(element => { element.value = ''; });
  await page.locator('#statisticsTabBtn').click();
  await expectOnlyPanel(page, 'statistics');
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3b');

  await page.locator('#reportClassSelect').evaluate(element => { element.value = ''; });
  await page.locator('#reportsTabBtn').click();
  await expectOnlyPanel(page, 'reports');
  await expect(page.locator('#reportClassSelect')).toHaveValue('class-3b');

  await page.locator('#studentsTabBtn').click();
  await expectOnlyPanel(page, 'students');

  await page.locator('#teachersTabBtn').click();
  await expectOnlyPanel(page, 'teachers');

  const callsBeforeAttendance = await harness.calls();
  const rpcCountBeforeAttendance = callsBeforeAttendance.rpc.length;

  await page.locator('#attendanceTabBtn').click();
  await expectOnlyPanel(page, 'attendance');

  const calls = await harness.calls();
  expect(calls.rpc).toHaveLength(rpcCountBeforeAttendance);
  expect(calls.rpc.filter(call => call.name === 'attendance_admin_school_dashboard')).toHaveLength(1);
  expect(calls.rpc.filter(call => call.name === 'attendance_monthly_class_stats')).toHaveLength(2);
  expect(calls.rpc.filter(call => call.name === 'attendance_class_report_options')).toHaveLength(1);
  expect(calls.rpc.filter(call => call.name === 'attendance_admin_student_roster')).toHaveLength(1);
  expect(calls.rpc.filter(call => call.name === 'attendance_admin_teacher_requests')).toHaveLength(1);
  expect(calls.rpc.filter(call => call.name === 'attendance_admin_teachers')).toHaveLength(1);

  const statsCalls = calls.rpc.filter(call => call.name === 'attendance_monthly_class_stats');
  expect(statsCalls[0].args).toEqual({
    p_class_id: 'class-3a',
    p_month: '2026-02-01'
  });
  expect(statsCalls[1].args).toEqual({
    p_class_id: 'class-3b',
    p_month: '2026-02-01'
  });
  expect(calls.rpc.find(call => call.name === 'attendance_class_report_options').args).toEqual({
    p_class_id: 'class-3b'
  });
  await harness.expectNoProductionRequests();
});
