import { PublicInfoShell } from "@/components/public-info-shell";

export default function PublicTransparencyPage() {
  return (
    <PublicInfoShell
      eyebrow="PUBLIC ACCOUNTABILITY"
      title="Transparansi"
      accent="Organisasi."
      lead="Informasi pertanggungjawaban yang telah disetujui khusus untuk publikasi."
    >
      <section className="public-info-panel">
        <p className="eyebrow">LAPORAN PUBLIK</p>
        <h2>Belum ada laporan yang diterbitkan.</h2>
        <p>Data keuangan internal, transaksi, dan identitas anggota tidak otomatis ditampilkan di website. Informasi transparansi hanya akan muncul setelah melalui pemeriksaan dan persetujuan publikasi oleh pengurus.</p>
      </section>
    </PublicInfoShell>
  );
}
