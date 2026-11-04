import type { Metadata, Viewport } from "next";
import { Caveat, DM_Serif_Display, Inter, Kaushan_Script, VT323 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif" });
const script = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const mono = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323" });

export const metadata: Metadata = {
  title: "Silicon Valley: Unicorn Simulator",
  description: "A turn-based startup strategy competition. Build a company from $1,000, hire a team, raise funding, and race to become a unicorn.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#1a1120", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${script.variable} ${hand.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
