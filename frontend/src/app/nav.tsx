"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="nav">
        <Link
          href="/pools"
          className={`nav-link ${pathname === "/pools" ? "active" : ""}`}
        >
          Pools
        </Link>
        <div className="nav-wallet">
          <WalletMultiButton />
        </div>
      </nav>
    </>
  );
}
