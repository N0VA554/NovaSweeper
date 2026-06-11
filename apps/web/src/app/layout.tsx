import type { Metadata } from "next";
import "./globals.css";
import "../styles/game.css";
import "../styles/auth.css";
import "../styles/responsive.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "NovaSweeper",
  description: "A neon nova themed MineSweeper game.",
  icons: {
    icon: [
      { url: "/nova.png", type: "image/png" }
    ],
    shortcut: "/nova.png",
    apple: "/nova.png"
  },
  openGraph: {
    title: "NovaSweeper",
    description: "A neon nova themed MineSweeper game.",
    images: ["/nova.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
