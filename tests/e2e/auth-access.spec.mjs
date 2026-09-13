import { test, expect } from '@playwright/test';
import {
  bootstrapFixture,
  installHarness,
  openAuthorized,
  registerFixture,
  syntheticClass
} from './harness.mjs';

test('teacher signs in, survives refresh, and signs out', async ({ page }) => {
  const harness = await installHarness(page, {
    session: null,
    rpc: {
      attendance_teacher_status: { authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });

  await page.goto('/');
  await expect(page.locator('#loginView')).toBeVisible();

  await page.locator('#email').fill('teacher@example.test');
  await page.locator('#password').fill('synthetic-password');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#classSelect option')).toHaveCount(1);

  let calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signInWithPassword')).toHaveLength(1);

  await page.reload();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#classSelect option')).toHaveCount(1);

  await page.locator('#signOutBtn').click();
  await expect(page.locator('#loginView')).toBeVisible();

  calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signOut')).toHaveLength(1);
  await harness.expectNoProductionRequests();
});

test('teacher scope exposes assigned class only', async ({ page }) => {
  const harness = await openAuthorized(page);
  await expect(page.locator('#classSelect option')).toHaveCount(1);
  await expect(page.locator('#classSelect')).toHaveValue('class-3a');
  await expect(page.locator('#dashboardTabBtn')).toHaveClass(/hidden/);
  await expect(page.locator('#studentsTabBtn')).toHaveClass(/hidden/);
  await expect(page.locator('#teachersTabBtn')).toHaveClass(/hidden/);
  await harness.expectNoProductionRequests();
});

test('admin scope exposes all assigned classes and admin tabs', async ({ page }) => {
  const classes = [
    syntheticClass(),
    syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  ];
  const harness = await openAuthorized(page, { admin: true, classes });
  await expect(page.locator('#classSelect option')).toHaveCount(2);
  await expect(page.locator('#dashboardTabBtn')).not.toHaveClass(/hidden/);
  await expect(page.locator('#studentsTabBtn')).not.toHaveClass(/hidden/);
  await expect(page.locator('#teachersTabBtn')).not.toHaveClass(/hidden/);
  await harness.expectNoProductionRequests();
});

test('signup returns from email verification into Pending Approval', async ({ page }) => {
  const school = {
    id: 'school-test',
    name: 'SR Lumapas Test',
    classes: [syntheticClass()]
  };
  const pending = {
    status: 'pending',
    full_name: 'Synthetic Teacher',
    requested_class_id: 'class-3a',
    requested_class_code: '3A',
    requested_role: 'class_teacher'
  };
  const harness = await installHarness(page, {
    session: null,
    auth: {
      signUp: { data: { session: null, user: { email: 'new.teacher@example.test' } }, error: null }
    },
    rpc: {
      attendance_signup_options: { schools: [school] },
      attendance_teacher_status: [
        { authorized: false, signup_request: null },
        { authorized: false, signup_request: pending }
      ],
      attendance_submit_teacher_request: { status: 'pending' }
    }
  });

  await page.goto('/');
  await page.locator('#openSignupBtn').click();
  await page.locator('#signupName').fill('Synthetic Teacher');
  await page.locator('#signupEmail').fill('new.teacher@example.test');
  await page.locator('#signupPassword').fill('synthetic-password');
  await page.locator('#signupClass').selectOption('class-3a');
  await page.locator('#signupRole').selectOption('class_teacher');
  await page.locator('#signupBtn').click();

  await expect(page.locator('#signupMsg')).toContainText('Check your email');
  await page.evaluate(() => {
    localStorage.setItem('__ATTENDANCE_TEST_SESSION__', JSON.stringify({
      user: { email: 'new.teacher@example.test' }
    }));
  });

  await page.reload();
  await expect(page.locator('#teacherGateView')).toBeVisible();
  await expect(page.locator('#gateStatus')).toContainText('Pending admin approval');

  const calls = await harness.calls();
  const request = calls.rpc.find(call => call.name === 'attendance_submit_teacher_request');
  expect(request.args).toEqual({
    p_full_name: 'Synthetic Teacher',
    p_requested_class_id: 'class-3a',
    p_requested_role: 'class_teacher'
  });
  await harness.expectNoProductionRequests();
});

test('password recovery link stays on Set New Password', async ({ page }) => {
  test.fail(true, 'Known Phase 2 bug: PASSWORD_RECOVERY loses the startup routing race.');

  const harness = await installHarness(page, {
    session: { user: { email: 'teacher@example.test' } },
    authEvents: [
      { event: 'PASSWORD_RECOVERY', microtask: true, session: { user: { email: 'teacher@example.test' } } }
    ],
    rpc: {
      attendance_teacher_status: { authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });

  await page.goto('/');
  await page.waitForTimeout(100);
  await expect(page.locator('#recoveryView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();
  await harness.expectNoProductionRequests();
});

test('password recovery rejects mismatched confirmation', async ({ page }) => {
  const harness = await installHarness(page, { session: null, rpc: {} });
  await page.goto('/');
  await page.evaluate(() => window.__attendanceTestEmitAuth(
    'PASSWORD_RECOVERY',
    { user: { email: 'teacher@example.test' } }
  ));

  await expect(page.locator('#recoveryView')).toBeVisible();
  await page.locator('#newPassword').fill('new-password-1');
  await page.locator('#confirmPassword').fill('new-password-2');
  await page.locator('#recoveryBtn').click();

  await expect(page.locator('#recoveryMsg')).toContainText('do not match');
  const calls = await harness.calls();
  expect(calls.auth.some(call => call.method === 'updateUser')).toBe(false);
  await harness.expectNoProductionRequests();
});

test('successful recovery signs out recovery session and returns to login', async ({ page }) => {
  test.fail(true, 'Known Phase 2 bug: successful recovery currently routes into Attendance instead of signing out.');

  const harness = await installHarness(page, {
    session: null,
    rpc: {
      attendance_teacher_status: { authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });
  await page.goto('/');
  await page.evaluate(() => window.__attendanceTestEmitAuth(
    'PASSWORD_RECOVERY',
    { user: { email: 'teacher@example.test' } }
  ));

  await page.locator('#newPassword').fill('new-password-1');
  await page.locator('#confirmPassword').fill('new-password-1');
  await page.locator('#recoveryBtn').click();
  await page.waitForTimeout(900);

  const calls = await harness.calls();
  expect(calls.auth.some(call => call.method === 'updateUser')).toBe(true);
  expect(calls.auth.some(call => call.method === 'signOut')).toBe(true);
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();
  await harness.expectNoProductionRequests();
});
