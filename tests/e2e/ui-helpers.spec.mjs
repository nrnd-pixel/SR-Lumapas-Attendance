import { test, expect } from '@playwright/test';
import { openAuthorized, registerFixture } from './harness.mjs';

test('HTML-looking pupil data is escaped as literal text', async ({ page }) => {
  const register = registerFixture();
  const hostile = '<img id="xss-pupil" src=x onerror="window.__attendanceXss=1">Synthetic & <b>Pupil</b>';
  register.students[0].full_name = hostile;

  const harness = await openAuthorized(page, { register });
  const name = page.locator('#studentList .student-name').first();
  await expect(name).toContainText(hostile);
  await expect(page.locator('#xss-pupil')).toHaveCount(0);
  expect(await page.evaluate(() => window.__attendanceXss)).toBeUndefined();
  await harness.expectNoProductionRequests();
});

test('class options preserve grouping, sorting, compact labels, blank option, and move-class exclusion', async ({ page }) => {
  const classes = [
    { id: 'class-3b', school_id: 'school-test', class_code: '3B', class_name: 'Year 3B', year_level: 3 },
    { id: 'class-pra-b', school_id: 'school-test', class_code: 'PRA B', class_name: 'Pra B', year_level: 0 },
    { id: 'class-2b', school_id: 'school-test', class_code: '2B', class_name: 'Year 2B', year_level: 2 },
    { id: 'class-3a', school_id: 'school-test', class_code: '3A', class_name: 'Year 3A', year_level: 3 },
    { id: 'class-pra-a', school_id: 'school-test', class_code: 'PRA A', class_name: 'Pra A', year_level: 0 },
    { id: 'class-2a', school_id: 'school-test', class_code: '2A', class_name: 'Year 2A', year_level: 2 }
  ];
  const register = registerFixture();
  const pupil = {
    enrolment_id: 'enrol-grouping',
    full_name: 'Grouping Pupil',
    class_id: 'class-3a',
    class_code: '3A',
    student_ref: 'GROUP-001',
    reporting_group: 'Mainstream',
    start_date: '2026-01-05',
    last_attendance_date: null
  };
  const roster = { total_current: 1, classes, students: [pupil], recent_movements: [] };

  const harness = await openAuthorized(page, {
    admin: true,
    classes,
    register,
    extraRpc: { attendance_admin_student_roster: roster }
  });

  const fullGroups = await page.locator('#classSelect optgroup').evaluateAll(groups => groups.map(group => ({
    label: group.label,
    options: [...group.querySelectorAll('option')].map(option => ({ value: option.value, text: option.textContent }))
  })));
  expect(fullGroups).toEqual([
    { label: 'Prasekolah', options: [
      { value: 'class-pra-a', text: 'PRA A — Pra A' },
      { value: 'class-pra-b', text: 'PRA B — Pra B' }
    ] },
    { label: 'Year 2', options: [
      { value: 'class-2a', text: '2A — Year 2A' },
      { value: 'class-2b', text: '2B — Year 2B' }
    ] },
    { label: 'Year 3', options: [
      { value: 'class-3a', text: '3A — Year 3A' },
      { value: 'class-3b', text: '3B — Year 3B' }
    ] }
  ]);

  await page.locator('#studentsTabBtn').click();
  await expect(page.locator('#studentAdminCount')).toHaveText('1 current pupils');
  await expect(page.locator('#studentClassFilter > option').first()).toHaveText('All classes');

  const compactGroups = await page.locator('#tiClass optgroup').evaluateAll(groups => groups.map(group => ({
    label: group.label,
    options: [...group.querySelectorAll('option')].map(option => ({ value: option.value, text: option.textContent }))
  })));
  expect(compactGroups).toEqual([
    { label: 'Prasekolah', options: [
      { value: 'class-pra-a', text: 'Pra A' },
      { value: 'class-pra-b', text: 'Pra B' }
    ] },
    { label: 'Year 2', options: [
      { value: 'class-2a', text: '2A' },
      { value: 'class-2b', text: '2B' }
    ] },
    { label: 'Year 3', options: [
      { value: 'class-3a', text: '3A' },
      { value: 'class-3b', text: '3B' }
    ] }
  ]);

  await page.locator('#adminStudentList .move-class').click();
  await expect(page.locator('#moveClassDialog')).toBeVisible();
  const moveValues = await page.locator('#mcClass option').evaluateAll(options => options.map(option => option.value));
  expect(moveValues).toEqual(['class-pra-a', 'class-pra-b', 'class-2a', 'class-2b', 'class-3b']);
  expect(moveValues).not.toContain('class-3a');
  await harness.expectNoProductionRequests();
});
