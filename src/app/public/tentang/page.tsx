import { PublicInfoShell } from "@/components/public-info-shell";

export default function AboutPage() {
  return (
    <PublicInfoShell
      eyebrow="TENTANG ORGANISASI"
      title="Mengenal"
      accent="KOPPKAS."
      lead="Ruang informasi dan koordinasi resmi Pemuda Kampung Sawah Kaum, RT 01 / RW 01."
    >
      <section className="public-info-panel">
        <p className="eyebrow">VISI ORGANISASI</p>
        <h2>Mewujudkan generasi muda yang bersatu dan berdaya.</h2>
        <p>Mewujudkan generasi muda yang bersatu, berdaya, kreatif, dan bertanggung jawab melalui organisasi yang solid dan profesional, serta berperan aktif dalam membangun masyarakat yang harmonis, peduli, dan berkemajuan.</p>
      </section>
    </PublicInfoShell>
  );
}
