import { test, expect } from '@playwright/test';
import {
  bootstrapFixture,
  installHarness,
  openAuthorized,
  registerFixture,
  syntheticClass
} from './harness.mjs';

const PENDING_SIGNUP_KEY = 'srlAttendancePendingTeacherSignup';

const pendingSignup = (overrides = {}) => ({
  version: 2,
  userId: 'user-a',
  name: 'Teacher A',
  classId: 'class-3b',
  role: 'assistant_teacher',
  ...overrides
});

async function seedPendingSignup(page, value) {
  await page.addInitScript(({ key, pending }) => {
    localStorage.setItem(key, JSON.stringify(pending));
  }, { key: PENDING_SIGNUP_KEY, pending: value });
}

async function readPendingSignup(page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PENDING_SIGNUP_KEY);
}

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
  expect(calls.auth.filter(call => call.method === 'signOut')).toHaveLength(0);

  await page.reload();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#classSelect option')).toHaveCount(1);

  await page.locator('#signOutBtn').click();
  await expect(page.locator('#loginView')).toBeVisible();

  calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signOut')).toHaveLength(1);
  await harness.expectNoProductionRequests();
});

test('weak password sign-in clears the local session and directs teacher to password recovery', async ({ page }) => {
  const weakSession = { user: { email: 'teacher@example.test' }, access_token: 'synthetic-weak-session' };
  const harness = await installHarness(page, {
    session: null,
    auth: {
      signInWithPassword: {
        data: {
          user: weakSession.user,
          session: weakSession,
          weakPassword: { reasons: ['length'] }
        },
        error: null
      }
    },
    rpc: {}
  });

  await page.goto('/');
  await page.locator('#email').fill('teacher@example.test');
  await page.locator('#password').fill('legacy7');
  await page.locator('#loginBtn').click();

  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();
  await expect(page.locator('#loginMsg')).toContainText('Forgot password?');
  await expect(page.locator('#loginMsg')).toContainText('at least 8 characters');

  let calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signInWithPassword')).toEqual([
    { method: 'signInWithPassword', payload: { email: 'teacher@example.test', password: 'legacy7' } }
  ]);
  expect(calls.auth.filter(call => call.method === 'signOut')).toEqual([
    { method: 'signOut', options: { scope: 'local' } }
  ]);
  expect(calls.rpc).toEqual([]);

  await page.reload();
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();

  calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'getSession')).toHaveLength(1);
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
      signUp: {
        data: {
          session: null,
          user: { id: 'user-new-teacher', email: 'new.teacher@example.test' }
        },
        error: null
      }
    },
    rpc: {
      attendance_signup_options: { schools: [school] },
      attendance_teacher_status: [
        { user_id: 'user-new-teacher', authorized: false, signup_request: null },
        { user_id: 'user-new-teacher', authorized: false, signup_request: pending }
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
  const signupRedirectRoot = await page.evaluate(() => window.location.origin + '/');
  const signupCall = (await harness.calls()).auth.find(call => call.method === 'signUp');
  expect(signupCall?.payload?.options?.emailRedirectTo).toBe(signupRedirectRoot);
  expect(await readPendingSignup(page)).toEqual({
    version: 2,
    userId: 'user-new-teacher',
    name: 'Synthetic Teacher',
    classId: 'class-3a',
    role: 'class_teacher'
  });

  await page.evaluate(() => {
    localStorage.setItem('__ATTENDANCE_TEST_SESSION__', JSON.stringify({
      user: { id: 'user-new-teacher', email: 'new.teacher@example.test' }
    }));
  });

  await page.reload();
  await expect(page.locator('#teacherGateView')).toBeVisible();
  await expect(page.locator('#gateStatus')).toContainText('Pending admin approval');
  expect(await readPendingSignup(page)).toBeNull();

  const calls = await harness.calls();
  const request = calls.rpc.find(call => call.name === 'attendance_submit_teacher_request');
  expect(request.args).toEqual({
    p_full_name: 'Synthetic Teacher',
    p_requested_class_id: 'class-3a',
    p_requested_role: 'class_teacher'
  });
  await harness.expectNoProductionRequests();
});

test('failed signup does not create pending signup state', async ({ page }) => {
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes: [syntheticClass()] };
  const harness = await installHarness(page, {
    session: null,
    auth: {
      signUp: { data: { session: null, user: null }, error: { message: 'Synthetic signup failure' } }
    },
    rpc: {
      attendance_signup_options: { schools: [school] }
    }
  });

  await page.goto('/');
  await page.locator('#openSignupBtn').click();
  await page.locator('#signupName').fill('Failed Teacher');
  await page.locator('#signupEmail').fill('failed.teacher@example.test');
  await page.locator('#signupPassword').fill('synthetic-password');
  await page.locator('#signupClass').selectOption('class-3a');
  await page.locator('#signupBtn').click();

  await expect(page.locator('#signupMsg')).toContainText('Synthetic signup failure');
  expect(await readPendingSignup(page)).toBeNull();
  await harness.expectNoProductionRequests();
});

test('signup browser contract blocks passwords shorter than 8 characters before Auth', async ({ page }) => {
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes: [syntheticClass()] };
  const harness = await installHarness(page, {
    session: null,
    rpc: { attendance_signup_options: { schools: [school] } }
  });

  await page.goto('/');
  await page.locator('#openSignupBtn').click();
  await page.locator('#signupName').fill('Short Password Teacher');
  await page.locator('#signupEmail').fill('short.password@example.test');
  await page.locator('#signupPassword').fill('1234567');
  await page.locator('#signupClass').selectOption('class-3a');
  await page.locator('#signupBtn').click();

  await expect(page.locator('#signupPassword')).toHaveAttribute('minlength', '8');
  expect(await page.locator('#signupPassword').evaluate(el => el.validity.tooShort)).toBe(true);
  const calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signUp')).toEqual([]);
  expect(await readPendingSignup(page)).toBeNull();
  await harness.expectNoProductionRequests();
});

test('signup renders server weak-password rejection without creating pending state', async ({ page }) => {
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes: [syntheticClass()] };
  const harness = await installHarness(page, {
    session: null,
    auth: {
      signUp: {
        data: { session: null, user: null },
        error: { code: 'weak_password', message: 'Synthetic weak password response' }
      }
    },
    rpc: { attendance_signup_options: { schools: [school] } }
  });

  await page.goto('/');
  await page.locator('#openSignupBtn').click();
  await page.locator('#signupName').fill('Weak Password Teacher');
  await page.locator('#signupEmail').fill('weak.password@example.test');
  await page.locator('#signupPassword').fill('password8');
  await page.locator('#signupClass').selectOption('class-3a');
  await page.locator('#signupBtn').click();

  await expect(page.locator('#signupMsg')).toContainText('security requirements');
  await expect(page.locator('#signupMsg')).toContainText('at least 8 characters');
  expect(await readPendingSignup(page)).toBeNull();
  const calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signUp')).toHaveLength(1);
  await harness.expectNoProductionRequests();
});

test('shared device pending signup does not submit or prefill for a different account', async ({ page }) => {
  const classes = [
    syntheticClass(),
    syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  ];
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes };
  const teacherAPending = pendingSignup();
  await seedPendingSignup(page, teacherAPending);

  const harness = await installHarness(page, {
    session: { user: { id: 'user-b', email: 'teacher.b@example.test' } },
    rpc: {
      attendance_teacher_status: [
        { user_id: 'user-b', authorized: false, signup_request: null },
        {
          user_id: 'user-b',
          authorized: false,
          signup_request: {
            status: 'pending',
            full_name: 'Teacher B',
            requested_class_id: 'class-3a',
            requested_class_code: '3A',
            requested_role: 'class_teacher'
          }
        }
      ],
      attendance_signup_options: { schools: [school] },
      attendance_submit_teacher_request: { status: 'pending' }
    }
  });

  await page.goto('/');
  await expect(page.locator('#teacherGateView')).toBeVisible();
  await expect(page.locator('#gateRequestForm')).toBeVisible();
  await expect(page.locator('#gateName')).toHaveValue('');
  await expect(page.locator('#gateClass')).toHaveValue('class-3a');
  await expect(page.locator('#gateRole')).toHaveValue('class_teacher');

  let calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_submit_teacher_request')).toEqual([]);
  expect(await readPendingSignup(page)).toEqual(teacherAPending);

  await page.locator('#gateName').fill('Teacher B');
  await page.locator('#gateClass').selectOption('class-3a');
  await page.locator('#gateRole').selectOption('class_teacher');
  await page.locator('#gateSubmitBtn').click();
  await expect(page.locator('#gateStatus')).toContainText('Pending admin approval');

  calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_submit_teacher_request')).toEqual([
    {
      name: 'attendance_submit_teacher_request',
      args: {
        p_full_name: 'Teacher B',
        p_requested_class_id: 'class-3a',
        p_requested_role: 'class_teacher'
      }
    }
  ]);
  expect(await readPendingSignup(page)).toEqual(teacherAPending);
  await harness.expectNoProductionRequests();
});

test('authorized different account does not clear another user pending signup state', async ({ page }) => {
  const teacherAPending = pendingSignup();
  await seedPendingSignup(page, teacherAPending);
  const harness = await installHarness(page, {
    session: { user: { id: 'user-b', email: 'teacher.b@example.test' } },
    rpc: {
      attendance_teacher_status: { user_id: 'user-b', authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });

  await page.goto('/');
  await expect(page.locator('#appView')).toBeVisible();
  expect(await readPendingSignup(page)).toEqual(teacherAPending);
  await harness.expectNoProductionRequests();
});

test('legacy unbound pending signup state is discarded instead of attributed to the signed-in account', async ({ page }) => {
  const classes = [
    syntheticClass(),
    syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  ];
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes };
  await seedPendingSignup(page, {
    name: 'Legacy Teacher',
    classId: 'class-3b',
    role: 'assistant_teacher'
  });
  const harness = await installHarness(page, {
    session: { user: { id: 'user-b', email: 'teacher.b@example.test' } },
    rpc: {
      attendance_teacher_status: { user_id: 'user-b', authorized: false, signup_request: null },
      attendance_signup_options: { schools: [school] }
    }
  });

  await page.goto('/');
  await expect(page.locator('#teacherGateView')).toBeVisible();
  await expect(page.locator('#gateRequestForm')).toBeVisible();
  await expect(page.locator('#gateName')).toHaveValue('');
  await expect(page.locator('#gateClass')).toHaveValue('class-3a');
  await expect(page.locator('#gateRole')).toHaveValue('class_teacher');
  expect(await readPendingSignup(page)).toBeNull();

  const calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_submit_teacher_request')).toEqual([]);
  await harness.expectNoProductionRequests();
});

test('rejected teacher request pre-fills correction form and resubmits exact corrected request', async ({ page }) => {
  const classes = [
    syntheticClass(),
    syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  ];
  const school = { id: 'school-test', name: 'SR Lumapas Test', classes };
  const rejected = {
    status: 'rejected',
    full_name: 'Teacher Correction',
    requested_class_id: 'class-3a',
    requested_class_code: '3A',
    requested_role: 'class_teacher',
    admin_note: '<b>Please choose the correct class</b>'
  };
  const pending = {
    status: 'pending',
    full_name: 'Teacher Correction',
    requested_class_id: 'class-3b',
    requested_class_code: '3B',
    requested_role: 'assistant_teacher'
  };
  const harness = await installHarness(page, {
    session: { user: { id: 'teacher-rejected', email: 'teacher.rejected@example.test' } },
    rpc: {
      attendance_teacher_status: [
        { user_id: 'teacher-rejected', authorized: false, signup_request: rejected },
        { user_id: 'teacher-rejected', authorized: false, signup_request: pending }
      ],
      attendance_signup_options: { schools: [school] },
      attendance_submit_teacher_request: { status: 'pending' }
    }
  });

  await page.goto('/');
  await expect(page.locator('#teacherGateView')).toBeVisible();
  await expect(page.locator('#gateStatus')).toContainText('Request not approved');
  await expect(page.locator('#gateStatus')).toContainText('<b>Please choose the correct class</b>');
  await expect(page.locator('#gateStatus b')).toHaveCount(0);
  await expect(page.locator('#gateRequestForm')).toBeVisible();
  await expect(page.locator('#gateName')).toHaveValue('Teacher Correction');
  await expect(page.locator('#gateClass')).toHaveValue('class-3a');
  await expect(page.locator('#gateRole')).toHaveValue('class_teacher');

  await page.locator('#gateClass').selectOption('class-3b');
  await page.locator('#gateRole').selectOption('assistant_teacher');
  await page.locator('#gateSubmitBtn').click();

  await expect(page.locator('#gateStatus')).toContainText('Pending admin approval');
  const calls = await harness.calls();
  expect(calls.rpc.filter(call => call.name === 'attendance_submit_teacher_request')).toEqual([
    {
      name: 'attendance_submit_teacher_request',
      args: {
        p_full_name: 'Teacher Correction',
        p_requested_class_id: 'class-3b',
        p_requested_role: 'assistant_teacher'
      }
    }
  ]);
  await harness.expectNoProductionRequests();
});

test('forgot password sends the current origin root as recovery redirect', async ({ page }) => {
  const harness = await installHarness(page, { session: null, rpc: {} });
  await page.goto('/');
  await page.locator('#email').fill('teacher@example.test');
  await page.locator('#forgotBtn').click();

  await expect(page.locator('#loginMsg')).toContainText('Password reset email sent');
  const recoveryRedirectRoot = await page.evaluate(() => window.location.origin + '/');
  const resetCall = (await harness.calls()).auth.find(call => call.method === 'resetPasswordForEmail');
  expect(resetCall).toEqual({
    method: 'resetPasswordForEmail',
    email: 'teacher@example.test',
    options: { redirectTo: recoveryRedirectRoot }
  });
  await harness.expectNoProductionRequests();
});

test('password recovery link stays on Set New Password', async ({ page }) => {
  const harness = await installHarness(page, {
    session: { user: { email: 'teacher@example.test' } },
    authEvents: [
      { event: 'PASSWORD_RECOVERY', delay: 25, session: { user: { email: 'teacher@example.test' } } }
    ],
    rpc: {
      attendance_teacher_status: { authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });

  await page.goto('/#access_token=synthetic&type=recovery');
  await expect(page.locator('#recoveryView')).toBeVisible();
  await page.waitForTimeout(75);
  await expect(page.locator('#recoveryView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();

  const calls = await harness.calls();
  expect(calls.rpc).toEqual([]);
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

test('password recovery browser contract blocks passwords shorter than 8 characters before Auth', async ({ page }) => {
  const harness = await installHarness(page, { session: null, rpc: {} });
  await page.goto('/');
  await page.evaluate(() => window.__attendanceTestEmitAuth(
    'PASSWORD_RECOVERY',
    { user: { email: 'teacher@example.test' } }
  ));

  await expect(page.locator('#recoveryView')).toBeVisible();
  await page.locator('#newPassword').fill('1234567');
  await page.locator('#confirmPassword').fill('1234567');
  await page.locator('#recoveryBtn').click();

  await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '8');
  await expect(page.locator('#confirmPassword')).toHaveAttribute('minlength', '8');
  expect(await page.locator('#newPassword').evaluate(el => el.validity.tooShort)).toBe(true);
  const calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'updateUser')).toEqual([]);
  expect(calls.auth.filter(call => call.method === 'signOut')).toEqual([]);
  await harness.expectNoProductionRequests();
});

test('password recovery stays in recovery on server weak-password rejection', async ({ page }) => {
  const harness = await installHarness(page, {
    session: null,
    auth: {
      updateUser: {
        data: { user: null },
        error: { code: 'weak_password', message: 'Synthetic weak password response' }
      }
    },
    rpc: {}
  });
  await page.goto('/');
  await page.evaluate(() => window.__attendanceTestEmitAuth(
    'PASSWORD_RECOVERY',
    { user: { email: 'teacher@example.test' } }
  ));

  await page.locator('#newPassword').fill('password8');
  await page.locator('#confirmPassword').fill('password8');
  await page.locator('#recoveryBtn').click();

  await expect(page.locator('#recoveryView')).toBeVisible();
  await expect(page.locator('#loginView')).toBeHidden();
  await expect(page.locator('#appView')).toBeHidden();
  await expect(page.locator('#recoveryMsg')).toContainText('security requirements');
  await expect(page.locator('#recoveryMsg')).toContainText('at least 8 characters');

  const calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'updateUser')).toEqual([
    { method: 'updateUser', payload: { password: 'password8' } }
  ]);
  expect(calls.auth.filter(call => call.method === 'signOut')).toEqual([]);
  expect(calls.rpc).toEqual([]);
  await harness.expectNoProductionRequests();
});

test('successful recovery rejects old password, accepts new password, and preserves teacher scope', async ({ page }) => {
  const harness = await installHarness(page, {
    session: null,
    authPassword: 'old-password-1',
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

  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();
  await expect(page.locator('#loginMsg')).toContainText('Sign in with your new password');

  let calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'updateUser')).toEqual([
    { method: 'updateUser', payload: { password: 'new-password-1' } }
  ]);
  expect(calls.auth.filter(call => call.method === 'signOut')).toHaveLength(1);
  expect(calls.rpc).toEqual([]);

  await page.locator('#email').fill('teacher@example.test');
  await page.locator('#password').fill('old-password-1');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#loginMsg')).toContainText('Invalid login credentials');
  await expect(page.locator('#appView')).toBeHidden();

  await page.locator('#password').fill('new-password-1');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#classSelect')).toHaveValue('class-3a');
  await expect(page.locator('#classSelect option')).toHaveCount(1);
  await expect(page.locator('#dashboardTabBtn')).toHaveClass(/hidden/);

  calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'signInWithPassword')).toEqual([
    { method: 'signInWithPassword', payload: { email: 'teacher@example.test', password: 'old-password-1' } },
    { method: 'signInWithPassword', payload: { email: 'teacher@example.test', password: 'new-password-1' } }
  ]);
  expect(calls.rpc.map(call => call.name)).toEqual([
    'attendance_teacher_status',
    'attendance_bootstrap',
    'attendance_load_register'
  ]);
  await harness.expectNoProductionRequests();
});

test('password recovery stays on Set New Password if recovery sign-out fails', async ({ page }) => {
  const harness = await installHarness(page, {
    session: null,
    auth: {
      signOut: { error: { message: 'Synthetic recovery sign-out failure' } }
    },
    rpc: {}
  });
  await page.goto('/');
  await page.evaluate(() => window.__attendanceTestEmitAuth(
    'PASSWORD_RECOVERY',
    { user: { email: 'teacher@example.test' } }
  ));

  await expect(page.locator('#recoveryView')).toBeVisible();
  await page.locator('#newPassword').fill('new-password-1');
  await page.locator('#confirmPassword').fill('new-password-1');
  await page.locator('#recoveryBtn').click();

  await expect(page.locator('#recoveryView')).toBeVisible();
  await expect(page.locator('#loginView')).toBeHidden();
  await expect(page.locator('#appView')).toBeHidden();
  await expect(page.locator('#recoveryMsg')).toContainText('recovery session could not be signed out');

  const calls = await harness.calls();
  expect(calls.auth.filter(call => call.method === 'updateUser')).toEqual([
    { method: 'updateUser', payload: { password: 'new-password-1' } }
  ]);
  expect(calls.auth.filter(call => call.method === 'signOut')).toHaveLength(1);
  expect(calls.rpc).toEqual([]);
  await harness.expectNoProductionRequests();
});

test('external signed-out event returns to login without additional Attendance RPCs', async ({ page }) => {
  const harness = await installHarness(page, {
    session: { user: { id: 'teacher-user', email: 'teacher@example.test' } },
    rpc: {
      attendance_teacher_status: { user_id: 'teacher-user', authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture(),
      attendance_load_register: registerFixture()
    }
  });

  await page.goto('/');
  await expect(page.locator('#appView')).toBeVisible();
  const before = await harness.calls();
  expect(before.rpc.map(call => call.name)).toEqual([
    'attendance_teacher_status',
    'attendance_bootstrap',
    'attendance_load_register'
  ]);

  await page.evaluate(() => window.__attendanceTestEmitAuth('SIGNED_OUT', null));
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appView')).toBeHidden();

  const after = await harness.calls();
  expect(after.rpc).toEqual(before.rpc);
  await harness.expectNoProductionRequests();
});

test('authorized bootstrap prefers the last saved class across attendance and reporting selectors', async ({ page }) => {
  const classes = [
    syntheticClass(),
    syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  ];
  const register = {
    ...registerFixture(),
    class: syntheticClass({ id: 'class-3b', class_code: '3B', class_name: 'Year 3B' })
  };
  await page.addInitScript(() => localStorage.setItem('srlAttendanceLastClass', 'class-3b'));
  const harness = await openAuthorized(page, { classes, register });

  await expect(page.locator('#classSelect')).toHaveValue('class-3b');
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3b');
  await expect(page.locator('#reportClassSelect')).toHaveValue('class-3b');

  const calls = await harness.calls();
  const load = calls.rpc.find(call => call.name === 'attendance_load_register');
  expect(load.args).toEqual({ p_class_id: 'class-3b', p_date: '2026-02-02' });
  await harness.expectNoProductionRequests();
});

test('authorized account with no assigned classes warns and does not load a register', async ({ page }) => {
  const harness = await installHarness(page, {
    session: { user: { id: 'teacher-no-class', email: 'noclass@example.test' } },
    rpc: {
      attendance_teacher_status: { user_id: 'teacher-no-class', authorized: true, signup_request: null },
      attendance_bootstrap: bootstrapFixture({ classes: [] })
    }
  });

  await page.goto('/');
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#classSelect option')).toHaveCount(0);
  await expect(page.locator('#dateBanner')).toContainText('No attendance class has been assigned to this account.');

  const calls = await harness.calls();
  expect(calls.rpc.map(call => call.name)).toEqual([
    'attendance_teacher_status',
    'attendance_bootstrap'
  ]);
  await harness.expectNoProductionRequests();
});
