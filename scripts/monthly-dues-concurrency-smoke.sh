#!/usr/bin/env bash
set -euo pipefail

# Run after supabase start, db reset, and pgTAP. Uses only the ephemeral CI database.
command -v psql >/dev/null 2>&1 || { echo 'psql is required' >&2; exit 1; }
eval "$(supabase status -o env)"
if [ -z "$DB_URL" ]; then echo 'Supabase CLI did not expose DB_URL' >&2; exit 1; fi

KETUA_ID='00000000-0000-4000-8000-000000000071'
MEMBER_ID='10000000-0000-4000-8000-000000000071'
IDEMPOTENCY_KEY='30000000-0000-4000-8000-000000000071'

psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q <<SQL
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values ('$KETUA_ID', 'authenticated', 'authenticated', 'koppkas-concurrency-ketua@example.test', '{"full_name":"Concurrency Ketua"}');
update public.profiles set role='ketua_pemuda', is_active=true where id='$KETUA_ID';
insert into public.members (id, full_name, created_by)
values ('$MEMBER_ID', 'Concurrency Member', '$KETUA_ID');
SQL

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

sync_sql="set role authenticated; set request.jwt.claim.sub='$KETUA_ID'; select (public.sync_monthly_dues_period_lifecycle()->>'register_count')::integer;"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "$sync_sql" > "$TMP_DIR/sync-a" &
pid_a=$!
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "$sync_sql" > "$TMP_DIR/sync-b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

sync_total=$(( $(cat "$TMP_DIR/sync-a") + $(cat "$TMP_DIR/sync-b") ))
register_count=$(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "select count(*) from public.monthly_dues where member_id='$MEMBER_ID' and dues_month=date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date;")
if [ "$sync_total" -ne 1 ] || [ "$register_count" -ne 1 ]; then
  echo "Concurrent sync failed: register_count sum=$sync_total, persisted rows=$register_count" >&2
  exit 1
fi

DUES_ID="$(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "select id from public.monthly_dues where member_id='$MEMBER_ID' and dues_month=date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date;")"
if [ -z "$DUES_ID" ]; then echo 'Concurrent sync did not create a member register' >&2; exit 1; fi
payment_sql="set role authenticated; set request.jwt.claim.sub='$KETUA_ID'; select public.record_monthly_dues_payment('$DUES_ID', 10000, '$IDEMPOTENCY_KEY', 'parallel retry test');"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "$payment_sql" > "$TMP_DIR/payment-a" &
pid_a=$!
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "$payment_sql" > "$TMP_DIR/payment-b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

payment_a="$(cat "$TMP_DIR/payment-a")"
payment_b="$(cat "$TMP_DIR/payment-b")"
payment_retry="$(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "$payment_sql")"
payment_count=$(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qAt -c "select count(*) from public.monthly_dues_payments where idempotency_key='$IDEMPOTENCY_KEY';")
if [ -z "$payment_a" ] || [ "$payment_a" != "$payment_b" ] || [ "$payment_a" != "$payment_retry" ] || [ "$payment_count" -ne 1 ]; then
  echo 'Concurrent/idempotent payment retry failed: returned IDs differ or duplicate row exists' >&2
  exit 1
fi

echo "PASS: concurrent sync created one register (counts $(cat "$TMP_DIR/sync-a"),$(cat "$TMP_DIR/sync-b")); concurrent payment retries returned one ID ($payment_a) and persisted one row."
