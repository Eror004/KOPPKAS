import Link from "next/link";
import { ArrowLeft, Command } from "lucide-react";

export function ModuleShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="module-shell">
      <header className="module-shell-header">
        <Link href="/" className="module-shell-brand"><span><Command size={17} /></span><strong>KOPPKAS</strong></Link>
        <div className="module-shell-current">WORKSPACE <span>/</span> {title.toUpperCase()}</div>
        <Link href="/" className="module-shell-back"><ArrowLeft size={15} /> Dashboard</Link>
      </header>
      {children}
      <footer className="module-shell-footer">© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</footer>
    </div>
  );
}