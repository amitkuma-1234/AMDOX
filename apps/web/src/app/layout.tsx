import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AMDOX | Intelligent Document Platform",
  description:
    "AMDOX — AI-powered document intelligence platform for enterprise workflows.",
  keywords: ["documents", "AI", "enterprise", "automation", "intelligence"],
  authors: [{ name: "AMDOX Team" }],
  openGraph: {
    title: "AMDOX | Intelligent Document Platform",
    description: "AI-powered document intelligence for enterprise workflows.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
