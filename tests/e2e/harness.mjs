import { expect } from '@playwright/test';

const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';
const PROD_SUPABASE = 'https://rojetehazryfpcxlwtbi.supabase.co';

export const syntheticClass = (overrides = {}) => ({
  id: 'class-3a',
  school_id: 'school-test',
  class_code: '3A',
  class_name: 'Year 3A',
  year_level: 3,
  ...overrides
});

export const bootstrapFixture = ({ admin = false, classes = [syntheticClass()] } = {}) => ({
  user: {
    email: admin ? 'admin@example.test' : 'teacher@example.test',
    school_role: admin ? 'admin' : 'teacher',
    all_classes: admin
  },
  classes,
  reasons: [
    { code: 'NONE', label: 'No supporting reason', requires_note: false },
    { code: 'MEDICAL', label: 'Medical', requires_note: false },
    { code: 'FAMILY', label: 'Family matter', requires_note: false },
    { code: 'OTHER', label: 'Other', requires_note: true }
  ]
});

export const registerFixture = ({ saved = false, statuses = null, date = '2026-02-02' } = {}) => {
  const pupils = [
    { enrolment_id: 'enrol-1', full_name: 'Test Pupil One', reporting_group: 'Mainstream', include_in_class_stats: true },
    { enrolment_id: 'enrol-2', full_name: 'Test Pupil Two', reporting_group: 'Mainstream', include_in_class_stats: true },
    { enrolment_id: 'enrol-3', full_name: 'Test Pupil Three', reporting_group: 'Mainstream', include_in_class_stats: true }
  ];
  const effective = statuses || (saved ? [
    { status_code: 'P', reason_code: null, note: null },
    { status_code: 'P', reason_code: null, note: null },
    { status_code: 'P', reason_code: null, note: null }
  ] : [
    { status_code: null, reason_code: null, note: null },
    { status_code: null, reason_code: null, note: null },
    { status_code: null, reason_code: null, note: null }
  ]);
  return {
    class: syntheticClass(),
    date,
    is_school_day: true,
    calendar_label: null,
    term_name: 'Term 1',
    register: saved ? { id: 'register-test', status: 'submitted', correction_count: 0 } : null,
    students: pupils.map((pupil, index) => ({ ...pupil, ...effective[index] }))
  };
};

const SYNTHETIC_MODULE = String.raw`
const config = window.__ATTENDANCE_TEST_CONFIG__ || {};
const calls = window.__ATTENDANCE_TEST_CALLS__ = { auth: [], rpc: [] };
const indexes = {};
let session = config.session || null;
let authCallback = null;

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function configured(name, fallback) {
  const value = config.auth && Object.prototype.hasOwnProperty.call(config.auth, name)
    ? config.auth[name]
    : fallback;
  return copy(value);
}

function nextRpc(name) {
  const configuredRpc = config.rpc ? config.rpc[name] : undefined;
  if (Array.isArray(configuredRpc)) {
    const index = indexes[name] || 0;
    indexes[name] = index + 1;
    return configuredRpc[Math.min(index, configuredRpc.length - 1)];
  }
  return configuredRpc;
}

async function emit(event, nextSession = session) {
  session = nextSession;
  if (authCallback) await authCallback(event, nextSession);
}
window.__attendanceTestEmitAuth = emit;

export function createClient() {
  return {
    auth: {
      onAuthStateChange(callback) {
        authCallback = callback;
        for (const item of config.authEvents || []) {
          const fire = () => callback(item.event, item.session === undefined ? session : item.session);
          if (item.microtask) queueMicrotask(fire);
          else setTimeout(fire, Number(item.delay || 0));
        }
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() {
        calls.auth.push({ method: 'getSession' });
        const stored = localStorage.getItem('__ATTENDANCE_TEST_SESSION__');
        if (stored) session = JSON.parse(stored);
        return { data: { session } };
      },
      async signInWithPassword(payload) {
        calls.auth.push({ method: 'signInWithPassword', payload: copy(payload) });
        const result = configured('signInWithPassword', {
          data: { session: { user: { email: payload.email } } },
          error: null
        });
        if (!result.error && result.data && result.data.session) {
          session = result.data.session;
          localStorage.setItem('__ATTENDANCE_TEST_SESSION__', JSON.stringify(session));
        }
        return result;
      },
      async signUp(payload) {
        calls.auth.push({ method: 'signUp', payload: copy(payload) });
        return configured('signUp', { data: { session: null, user: { email: payload.email } }, error: null });
      },
      async signOut() {
        calls.auth.push({ method: 'signOut' });
        const result = configured('signOut', { error: null });
        if (!result.error) {
          session = null;
          localStorage.removeItem('__ATTENDANCE_TEST_SESSION__');
          if (authCallback) await authCallback('SIGNED_OUT', null);
        }
        return result;
      },
      async resetPasswordForEmail(email, options) {
        calls.auth.push({ method: 'resetPasswordForEmail', email, options: copy(options) });
        return configured('resetPasswordForEmail', { data: {}, error: null });
      },
      async updateUser(payload) {
        calls.auth.push({ method: 'updateUser', payload: copy(payload) });
        return configured('updateUser', { data: { user: { id: 'test-user' } }, error: null });
      }
    },
    async rpc(name, args = {}) {
      calls.rpc.push({ name, args: copy(args) });
      const response = nextRpc(name);
      if (response === undefined) {
        return { data: null, error: { message: 'Unhandled synthetic RPC: ' + name } };
      }
      if (response && (Object.prototype.hasOwnProperty.call(response, 'data') || Object.prototype.hasOwnProperty.call(response, 'error'))) {
        return copy(response);
      }
      return { data: copy(response), error: null };
    }
  };
}
`;

export async function installHarness(page, config) {
  const productionRequests = [];
  page.on('request', request => {
    if (request.url().startsWith(PROD_SUPABASE)) productionRequests.push(request.url());
  });

  await page.addInitScript(value => {
    window.__ATTENDANCE_TEST_CONFIG__ = value;
    const fixedNow = value.now || '2026-02-02T00:00:00.000Z';
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() {
        return new NativeDate(fixedNow).valueOf();
      }
    }
    window.Date = FixedDate;
  }, config);

  await page.route(SUPABASE_ESM, route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: SYNTHETIC_MODULE
  }));

  await page.route(PROD_SUPABASE + '/**', route => route.abort());

  return {
    productionRequests,
    async calls() {
      return page.evaluate(() => window.__ATTENDANCE_TEST_CALLS__);
    },
    async expectNoProductionRequests() {
      expect(productionRequests).toEqual([]);
    }
  };
}

export async function openAuthorized(page, {
  admin = false,
  classes = [syntheticClass()],
  register = registerFixture(),
  registerSequence = null,
  extraRpc = {},
  session = { user: { email: admin ? 'admin@example.test' : 'teacher@example.test' } }
} = {}) {
  const rpc = {
    attendance_teacher_status: { authorized: true, signup_request: null },
    attendance_bootstrap: bootstrapFixture({ admin, classes }),
    attendance_load_register: registerSequence || register,
    ...extraRpc
  };
  const harness = await installHarness(page, { session, rpc });
  await page.goto('/');
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#studentList .student')).toHaveCount(register.students.length);
  return harness;
}
