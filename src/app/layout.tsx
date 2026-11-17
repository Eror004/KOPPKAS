import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "KOPPKAS — Ruang Kerja Organisasi",
  description: "Pusat kendali organisasi Pemuda Kampung Sawah Kaum.",
  applicationName: "KOPPKAS",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0876B9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><PwaRegister />{children}</body>
    </html>
  );
}