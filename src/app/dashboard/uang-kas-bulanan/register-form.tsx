"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { generateMonthlyRegister, type DuesActionState } from "./actions";

const initialState: DuesActionState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(generateMonthlyRegister, initialState);
  return (
    <form action={action} className="register-form">
      <button type="submit" disabled={pending}><ListPlus size={16} /> {pending ? "Menyiapkan daftar..." : "Buat daftar bulan ini"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}