"use client";

import dynamic from "next/dynamic";

const LiquidityCalculatePage = dynamic(
  () =>
    import("@/components/LiquidityCalculate/LiquidityCalculatePage").then(
      (mod) => mod.LiquidityCalculatePage
    ),
  { ssr: false }
);

export default function LiquidityCalculateRoute() {
  return <LiquidityCalculatePage />;
}
