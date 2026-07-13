import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "./nav";

export const metadata: Metadata = {
  title: "CLMM - Concentrated Liquidity",
  description: "Concentrated Liquidity Market Maker on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app">
            <header className="app-header">
              <h1>CLMM Pool</h1>
              <p className="subtitle">Concentrated Liquidity Market Maker</p>
            </header>
            <Nav />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
