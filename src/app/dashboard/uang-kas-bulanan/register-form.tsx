"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { generateMonthlyRegister, type DuesActionState } from "./actions";
import { periodLabel } from "@/components/monthly-dues/contracts";

const initialState: DuesActionState = {};

export function RegisterForm({ duesMonth }: { duesMonth: string }) {
  const [state, action, pending] = useActionState(generateMonthlyRegister, initialState);
  return (
    <form action={action} className="register-form">
      <input type="hidden" name="dues_month" value={duesMonth} />
      <p>Periode berikutnya: <strong>{periodLabel(duesMonth)}</strong></p>
      <button type="submit" disabled={pending}><ListPlus size={16} /> {pending ? "Membuka periode..." : "Buka periode kas"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}
