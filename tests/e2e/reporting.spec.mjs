import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { openAuthorized, syntheticClass } from './harness.mjs';

const classes = [
  syntheticClass(),
  syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
];

const febRatio = 398 / 425;
const termRatio = 1051 / 1125;

function februaryStatsFixture() {
  return {
    month: '2026-02',
    as_of_date: '2026-02-28',
    summary: {
      cumulative_total: 398,
      average_attendance: febRatio,
      attendance_percentage: febRatio * 100,
      school_days: 17,
      scheduled_school_days: 18,
      cumulative_male: 201,
      cumulative_female: 197,
      possible_attendance: 425,
      registers_missing: 1,
      registers_completed: 17,
      provisional: true
    },
    roster: {
      pupils_seen_in_month: 25,
      male_pupils: 13,
      female_pupils: 12,
      gender_complete: true,
      gender_unknown_pupils: 0
    },
    daily: [
      {
        date: '2026-02-02',
        register_exists: true,
        male_attendance: 12,
        female_attendance: 11,
        total_attendance: 23,
        cumulative_male: 12,
        cumulative_female: 11,
        cumulative_total: 23
      },
      {
        date: '2026-02-03',
        register_exists: false,
        male_attendance: null,
        female_attendance: null,
        total_attendance: null,
        cumulative_male: 12,
        cumulative_female: 11,
        cumulative_total: 23
      }
    ]
  };
}

function dashboardFixture() {
  return {
    month: '2026-02',
    as_of_date: '2026-02-28',
    summary: {
      cumulative_total: 760,
      average_attendance: 0.93,
      attendance_percentage: 93,
      registers_completed: 33,
      registers_missing: 1,
      class_count: 2,
      gender_incomplete_classes: 0,
      provisional: true
    },
    latest_school_day: {
      date: '2026-02-03',
      classes_completed: 1,
      classes_missing: 1,
      classes: [
        { class_id: 'class-3a', class_code: '3A', register_exists: true, attendance: 24, eligible_students: 25 },
        { class_id: 'class-3b', class_code: '3B', register_exists: false, attendance: null, eligible_students: 23 }
      ]
    },
    classes: [
      {
        class_id: 'class-3a', class_code: '3A', pupils: 25,
        registers_completed: 17, registers_missing: 0,
        cumulative_total: 398, average_attendance: febRatio,
        attendance_percentage: febRatio * 100
      },
      {
        class_id: 'class-3b', class_code: '3B', pupils: 23,
        registers_completed: 16, registers_missing: 1,
        cumulative_total: 362, average_attendance: 0.9235,
        attendance_percentage: 92.35
      }
    ]
  };
}

function reportOptionsFixture() {
  return {
    class: { id: 'class-3a', class_code: '3A', class_name: 'Year 3A', year_no: 2026 },
    terms: [
      { id: 'term-1', term_name: 'Term 1', start_date: '2026-01-02', end_date: '2026-04-30' },
      { id: 'term-2', term_name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-31' }
    ]
  };
}

function termReportFixture() {
  return {
    class: { id: 'class-3a', class_code: '3A', class_name: 'Year 3A', year_no: 2026 },
    period: {
      type: 'term',
      label: 'Term 1',
      start_date: '2026-01-02',
      end_date: '2026-04-30',
      as_of_date: '2026-04-30'
    },
    summary: {
      cumulative_total: 1051,
      possible_attendance: 1125,
      average_attendance: termRatio,
      attendance_percentage: termRatio * 100,
      cumulative_male: 530,
      cumulative_female: 521,
      registers_completed: 45,
      registers_missing: 1,
      school_days: 45,
      scheduled_school_days: 46,
      provisional: true
    },
    roster: {
      pupils_seen: 25,
      male_pupils: 13,
      female_pupils: 12,
      gender_complete: true,
      gender_unknown_pupils: 0
    },
    months: [
      {
        month: '2026-02',
        registers_completed: 17,
        registers_missing: 1,
        scheduled_school_days: 18,
        cumulative_total: 398,
        possible_attendance: 425,
        average_attendance: febRatio,
        attendance_percentage: febRatio * 100
      }
    ],
    daily: [
      {
        date: '2026-02-02', register_exists: true, eligible_students: 25,
        male_attendance: 12, female_attendance: 11, unknown_gender_attendance: 0,
        total_attendance: 23, cumulative_male: 12, cumulative_female: 11, cumulative_total: 23
      },
      {
        date: '2026-02-03', register_exists: false, eligible_students: 25,
        male_attendance: null, female_attendance: null, unknown_gender_attendance: null,
        total_attendance: null, cumulative_male: 12, cumulative_female: 11, cumulative_total: 23
      }
    ]
  };
}

function ytdReportFixture() {
  return {
    class: { id: 'class-3a', class_code: '3A', class_name: 'Year 3A', year_no: 2026 },
    period: {
      type: 'ytd',
      label: 'Year to Date through 15 March 2026',
      start_date: '2026-01-02',
      end_date: '2026-03-15',
      as_of_date: '2026-03-15'
    },
    summary: {
      cumulative_total: 650,
      possible_attendance: 700,
      average_attendance: 650 / 700,
      attendance_percentage: (650 / 700) * 100,
      cumulative_male: 330,
      cumulative_female: 320,
      registers_completed: 28,
      registers_missing: 0,
      school_days: 28,
      scheduled_school_days: 28,
      provisional: true
    },
    roster: {
      pupils_seen: 25,
      male_pupils: 13,
      female_pupils: 12,
      gender_complete: true,
      gender_unknown_pupils: 0
    },
    months: [],
    daily: []
  };
}

test('3A February statistics preserve denominator and missing-register semantics', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: { attendance_monthly_class_stats: februaryStatsFixture() }
  });

  await page.locator('#statisticsTabBtn').click();
  await expect(page.locator('#statisticsPanel')).toBeVisible();
  await expect(page.locator('#statsCumulative')).toHaveText('398');
  await expect(page.locator('#statsPossible')).toHaveText('425');
  await expect(page.locator('#statsAverage')).toHaveText('0.9365');
  await expect(page.locator('#statsPercent')).toHaveText('93.65%');
  await expect(page.locator('#statsBanner')).toContainText('1 register is missing');
  await expect(page.locator('#statsBanner')).toContainText('completed registers only');

  const missing = page.locator('#statsDailyBody tr.missing-row');
  await expect(missing).toContainText('Missing');
  await expect(missing.locator('td').nth(3)).toHaveText('—');
  await expect(missing.locator('td').nth(6)).toHaveText('23');

  const calls = await harness.calls();
  const stats = calls.rpc.find(call => call.name === 'attendance_monthly_class_stats');
  expect(stats.args).toEqual({ p_class_id: 'class-3a', p_month: '2026-02-01' });
  await harness.expectNoProductionRequests();
});

test('admin dashboard distinguishes a missing register from zero attendance', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: { attendance_admin_school_dashboard: dashboardFixture() }
  });

  await page.locator('#dashboardTabBtn').click();
  await expect(page.locator('#dashboardPanel')).toBeVisible();
  await expect(page.locator('#dashboardRegisters')).toHaveText('33/34');
  await expect(page.locator('#dashboardBanner')).toContainText('not zero attendance');
  await expect(page.locator('#dashboardLatestMissing')).toHaveText('1');

  const missing = page.locator('#dashboardLatestBody tr.missing-row');
  await expect(missing).toContainText('3B');
  await expect(missing).toContainText('Missing');
  await expect(missing.locator('td').nth(2)).toHaveText('—');
  await expect(missing.locator('td').nth(3)).toHaveText('23');

  const calls = await harness.calls();
  const dashboard = calls.rpc.find(call => call.name === 'attendance_admin_school_dashboard');
  expect(dashboard.args).toEqual({ p_school_id: 'school-test', p_month: '2026-02-01' });
  await harness.expectNoProductionRequests();
});

test('3A Term 1 report preserves invariant values and exports missing registers explicitly', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_class_report_options: reportOptionsFixture(),
      attendance_class_period_report: termReportFixture()
    }
  });

  await page.locator('#reportsTabBtn').click();
  await expect(page.locator('#reportTermSelect')).toHaveValue('term-1');
  await page.locator('#loadReportBtn').click();

  await expect(page.locator('#reportCumulative')).toHaveText('1051');
  await expect(page.locator('#reportPossible')).toHaveText('1125');
  await expect(page.locator('#reportAverage')).toHaveText('0.9342');
  await expect(page.locator('#reportPercent')).toHaveText('93.42%');
  await expect(page.locator('#reportBanner')).toContainText('completed registers only');

  const missing = page.locator('#reportDailyBody tr.missing-row');
  await expect(missing).toContainText('Missing');
  await expect(missing.locator('td').nth(4)).toHaveText('—');
  await expect(missing.locator('td').nth(5)).toHaveText('23');

  const callsBeforeExport = await harness.calls();
  const report = callsBeforeExport.rpc.find(call => call.name === 'attendance_class_period_report');
  expect(report.args).toEqual({
    p_class_id: 'class-3a',
    p_period_type: 'term',
    p_term_id: 'term-1',
    p_as_of_date: null
  });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportReportBtn').click()
  ]);
  expect(download.suggestedFilename()).toBe('SRL_Attendance_3A_Term_1.csv');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const csv = await readFile(downloadPath, 'utf8');
  expect(csv).toContain('Cumulative Attendance,1051');
  expect(csv).toContain('Possible Attendance,1125');
  expect(csv).toContain('Average Attendance Ratio,' + termRatio);
  expect(csv).toContain('2026-02-03,Missing,25');
  expect(csv).not.toContain('2026-02-03,Missing,25,0,0,0,0');
  await harness.expectNoProductionRequests();
});

test('YTD report sends the selected as-of date instead of a term id', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_class_report_options: reportOptionsFixture(),
      attendance_class_period_report: ytdReportFixture()
    }
  });

  await page.locator('#reportsTabBtn').click();
  await page.locator('#reportType').selectOption('ytd');
  await expect(page.locator('#reportTermField')).toHaveClass(/hidden/);
  await expect(page.locator('#reportAsOfField')).not.toHaveClass(/hidden/);
  await page.locator('#reportAsOf').fill('2026-03-15');
  await page.locator('#loadReportBtn').click();

  await expect(page.locator('#reportPeriodLabel')).toHaveText('Year to Date through 15 March 2026');
  await expect(page.locator('#reportCumulative')).toHaveText('650');

  const calls = await harness.calls();
  const report = calls.rpc.find(call => call.name === 'attendance_class_period_report');
  expect(report.args).toEqual({
    p_class_id: 'class-3a',
    p_period_type: 'ytd',
    p_term_id: null,
    p_as_of_date: '2026-03-15'
  });
  await harness.expectNoProductionRequests();
});
