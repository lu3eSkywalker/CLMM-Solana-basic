"use client";

import {
  PositionData,
  PositionStrategy,
  BaseRange,
  hasBaseRange,
  tickToPrice,
} from "./types";

interface SummaryPanelProps {
  strategy: PositionStrategy;
  positions: PositionData[];
  baseRange: BaseRange;
  poolAddress: string;
}

export function SummaryPanel({
  strategy,
  positions,
  baseRange,
  poolAddress,
}: SummaryPanelProps) {
  const totalLiquidity = positions.reduce((sum, p) => {
    const val = parseFloat(p.liquidity);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const validPositions = positions.filter(
    (p) => p.tickLower < p.tickUpper && parseFloat(p.liquidity) > 0
  );

  const positionsToMint =
    strategy === PositionStrategy.SINGLE_BASE
      ? 1
      : strategy === PositionStrategy.SINGLE_BASE_OVERLAP
        ? 1 + validPositions.length
        : validPositions.length;

  const showBase = hasBaseRange(strategy);
  const baseLowerPrice = tickToPrice(baseRange.tickLower).toFixed(6);
  const baseUpperPrice = tickToPrice(baseRange.tickUpper).toFixed(6);

  const strategyLabels: Record<number, string> = {
    1: "Single Base",
    2: "Base + Sub-Positions",
    3: "Independent",
    4: "Independent + Overlaps",
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Transaction Summary
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Strategy
          </span>
          <span className="text-base font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            {strategyLabels[strategy] || "Unknown"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Positions to Mint
          </span>
          <span className="text-base font-bold text-gray-900 dark:text-gray-100 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 rounded-lg text-green-700 dark:text-green-300">
            {positionsToMint}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Total Liquidity
          </span>
          <span className="text-base font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            {totalLiquidity > 0
              ? totalLiquidity.toLocaleString()
              : "—"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Valid Ranges
          </span>
          <span className="text-base font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            {validPositions.length} / {positions.length}
          </span>
        </div>
        {showBase && (
          <>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Base Range (Ticks)
              </span>
              <span className="text-base font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                [{baseRange.tickLower}, {baseRange.tickUpper}]
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Base Range (Price)
              </span>
              <span className="text-base font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                [{baseLowerPrice}, {baseUpperPrice}]
              </span>
            </div>
          </>
        )}
        {poolAddress && (
          <div className="sm:col-span-2 flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Pool Address
            </span>
            <span className="text-xs font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 break-all">
              {poolAddress}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}