"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-full max-w-2xl mx-auto mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-2">
        <div className="flex flex-wrap items-center gap-1">
          <Link
            href="/pools"
            className={`rounded-lg px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${pathname === "/pools"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            Pools
          </Link>
          <Link
            href="/create"
            className={`rounded-lg px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${pathname === "/create"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            Create Pool
          </Link>
          <Link
            href="/open-position"
            className={`rounded-lg px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${pathname === "/open-position"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            Open Position
          </Link>
          <Link
            href="/liquidity-calculate"
            className={`rounded-lg px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${pathname === "/liquidity-calculate"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            Liquidity Calculate
          </Link>
        </div>
        <div className="flex items-center">
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}