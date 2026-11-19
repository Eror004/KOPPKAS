import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [duesWorkflow, inlineMember, dualReports, narrativeGuard] = await Promise.all([
  read("../supabase/migrations/20261118033844_dues_and_event_workflows.sql"),
  read("../supabase/migrations/20261118033855_inline_dues_member_and_letter_submit.sql"),
  read("../supabase/migrations/20261118074613_event_dual_report_authorship.sql"),
  read("../supabase/migrations/20261118075210_event_narrative_active_actor_guard.sql"),
]);

function functionSql(source, name) {
  const start = source.search(new RegExp(`create or replace function public\\.${name}\\b`, "i"));
  if (start < 0) return "";
  const tail = source.slice(start);
  const end = tail.search(/\n\$(?:function|submit_narrative)?\$;/i);
  return end < 0 ? "" : tail.slice(0, end + tail.slice(end).match(/^\n\$[^\n]*\$;/)?.[0].length);
}

const rpcDefinitions = [
  ["create_member_for_dues", duesWorkflow],
  ["record_monthly_dues_payment", duesWorkflow],
  ["approve_event_final_report", duesWorkflow],
  ["create_member_and_monthly_dues", inlineMember],
  ["submit_event_financial_report", dualReports],
  ["submit_event_narrative_report", narrativeGuard],
];

test("public SECURITY DEFINER RPCs pin search_path and require an authenticated actor", () => {
  for (const [name, source] of rpcDefinitions) {
    const sql = functionSql(source, name);
    assert.ok(sql, `missing SQL definition for ${name}`);
    assert.match(sql, /security definer/i, name);
    assert.match(sql, /set search_path = ''/i, name);
    assert.match(sql, /if auth\.uid\(\) is null then/i, name);
  }
});

test("monthly-dues RPCs validate the caller's organization role and input bounds", () => {
  for (const name of ["create_member_for_dues", "record_monthly_dues_payment"]) {
    const sql = functionSql(duesWorkflow, name);
    assert.match(sql, /app_private\.has_any_role\(/i, name);
    assert.match(sql, /errcode = '42501'/i, name);
  }
  const atomicMember = functionSql(inlineMember, "create_member_and_monthly_dues");
  assert.match(atomicMember, /app_private\.has_any_role\(/i);
  assert.match(atomicMember, /p_dues_month is null/i);
  assert.match(atomicMember, /reference_amount\)\s+values\s+\(new_member_id, p_dues_month, 10000\)/i);
  const payment = functionSql(duesWorkflow, "record_monthly_dues_payment");
  assert.match(payment, /p_amount is null or p_amount <= 0/i);
  assert.match(payment, /p_idempotency_key is null/i);
});

test("event closeout RPCs enforce approver or designated-author identity and event state", () => {
  const approval = functionSql(duesWorkflow, "approve_event_final_report");
  assert.match(approval, /app_private\.has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda','bendahara'\]/i);
  assert.match(approval, /for update/i);
  assert.match(approval, /target_event\.status <> 'menunggu_laporan'/i);

  const finance = functionSql(dualReports, "submit_event_financial_report");
  assert.match(finance, /role_now is distinct from 'bendahara'/i);
  assert.match(finance, /target_status <> 'berlangsung'/i);
  assert.match(finance, /for update/i);

  const narrative = functionSql(narrativeGuard, "submit_event_narrative_report");
  assert.match(narrative, /role_now is null/i);
  assert.match(narrative, /target_chair is distinct from auth\.uid\(\)/i);
  assert.match(narrative, /finance_author is null or finance_author = auth\.uid\(\)/i);
  assert.match(narrative, /for update/i);
});

test("authenticated RPC exposure is explicit and public or anonymous execution is revoked", () => {
  const grants = [
    [duesWorkflow, "create_member_for_dues", "text"],
    [duesWorkflow, "record_monthly_dues_payment", "uuid,numeric,uuid,text"],
    [duesWorkflow, "approve_event_final_report", "uuid"],
    [inlineMember, "create_member_and_monthly_dues", "text,date"],
    [dualReports, "submit_event_financial_report", "uuid, text"],
    [dualReports, "submit_event_narrative_report", "uuid, text"],
  ];
  for (const [source, name, signature] of grants) {
    assert.match(source, new RegExp(`revoke all on function public\\.${name}\\(${signature.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\) from public, anon`, "i"), name);
    assert.match(source, new RegExp(`grant execute on function public\\.${name}\\(${signature.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\) to authenticated`, "i"), name);
  }
});
