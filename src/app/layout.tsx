import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/ui/SiteHeader";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quarterly Calendar Explorer (DEV)",
  description: "Browse and register for quarterly training sessions — CalendarProject_v1 prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col text-gray-900 antialiased">
        <SiteHeader />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          {children}
        </main>
        <footer className="border-t border-white/60 bg-[linear-gradient(90deg,rgba(58,42,161,0.96),rgba(40,118,181,0.94),rgba(78,184,215,0.92))] py-4 text-center text-xs text-white/90 shadow-[0_-10px_30px_rgba(17,32,59,0.08)]">
          CalendarProject_v1 · DEV Prototype · Phase 1 · Local browser data only
        </footer>
      </body>
    </html>
  );
}
