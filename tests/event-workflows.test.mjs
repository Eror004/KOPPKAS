import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [actions, page, controls, dualReport, finalization, approval] = await Promise.all([
  read("../src/app/dashboard/kegiatan/actions.ts"),
  read("../src/app/dashboard/kegiatan/page.tsx"),
  read("../src/app/dashboard/kegiatan/workflow-controls.tsx"),
  read("../supabase/migrations/20261118110000_event_dual_report_authorship.sql"),
  read("../supabase/migrations/20261118050000_event_finance_finalization_guards.sql"),
  read("../supabase/migrations/20261117000500_approval_guards.sql"),
]);

test("event publication and cancellation require leadership approvals", () => {
  assert.match(actions, /requireModulePermission\("events", "approve"\)/);
  assert.match(actions, /approveEvent/);
  assert.match(actions, /cancelEvent/);
  assert.match(approval, /Only Ketua or Wakil Ketua may publish an event/);
  assert.match(approval, /Only Ketua or Wakil Ketua may cancel an event/);
});

test("event creator submits narrative report and Bendahara submits separate finance report", () => {
  assert.match(actions, /submit_event_financial_report/);
  assert.match(actions, /actor\.role !== "bendahara"/);
  assert.match(actions, /event\.created_by !== actor\.profile\.id/);
  assert.match(dualReport, /Only Bendahara may submit a valid event financial report/);
  assert.match(dualReport, /Only the event creator acting as Ketua Panitia may submit the narrative report/);
  assert.match(dualReport, /new\.financial_report_by = new\.final_report_by/);
});

test("event final approval requires both reports and an active Bendahara author", () => {
  assert.match(dualReport, /Both event reports must be complete before final approval/);
  assert.match(dualReport, /Financial report author must remain an active Bendahara/);
  assert.match(actions, /approve_event_final_report/);
});

test("event reports and details are immutable during approval and after closeout", () => {
  assert.match(finalization, /old\.status in \('selesai', 'dibatalkan'\)/);
  assert.match(finalization, /new\.financial_report is distinct from old\.financial_report/);
  assert.match(finalization, /new\.final_report_submitted_at is distinct from old\.final_report_submitted_at/);
});

test("event register exposes role-aware workflow controls", () => {
  assert.match(page, /EventWorkflowControls/);
  assert.match(controls, /submitEventForApproval/);
  assert.match(controls, /approveEventFinalReport/);
  assert.match(controls, /cancelEvent/);
  assert.match(controls, /Tinjau isi laporan/);
});
