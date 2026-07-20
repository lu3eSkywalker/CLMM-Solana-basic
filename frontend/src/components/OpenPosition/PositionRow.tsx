"use client";

import { PositionData, tickToPrice } from "./types";

interface PositionRowProps {
  position: PositionData;
  index: number;
  hasOverlap: boolean;
  canRemove: boolean;
  onUpdate: (id: string, updates: Partial<PositionData>) => void;
  onRemove: (id: string) => void;
}

export function PositionRow({
  position,
  index,
  hasOverlap,
  canRemove,
  onUpdate,
  onRemove,
}: PositionRowProps) {
  const lowerPrice = tickToPrice(position.tickLower).toFixed(6);
  const upperPrice = tickToPrice(position.tickUpper).toFixed(6);

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        hasOverlap
          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Position {index + 1}
          </span>
          {hasOverlap && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
              OVERLAP
            </span>
          )}
        </div>
        {canRemove && (
          <button
            onClick={() => onRemove(position.id)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            aria-label="Remove position"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Min Tick
          </label>
          <input
            type="number"
            value={position.tickLower}
            onChange={(e) =>
              onUpdate(position.id, {
                tickLower: parseInt(e.target.value) || 0,
              })
            }
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {lowerPrice}
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Max Tick
          </label>
          <input
            type="number"
            value={position.tickUpper}
            onChange={(e) =>
              onUpdate(position.id, {
                tickUpper: parseInt(e.target.value) || 0,
              })
            }
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {upperPrice}
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Liquidity
          </label>
          <input
            type="text"
            placeholder="e.g. 1000000"
            value={position.liquidity}
            onChange={(e) =>
              onUpdate(position.id, { liquidity: e.target.value })
            }
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Range
          </label>
          <input
            type="text"
            readOnly
            value={`${position.tickLower} → ${position.tickUpper}`}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 text-sm font-mono outline-none cursor-default"
          />
        </div>
      </div>
    </div>
  );
}