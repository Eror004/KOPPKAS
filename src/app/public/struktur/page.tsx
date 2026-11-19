import { PublicInfoShell } from "@/components/public-info-shell";

export default function PublicStructurePage() {
  return (
    <PublicInfoShell
      eyebrow="ORGANIZATION STRUCTURE"
      title="Struktur"
      accent="Organisasi."
      lead="Informasi susunan pengurus akan ditampilkan setelah ditetapkan untuk publikasi."
    >
      <section className="public-info-panel">
        <p className="eyebrow">PUBLIKASI STRUKTUR</p>
        <h2>Belum diterbitkan.</h2>
        <p>Data jabatan dan identitas pengurus yang bersifat internal tidak otomatis ditampilkan di website publik. Pengurus perlu menerbitkan susunan yang telah disetujui terlebih dahulu.</p>
      </section>
    </PublicInfoShell>
  );
}
