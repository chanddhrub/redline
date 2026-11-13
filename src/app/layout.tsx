import type { Metadata } from "next";
import { Geist, Tinos } from "next/font/google";
import "./globals.css";

// Redline's own voice: one confident grotesque, heavy at display sizes and
// plain at reading sizes. The contract keeps its own face (Tinos).
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// The document's own words are set the way the document sets them.
const tinos = Tinos({
  variable: "--font-tinos",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Redline — read the offer letter before you sign it",
  description:
    "Upload an offer letter, non-compete or IP assignment before you sign. Every clause Redline flags shows the exact sentence it came from, so you can check every claim against your own contract.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${tinos.variable} ${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
