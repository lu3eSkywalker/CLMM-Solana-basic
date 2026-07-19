import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "./nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CLMM - Concentrated Liquidity Market Maker",
  description: "Concentrated Liquidity Market Maker on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Providers>
          <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
            <header className="text-center mb-10">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
                CLMM Pool
              </h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
                Concentrated Liquidity Market Maker on Solana
              </p>
            </header>
            <Nav />
            <main className="w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}