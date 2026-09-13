import { test, expect } from '@playwright/test';
import { openAuthorized, registerFixture } from './harness.mjs';

test('Mark All Present, edit an exception, and save the first register', async ({ page }) => {
  const savedAfter = registerFixture({
    saved: true,
    statuses: [
      { status_code: 'P', reason_code: null, note: null },
      { status_code: 'A', reason_code: 'MEDICAL', note: null },
      { status_code: 'P', reason_code: null, note: null }
    ]
  });
  const harness = await openAuthorized(page, {
    register: registerFixture(),
    registerSequence: [registerFixture(), savedAfter],
    extraRpc: {
      attendance_save_register: { no_changes: false, correction: false, recorded: 3 }
    }
  });

  await page.locator('#allPresentBtn').click();
  await expect(page.locator('#recordedCount')).toHaveText('3/3');
  await page.locator('select.status').nth(1).selectOption('absent');
  await page.locator('select.reason').nth(1).selectOption('MEDICAL');
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await page.locator('#saveBtn').click();
  await expect(page.locator('#dateBanner')).toContainText('Saved attendance loaded');

  const calls = await harness.calls();
  const save = calls.rpc.find(call => call.name === 'attendance_save_register');
  expect(save.args.p_class_id).toBe('class-3a');
  expect(save.args.p_date).toBe('2026-02-02');
  expect(save.args.p_correction_reason).toBeNull();
  expect(save.args.p_records).toEqual([
    { enrolment_id: 'enrol-1', status_code: 'P', reason_code: null, note: null },
    { enrolment_id: 'enrol-2', status_code: 'A', reason_code: 'MEDICAL', note: null },
    { enrolment_id: 'enrol-3', status_code: 'P', reason_code: null, note: null }
  ]);
  await harness.expectNoProductionRequests();
});

test('unchanged saved register does not offer a false correction save', async ({ page }) => {
  const harness = await openAuthorized(page, { register: registerFixture({ saved: true }) });
  await expect(page.locator('#saveBtn')).toBeDisabled();
  await expect(page.locator('#saveBtn')).toHaveText('No Changes');
  await expect(page.locator('#correctionBox')).toHaveClass(/hidden/);

  const calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_save_register')).toHaveLength(0);
  await harness.expectNoProductionRequests();
});

test('correction requires a reason and sends the changed register payload', async ({ page }) => {
  const original = registerFixture({
    saved: true,
    statuses: [
      { status_code: 'P', reason_code: null, note: null },
      { status_code: 'A', reason_code: 'MEDICAL', note: null },
      { status_code: 'P', reason_code: null, note: null }
    ]
  });
  const corrected = registerFixture({
    saved: true,
    statuses: [
      { status_code: 'P', reason_code: null, note: null },
      { status_code: 'A', reason_code: 'MEDICAL', note: null },
      { status_code: 'L', reason_code: null, note: null }
    ]
  });

  const harness = await openAuthorized(page, {
    register: original,
    registerSequence: [original, corrected],
    extraRpc: {
      attendance_save_register: { no_changes: false, correction: true, changed_records: 1 }
    }
  });

  await page.locator('select.status').nth(2).selectOption('late');
  await expect(page.locator('#correctionBox')).not.toHaveClass(/hidden/);
  await expect(page.locator('#correctionMeta')).toContainText('1 pupil record');
  await expect(page.locator('#saveBtn')).toBeDisabled();
  await expect(page.locator('#saveTitle')).toHaveText('Correction reason required');

  await page.locator('#correctionReason').fill('Synthetic correction reason');
  await expect(page.locator('#saveBtn')).toBeEnabled();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#saveBtn').click();
  await expect(page.locator('#dateBanner')).toContainText('Saved attendance loaded');

  const calls = await harness.calls();
  const save = calls.rpc.find(call => call.name === 'attendance_save_register');
  expect(save.args.p_correction_reason).toBe('Synthetic correction reason');
  expect(save.args.p_records[2]).toEqual({
    enrolment_id: 'enrol-3',
    status_code: 'L',
    reason_code: null,
    note: null
  });
  await harness.expectNoProductionRequests();
});

test('unsaved register change protects class/date navigation', async ({ page }) => {
  const harness = await openAuthorized(page);
  await page.locator('select.status').first().selectOption('present');

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#dateInput').evaluate(element => {
    element.value = '2026-02-03';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.locator('#dateInput')).toHaveValue('2026-02-02');
  const calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_load_register')).toHaveLength(1);
  await harness.expectNoProductionRequests();
});

test('mobile attendance view has no horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const harness = await openAuthorized(page);

  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await expect(page.locator('#attendancePanel')).toBeVisible();
  await expect(page.locator('#studentList .student')).toHaveCount(3);
  await harness.expectNoProductionRequests();

  await context.close();
});
