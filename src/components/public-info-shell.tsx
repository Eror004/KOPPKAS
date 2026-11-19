import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PublicInfoShell({
  eyebrow,
  title,
  accent,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main className="contact-shell">
      <header className="contact-header">
        <Link href="/"><ArrowLeft size={16} /> KOPPKAS</Link>
        <span>PUBLIC INFORMATION</span>
      </header>
      <section className="contact-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}<br /><span>{accent}</span></h1>
        <p className="contact-lead">{lead}</p>
        {children}
      </section>
      <footer className="contact-footer">KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM · RT 01 / RW 01</footer>
    </main>
  );
}
