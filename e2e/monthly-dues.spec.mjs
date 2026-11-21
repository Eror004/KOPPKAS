import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Safety boundary: this suite deliberately refuses any non-local Supabase URL.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
if (!url || !key || !serviceKey || !['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname)) throw new Error('E2E requires an isolated local Supabase URL and local keys');
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = randomBytes(24).toString('hex');
const roles = ['sekretaris', 'ketua_pemuda', 'wakil_ketua_pemuda', 'bendahara', 'ketua_rt_01', 'ketua_rw_01'];
const accounts = new Map();
function sql(query) { return execFileSync('docker', ['exec', 'supabase_db_koppkas', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim(); }
const currentMonth = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit'}).format(new Date()) + '-01';
const active = () => Number(sql(`select count(*) from public.monthly_dues_periods where dues_month = date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date and status = 'active'`));

test('six real local sessions: lifecycle, read-only finance boundaries and role access', async ({ browser }) => {
  // The job runs on a reset disposable database; never use externally supplied identities.
  for (const role of roles) {
    const email = `${role}.${randomBytes(8).toString('hex')}@example.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}` } });
    expect(error).toBeNull();
    const id = data.user.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    sql(`update public.profiles set role = '${role}', is_active = true where id = '${id}'`);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull(); expect(login.data.session?.access_token).toBeTruthy();
    accounts.set(role, { email, client });
  }
  expect(active()).toBe(0);
  const secretary = accounts.get('sekretaris').client;
  const deniedSync = await secretary.rpc('sync_monthly_dues_period_lifecycle');
  expect(deniedSync.error).toBeTruthy(); expect(active()).toBe(0);
  for (const role of roles) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel('Email organisasi').fill(accounts.get(role).email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', {name: /Masuk ke workspace/}).click();
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
      await page.goto('/dashboard/uang-kas-bulanan');
      if (role === 'ketua_rt_01' || role === 'ketua_rw_01') {
        await expect(page).toHaveURL(/reason=forbidden/);
        const client = accounts.get(role).client;
        const denied = await client.rpc('sync_monthly_dues_period_lifecycle');
        expect(denied.error).toBeTruthy();
        const dues = await client.from('monthly_dues_periods').select('dues_month');
        expect(dues.error === null ? dues.data.length === 0 : true).toBeTruthy();
        const cash = await client.from('monthly_dues_cash_book_summary').select('dues_month');
        expect(cash.error === null ? cash.data.length === 0 : true).toBeTruthy();
      } else {
        await expect(page.getByRole('heading', {name: 'Uang Kas Bulanan', exact: true})).toBeVisible();
        if (role === 'sekretaris') {
          await expect(page.getByText(/menunggu aktivasi pengurus/i).first()).toBeVisible();
          expect(active()).toBe(0);
          const finance = await secretary.from('monthly_dues_cash_book_summary').select('dues_month');
          expect(finance.error === null ? finance.data.length === 0 : true).toBeTruthy();
        } else {
          await expect.poll(active, {timeout: 30000}).toBe(1);
          expect(sql("select dues_month from public.monthly_dues_periods where status='active'")).toBe(currentMonth());
        }
      }
    } finally { await context.close(); }
  }
  // A later Secretary visit must not modify an already-active lifecycle or expose finance.
  const before = sql("select dues_month || ':' || status || ':' || opened_processed_at::text from public.monthly_dues_periods order by dues_month");
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email organisasi').fill(accounts.get('sekretaris').email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /Masuk ke workspace/ }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await page.goto(`/dashboard/uang-kas-bulanan?month=${currentMonth()}`);
    await expect(page.getByRole('heading', {name: 'Uang Kas Bulanan', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Saldo dan mutasi periode'})).toHaveCount(0);
    expect(sql("select dues_month || ':' || status || ':' || opened_processed_at::text from public.monthly_dues_periods order by dues_month")).toBe(before);
  } finally { await context.close(); }
});
