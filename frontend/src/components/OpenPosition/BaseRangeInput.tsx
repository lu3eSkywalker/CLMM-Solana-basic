"use client";

import { BaseRange, tickToPrice } from "./types";

interface BaseRangeInputProps {
  value: BaseRange;
  onChange: (range: BaseRange) => void;
}

export function BaseRangeInput({ value, onChange }: BaseRangeInputProps) {
  const lowerPrice = tickToPrice(value.tickLower).toFixed(6);
  const upperPrice = tickToPrice(value.tickUpper).toFixed(6);

  return (
    <div className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded">
          Base
        </span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          Base Range
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Min Tick
          </label>
          <input
            type="number"
            value={value.tickLower}
            onChange={(e) => {
              const tick = parseInt(e.target.value) || 0;
              onChange({ ...value, tickLower: tick });
            }}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
            Price: {lowerPrice}
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Max Tick
          </label>
          <input
            type="number"
            value={value.tickUpper}
            onChange={(e) => {
              const tick = parseInt(e.target.value) || 0;
              onChange({ ...value, tickUpper: tick });
            }}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
            Price: {upperPrice}
          </p>
        </div>
      </div>
    </div>
  );
}