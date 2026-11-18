import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [actions, page, controls, dualReport, finalization, approval, financeActions, financeForm, ledgerIdempotency] = await Promise.all([
  read("../src/app/dashboard/kegiatan/actions.ts"),
  read("../src/app/dashboard/kegiatan/page.tsx"),
  read("../src/app/dashboard/kegiatan/workflow-controls.tsx"),
  read("../supabase/migrations/20261118110000_event_dual_report_authorship.sql"),
  read("../supabase/migrations/20261118050000_event_finance_finalization_guards.sql"),
  read("../supabase/migrations/20261117000500_approval_guards.sql"),
  read("../src/app/dashboard/keuangan-kegiatan/actions.ts"),
  read("../src/app/dashboard/keuangan-kegiatan/entry-form.tsx"),
  read("../supabase/migrations/20261118160000_event_ledger_idempotency.sql"),
]);

test("event publication and cancellation require leadership approvals", () => {
  assert.match(actions, /requireModulePermission\("events", "approve"\)/);
  assert.match(actions, /approveEvent/);
  assert.match(actions, /cancelEvent/);
  assert.match(approval, /Only Ketua or Wakil Ketua may publish an event/);
  assert.match(approval, /Only Ketua or Wakil Ketua may cancel an event/);
});

test("designated Ketua Panitia submits narrative report and Bendahara submits separate finance report", () => {
  assert.match(actions, /submit_event_financial_report/);
  assert.match(actions, /actor\.role !== "bendahara"/);
  assert.match(actions, /event\.committee_chair_profile_id !== actor\.profile\.id/);
  assert.match(actions, /submit_event_narrative_report/);
  assert.match(dualReport, /Only the designated Ketua Panitia may submit the narrative report/);
  assert.match(dualReport, /Only Bendahara may submit the event financial report/);
  assert.match(dualReport, /new\.financial_report_by = new\.final_report_by/);
  assert.match(dualReport, /new\.final_report_by is distinct from new\.committee_chair_profile_id/);
  assert.match(dualReport, /profiles_read_active_org_accounts/);
  assert.match(dualReport, /set_event_chair_default/);
  assert.match(dualReport, /role is not null and app_private\.current_app_role\(\) is not null/);
  assert.match(dualReport, /public\.event_financial_reports/);
  assert.match(dualReport, /event_financial_reports_read_finance_roles/);
  assert.match(dualReport, /revoke insert, update, delete on public\.event_financial_reports from authenticated/);
  assert.match(dualReport, /audit_event_financial_reports/);
});

test("event final approval requires both reports and an active Bendahara author", () => {
  assert.match(dualReport, /Both event reports must be complete before final approval/);
  assert.match(dualReport, /Only the designated Ketua Panitia may submit a final report/);
  assert.match(dualReport, /Financial report author must remain an active Bendahara/);
  assert.match(actions, /approve_event_final_report/);
});

test("event reports and details are immutable during approval and after closeout", () => {
  assert.match(finalization, /old\.status in \('selesai', 'dibatalkan'\)/);
  assert.match(finalization, /new\.financial_report_by is distinct from old\.financial_report_by/);
  assert.match(finalization, /new\.final_report_submitted_at is distinct from old\.final_report_submitted_at/);
});

test("event register exposes role-aware workflow controls", () => {
  assert.match(page, /EventWorkflowControls/);
  assert.match(page, /canReadEventFinance/);
  assert.match(page, /event_financial_reports/);
  assert.match(actions, /updateEventDetails/);
  assert.match(actions, /committee_chair_profile_id: user\.profile\.id/);
  assert.match(controls, /Ketua Panitia<select name="committee_chair_profile_id"/);
  assert.match(page, /supabase\.from\("profiles"\)/);
  assert.match(actions, /addEventCommitteeMember/);
  assert.match(controls, /submitEventForApproval/);
  assert.match(controls, /approveEventFinalReport/);
  assert.match(controls, /cancelEvent/);
  assert.match(controls, /Tinjau isi laporan/);
});

test("event finance entries use idempotency keys and verify duplicate payloads", () => {
  assert.match(financeActions, /idempotency_key: idempotencyKey/);
  assert.match(financeActions, /error\?\.code === "23505"/);
  assert.match(financeActions, /existing\.created_by === user\.profile\.id/);
  assert.match(financeForm, /useRef<string \| null>\(null\)/);
  assert.match(financeForm, /crypto\.randomUUID\(\)/);
  assert.match(ledgerIdempotency, /event_ledger_entries_idempotency_key_uidx/);
});
