"use client";

import { useActionState } from "react";
import { ArrowRight, Command, LockKeyhole } from "lucide-react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <main className="login-shell">
      <section className="login-aside">
        <div className="login-brand"><span><Command size={22} /></span><strong>KOPPKAS</strong></div>
        <div className="login-message">
          <p className="eyebrow">PEMUDA KAMPUNG SAWAH KAUM</p>
          <h1>Kerja bersama.<br /><em>Terorganisasi.</em></h1>
          <p>Satu ruang kerja untuk menjaga organisasi tetap terarah, transparan, dan saling terhubung.</p>
        </div>
        <span className="login-aside-foot">ORGANIZATION WORKSPACE · RT 01 / RW 01</span>
      </section>
      <section className="login-main">
        <form action={action} className="login-form">
          <div className="login-lock"><LockKeyhole size={21} /></div>
          <p className="eyebrow">SECURE ACCESS</p>
          <h2>Selamat datang.</h2>
          <p className="login-intro">Masuk menggunakan akun pengurus yang telah didaftarkan administrator.</p>
          <label>Email organisasi<input type="email" name="email" autoComplete="username" required placeholder="nama@organisasi.id" /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" minLength={5} required placeholder="Minimal 5 karakter" /></label>
          {state.error && <p className="login-error" role="alert">{state.error}</p>}
          <button type="submit" disabled={pending}>{pending ? "Memeriksa akses..." : "Masuk ke workspace"} <ArrowRight size={17} /></button>
          <p className="login-foot">Akses hanya untuk enam jabatan pengurus terdaftar.</p>
        </form>
      </section>
    </main>
  );
}
