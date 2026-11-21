"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { syncMonthlyDuesLifecycle } from "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action";

// Share in-flight work and briefly suppress completed duplicates for the same actor.
// A later visit or a WIB month boundary can still trigger lifecycle synchronization.
const pendingByActor = new Map<string, Promise<Awaited<ReturnType<typeof syncMonthlyDuesLifecycle>>>>();
const recentByActor = new Map<string, { at: number; month: string; refreshed: boolean }>();
// Explicit database authorization failures must not be retried automatically on remount.
// A full reload obtains a fresh server-authorized session before trying again.
const deniedActors = new Set<string>();
const SYNC_TIMEOUT_MS = 30000;
const REMOUNT_GRACE_MS = 5000;
const wibMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
function syncOnce(actorId: string): { request: Promise<Awaited<ReturnType<typeof syncMonthlyDuesLifecycle>>>; cached: boolean } {
  if (deniedActors.has(actorId)) return { request: Promise.resolve({ ok: false, reason: "denied", error: "Akses sinkronisasi ditolak." }), cached: true };
  const pending = pendingByActor.get(actorId);
  if (pending) return { request: pending, cached: false };
  const recent = recentByActor.get(actorId);
  const age = recent ? Date.now() - recent.at : -1;
  if (recent && age >= 0 && age < REMOUNT_GRACE_MS && recent.month === wibMonth()) {
    return { request: Promise.resolve({ ok: true }), cached: true };
  }
  recentByActor.delete(actorId);
  const startedMonth = wibMonth();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Sync outcome unconfirmed")), SYNC_TIMEOUT_MS);
  });
  const request = Promise.race([Promise.resolve().then(() => syncMonthlyDuesLifecycle()), timeout]).then(result => {
    if (result.ok && startedMonth === wibMonth()) recentByActor.set(actorId, { at: Date.now(), month: startedMonth, refreshed: false });
    if (!result.ok && result.reason === "denied") deniedActors.add(actorId);
    return result;
  }).finally(() => {
    clearTimeout(timer);
    if (pendingByActor.get(actorId) === request) pendingByActor.delete(actorId);
  });
  pendingByActor.set(actorId, request);
  return { request, cached: false };
}

/** Runs after mount only. The RPC remains responsible for cross-request idempotence. */
export function LifecycleSync({ actorId }: { actorId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [state, setState] = useState<"loading" | "error" | "denied" | "done">("loading");

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("loading");
    try {
      const { request } = syncOnce(actorId);
      const result = await request;
      if (!mounted.current) return;
      if (!result.ok) { setState(result.reason === "denied" ? "denied" : "error"); return; }
      setState("done");
      const recent = recentByActor.get(actorId);
      if (!recent?.refreshed) {
        if (recent) recent.refreshed = true;
        router.refresh();
      }
    } catch {
      if (mounted.current) setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [router, actorId]);

  useEffect(() => {
    mounted.current = true;
    if (!started.current) { started.current = true; void run(); }
    return () => { mounted.current = false; };
  }, [run]);

  if (state === "done") return null;
  return <section className="bank-panel" aria-live="polite">
    {state === "loading" ? <p role="status">Menyinkronkan periode…</p> : state === "denied" ?
      <p role="alert">Akses sinkronisasi ditolak. Hubungi pengurus atau masuk kembali; data yang tampil hanya hasil pembacaan terakhir.</p> : <>
      <p role="alert">Sinkronisasi periode belum terkonfirmasi. Data yang tampil hanya hasil pembacaan terakhir.</p>
      <button type="button" onClick={() => void run()}>Coba sinkronisasi lagi</button>
    </>}
  </section>;
}
