import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookio Agent",
  description: "MVP agent pro monitoring Bookio rezervací"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}