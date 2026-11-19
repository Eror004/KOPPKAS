import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261119120000_index_event_profile_foreign_keys.sql", import.meta.url),
  "utf8",
);

const expected = [
  ["event_financial_reports_submitted_by_idx", "event_financial_reports", "submitted_by"],
  ["events_committee_chair_profile_id_idx", "events", "committee_chair_profile_id"],
  ["events_final_report_by_idx", "events", "final_report_by"],
  ["events_financial_report_by_idx", "events", "financial_report_by"],
];

test("all four unindexed foreign-key columns receive supporting indexes", () => {
  for (const [index, table, column] of expected) {
    assert.match(
      migration,
      new RegExp(`create index if not exists ${index}\\s+on public\\.${table}\\s*\\(\\s*${column}\\s*\\)`, "i"),
      index,
    );
  }
});

test("foreign-key index migration is transactional and does not alter constraints or policies", () => {
  assert.match(migration, /\bbegin;/i);
  assert.match(migration, /\bcommit;/i);
  assert.doesNotMatch(migration, /drop (?:policy|constraint|table)|alter table|delete from|truncate/i);
});
