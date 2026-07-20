"use client";

import { PositionStrategy, STRATEGY_INFO } from "./types";

interface StrategySelectorProps {
  value: PositionStrategy;
  onChange: (strategy: PositionStrategy) => void;
}

export function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        Strategy
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(Object.values(PositionStrategy).filter(
          (v) => typeof v === "number"
        ) as PositionStrategy[]).map((strategy) => {
          const info = STRATEGY_INFO[strategy];
          const isSelected = value === strategy;
          return (
            <label
              key={strategy}
              className={`relative cursor-pointer flex h-full ${
                isSelected
                  ? "ring-2 ring-blue-500 dark:ring-blue-400"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="strategy"
                value={strategy}
                checked={isSelected}
                onChange={() => onChange(strategy)}
                className="sr-only peer"
              />
              <div
                className={`flex flex-col p-4 rounded-xl border-2 transition-all w-full h-full ${
                  isSelected
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-full">
                    {strategy}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {info.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
                  {info.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}