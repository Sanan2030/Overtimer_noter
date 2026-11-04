import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArtıSaat — Əlavə iş saatları",
  description:
    "Əlavə iş saatlarınızı qeyd edin, gəlirinizi hesablayın və Excel hesabatınızı hazırlayın.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
