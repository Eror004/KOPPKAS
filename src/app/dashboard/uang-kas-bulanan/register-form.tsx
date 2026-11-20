"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { generateMonthlyRegister, type DuesActionState } from "./actions";
import { formatMonth } from "@/lib/finance/format";

const initialState: DuesActionState = {};

export function RegisterForm({ nextMonth }: { nextMonth: string }) {
  const [state, action, pending] = useActionState(generateMonthlyRegister, initialState);
  return (
    <form action={action} className="register-form">
      <input type="hidden" name="dues_month" value={nextMonth} />
      <p>Periode berikutnya: <strong>{formatMonth(nextMonth)}</strong>. Periode dibuka satu per satu oleh pengurus.</p>
      <button type="submit" disabled={pending}><ListPlus size={16} /> {pending ? "Membuka periode..." : "Buka periode berikutnya"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}
