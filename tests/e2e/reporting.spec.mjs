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
      scheduled_school_days: 17,
      cumulative_male: 214,
      cumulative_female: 184,
      possible_attendance: 425,
      registers_missing: 0,
      registers_completed: 17,
      provisional: false
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
        register_exists: true,
        male_attendance: 11,
        female_attendance: 12,
        total_attendance: 23,
        cumulative_male: 23,
        cumulative_female: 23,
        cumulative_total: 46
      }
    ]
  };
}

function missingMonthlyStatsFixture() {
  return {
    month: '2026-02',
    as_of_date: '2026-02-05',
    summary: {
      cumulative_total: 90,
      average_attendance: 0.9,
      attendance_percentage: 90,
      school_days: 4,
      scheduled_school_days: 5,
      cumulative_male: 46,
      cumulative_female: 44,
      possible_attendance: 100,
      registers_missing: 1,
      registers_completed: 4,
      provisional: true
    },
    roster: {
      pupils_seen_in_month: 23,
      male_pupils: 12,
      female_pupils: 11,
      gender_complete: true,
      gender_unknown_pupils: 0
    },
    daily: [
      {
        date: '2026-02-04',
        register_exists: true,
        male_attendance: 11,
        female_attendance: 10,
        total_attendance: 21,
        cumulative_male: 46,
        cumulative_female: 44,
        cumulative_total: 90
      },
      {
        date: '2026-02-05',
        register_exists: false,
        male_attendance: null,
        female_attendance: null,
        total_attendance: null,
        cumulative_male: 46,
        cumulative_female: 44,
        cumulative_total: 90
      }
    ]
  };
}

function genderIncompleteStatsFixture() {
  const data = februaryStatsFixture();
  return {
    ...data,
    summary: {
      ...data.summary,
      cumulative_male: 210,
      cumulative_female: 180
    },
    roster: {
      ...data.roster,
      male_pupils: 12,
      female_pupils: 11,
      gender_complete: false,
      gender_unknown_pupils: 2
    }
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
      registers_missing: 0,
      school_days: 45,
      scheduled_school_days: 45,
      provisional: false
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
        registers_missing: 0,
        scheduled_school_days: 17,
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
        date: '2026-02-03', register_exists: true, eligible_students: 25,
        male_attendance: 11, female_attendance: 12, unknown_gender_attendance: 0,
        total_attendance: 23, cumulative_male: 23, cumulative_female: 23, cumulative_total: 46
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

function reportOptions3BFixture() {
  return {
    class: { id: 'class-3b', class_code: '3B', class_name: 'Year 3B', year_no: 2026 },
    terms: [
      { id: 'term-3b', term_name: '3B Term', start_date: '2026-01-02', end_date: '2026-04-30' }
    ]
  };
}

function marchDashboardFixture() {
  const data = dashboardFixture();
  return {
    ...data,
    month: '2026-03',
    as_of_date: '2026-03-31',
    summary: { ...data.summary, cumulative_total: 900 },
    latest_school_day: { ...data.latest_school_day, date: '2026-03-03' }
  };
}

test('3A February statistics preserve the official 17-day reporting invariant', async ({ page }) => {
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
  await expect(page.locator('#statsSchoolDays')).toHaveText('17/17');
  await expect(page.locator('#statsMale')).toHaveText('214');
  await expect(page.locator('#statsFemale')).toHaveText('184');
  await expect(page.locator('#statsBanner')).toContainText('Complete monthly statistics');

  const calls = await harness.calls();
  const stats = calls.rpc.find(call => call.name === 'attendance_monthly_class_stats');
  expect(stats.args).toEqual({ p_class_id: 'class-3a', p_month: '2026-02-01' });
  await harness.expectNoProductionRequests();
});

test('monthly statistics keep a missing register blank and out of the completed denominator', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_monthly_class_stats: [februaryStatsFixture(), missingMonthlyStatsFixture()]
    }
  });

  await page.locator('#statisticsTabBtn').click();
  await expect(page.locator('#statisticsPanel')).toBeVisible();
  await expect(page.locator('#statsCumulative')).toHaveText('398');
  await page.locator('#statsClassSelect').selectOption('class-3b');
  await expect(page.locator('#statsBanner')).toContainText('1 register is missing');
  await expect(page.locator('#statsBanner')).toContainText('completed registers only');
  await expect(page.locator('#statsCumulative')).toHaveText('90');
  await expect(page.locator('#statsPossible')).toHaveText('100');

  const missing = page.locator('#statsDailyBody tr.missing-row');
  await expect(missing).toContainText('Missing');
  await expect(missing.locator('td').nth(3)).toHaveText('—');
  await expect(missing.locator('td').nth(6)).toHaveText('90');

  const calls = await harness.calls();
  const statsCalls = calls.rpc.filter(call => call.name === 'attendance_monthly_class_stats');
  expect(statsCalls).toHaveLength(2);
  expect(statsCalls.at(-1).args).toEqual({ p_class_id: 'class-3b', p_month: '2026-02-01' });
  await harness.expectNoProductionRequests();
});

test('monthly statistics warn when gender is incomplete while preserving complete totals', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: { attendance_monthly_class_stats: genderIncompleteStatsFixture() }
  });

  await page.locator('#statisticsTabBtn').click();
  await expect(page.locator('#statisticsPanel')).toBeVisible();
  await expect(page.locator('#genderStatsBanner')).toBeVisible();
  await expect(page.locator('#genderStatsBanner')).toContainText('Gender is not recorded for 2 pupils');
  await expect(page.locator('#genderStatsBanner')).toContainText('Male/female figures include known genders only; Total remains complete.');
  await expect(page.locator('#statsMale')).toHaveText('210');
  await expect(page.locator('#statsFemale')).toHaveText('180');
  await expect(page.locator('#statsAll')).toHaveText('398');
  await expect(page.locator('#statsPossible')).toHaveText('425');
  await expect(page.locator('#statsRoster')).toHaveText('25 pupils · 12 male · 11 female');

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

test('3A Term 1 report preserves the official 45/45 invariant and CSV export values', async ({ page }) => {
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
  await expect(page.locator('#reportRegisters')).toHaveText('45/45');
  await expect(page.locator('#reportSchoolDays')).toHaveText('45/45');
  await expect(page.locator('#reportBanner')).toContainText('Complete Term 1 report');

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
  expect(csv).toContain('Completed Registers,45');
  expect(csv).toContain('Missing Registers,0');
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

test('newer monthly statistics selection ignores an older response that finishes last', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_monthly_class_stats: [
        { __defer: 'stats-old', response: februaryStatsFixture() },
        missingMonthlyStatsFixture()
      ]
    }
  });

  await page.locator('#statisticsTabBtn').click();
  await expect.poll(() => harness.pendingRpcLabels()).toContain('stats-old');
  await page.locator('#statsClassSelect').selectOption('class-3b');
  await expect(page.locator('#statsCumulative')).toHaveText('90');
  await expect(page.locator('#statsBanner')).toContainText('1 register is missing');

  await harness.releaseRpc('stats-old');
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3b');
  await expect(page.locator('#statsCumulative')).toHaveText('90');
  await expect(page.locator('#statsBanner')).toContainText('1 register is missing');
  await harness.expectNoProductionRequests();
});

test('newer dashboard month ignores an older dashboard response that finishes last', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_school_dashboard: [
        { __defer: 'dashboard-old', response: dashboardFixture() },
        marchDashboardFixture()
      ]
    }
  });

  await page.locator('#dashboardTabBtn').click();
  await expect.poll(() => harness.pendingRpcLabels()).toContain('dashboard-old');
  await page.locator('#dashboardMonth').evaluate(element => {
    element.value = '2026-03';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#dashboardMonthLabel')).toHaveText('March 2026');
  await expect(page.locator('#dashboardCumulative')).toHaveText('900');

  await harness.releaseRpc('dashboard-old');
  await expect(page.locator('#dashboardMonth')).toHaveValue('2026-03');
  await expect(page.locator('#dashboardMonthLabel')).toHaveText('March 2026');
  await expect(page.locator('#dashboardCumulative')).toHaveText('900');
  await harness.expectNoProductionRequests();
});

test('newer report class keeps its term options when older options finish last', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_class_report_options: [
        { __defer: 'report-options-old', response: reportOptionsFixture() },
        reportOptions3BFixture()
      ]
    }
  });

  await page.locator('#reportsTabBtn').click();
  await expect.poll(() => harness.pendingRpcLabels()).toContain('report-options-old');
  await page.locator('#reportClassSelect').selectOption('class-3b');
  await expect(page.locator('#reportTermSelect')).toHaveValue('term-3b');
  await expect(page.locator('#reportTermSelect')).toContainText('3B Term');

  await harness.releaseRpc('report-options-old');
  await expect(page.locator('#reportClassSelect')).toHaveValue('class-3b');
  await expect(page.locator('#reportTermSelect')).toHaveValue('term-3b');
  await expect(page.locator('#reportTermSelect')).toContainText('3B Term');
  await harness.expectNoProductionRequests();
});

test('newer YTD report remains rendered when an older term report finishes last', async ({ page }) => {
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_class_report_options: reportOptionsFixture(),
      attendance_class_period_report: [
        { __defer: 'period-report-old', response: termReportFixture() },
        ytdReportFixture()
      ]
    }
  });

  await page.locator('#reportsTabBtn').click();
  await expect(page.locator('#reportTermSelect')).toHaveValue('term-1');
  await page.locator('#loadReportBtn').click();
  await expect.poll(() => harness.pendingRpcLabels()).toContain('period-report-old');

  await page.locator('#reportType').selectOption('ytd');
  await page.locator('#reportAsOf').fill('2026-03-15');
  await expect(page.locator('#loadReportBtn')).toBeEnabled();
  await page.locator('#loadReportBtn').click();
  await expect(page.locator('#reportPeriodLabel')).toHaveText('Year to Date through 15 March 2026');
  await expect(page.locator('#reportCumulative')).toHaveText('650');
  await expect(page.locator('#exportReportBtn')).toBeEnabled();

  await harness.releaseRpc('period-report-old');
  await expect(page.locator('#reportType')).toHaveValue('ytd');
  await expect(page.locator('#reportPeriodLabel')).toHaveText('Year to Date through 15 March 2026');
  await expect(page.locator('#reportCumulative')).toHaveText('650');
  await expect(page.locator('#exportReportBtn')).toBeEnabled();
  await harness.expectNoProductionRequests();
});

test('dashboard View opens the selected class and dashboard month in Statistics', async ({ page }) => {
  const marchStats = {
    ...missingMonthlyStatsFixture(),
    month: '2026-03',
    as_of_date: '2026-03-05'
  };
  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    extraRpc: {
      attendance_admin_school_dashboard: marchDashboardFixture(),
      attendance_monthly_class_stats: marchStats
    }
  });

  await page.locator('#dashboardMonth').evaluate(element => {
    element.value = '2026-03';
  });
  await page.locator('#dashboardTabBtn').click();
  await expect(page.locator('#dashboardMonthLabel')).toHaveText('March 2026');

  const row3B = page.locator('#dashboardClassBody tr').filter({ hasText: '3B' });
  await row3B.locator('.dashboard-view').click();

  await expect(page.locator('#statisticsPanel')).toBeVisible();
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3b');
  await expect(page.locator('#statsMonth')).toHaveValue('2026-03');
  await expect(page.locator('#statsCumulative')).toHaveText('90');

  const calls = await harness.calls();
  const dashboard = calls.rpc.find(call => call.name === 'attendance_admin_school_dashboard');
  const stats = calls.rpc.find(call => call.name === 'attendance_monthly_class_stats');
  expect(dashboard.args).toEqual({ p_school_id: 'school-test', p_month: '2026-03-01' });
  expect(stats.args).toEqual({ p_class_id: 'class-3b', p_month: '2026-03-01' });
  await harness.expectNoProductionRequests();
});
