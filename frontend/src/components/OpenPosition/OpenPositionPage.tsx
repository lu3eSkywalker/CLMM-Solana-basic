"use client";

import { useState, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  PositionStrategy,
  PositionData,
  BaseRange,
  createPosition,
  hasBaseRange,
} from "./types";
import { StrategySelector } from "./StrategySelector";
import { BaseRangeInput } from "./BaseRangeInput";
import { PositionList } from "./PositionList";
import { PriceAxis } from "./OverlapIndicator";
import { SummaryPanel } from "./SummaryPanel";
import { useOpenPosition } from "./useOpenPosition";

export function OpenPositionPage() {
  const wallet = useAnchorWallet();

  const [strategy, setStrategy] = useState<PositionStrategy>(
    PositionStrategy.SINGLE_BASE
  );
  const [poolAddress, setPoolAddress] = useState("");
  const [baseRange, setBaseRange] = useState<BaseRange>({
    tickLower: -1,
    tickUpper: 59,
  });
  const [positions, setPositions] = useState<PositionData[]>([
    createPosition(0, 19, "10000000"),
  ]);

  const handleStrategyChange = useCallback(
    (newStrategy: PositionStrategy) => {
      setStrategy(newStrategy);
      if (!hasBaseRange(newStrategy)) {
        setPositions((prev) =>
          prev.length > 0
            ? prev
            : [createPosition(0, 19, "10000000")]
        );
      }
    },
    []
  );

  const handleAddPosition = useCallback(() => {
    const lastPos = positions[positions.length - 1];
    const newLower = lastPos ? lastPos.tickUpper : 0;
    const newUpper = newLower + 19;
    setPositions((prev) => [...prev, createPosition(newLower, newUpper, "")]);
  }, [positions]);

  const handleRemovePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleUpdatePosition = useCallback(
    (id: string, updates: Partial<PositionData>) => {
      setPositions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    },
    []
  );

  const minPositions =
    strategy === PositionStrategy.SINGLE_BASE ||
    strategy === PositionStrategy.SINGLE_BASE_OVERLAP
      ? 1
      : 2;

  const { submit, isSubmitting, error, txSignature, validationError } =
    useOpenPosition({
      strategy,
      poolAddress,
      baseRange,
      positions,
    });

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Open Position
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Create concentrated liquidity positions on a CLMM pool.
          </p>
        </div>

        <div className="p-8 space-y-8">
          <StrategySelector value={strategy} onChange={handleStrategyChange} />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Pool Address
            </label>
            <input
              type="text"
              placeholder="Enter pool state PDA address"
              value={poolAddress}
              onChange={(e) => setPoolAddress(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {hasBaseRange(strategy) && (
            <BaseRangeInput value={baseRange} onChange={setBaseRange} />
          )}

          <PositionList
            positions={positions}
            minCount={minPositions}
            onUpdate={handleUpdatePosition}
            onRemove={handleRemovePosition}
            onAdd={handleAddPosition}
          />

          <PriceAxis
            positions={positions}
            baseRange={hasBaseRange(strategy) ? baseRange : null}
            strategy={strategy}
          />

          <SummaryPanel
            strategy={strategy}
            positions={positions}
            baseRange={baseRange}
            poolAddress={poolAddress}
          />

          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              className="w-full px-6 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
              onClick={submit}
              disabled={isSubmitting || !wallet || !!validationError}
            >
              {isSubmitting
                ? "Submitting..."
                : validationError
                ? validationError
                : "Open Position(s)"}
            </button>

            {!wallet && (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                Connect your wallet to open positions
              </p>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {error}
                </pre>
              </div>
            )}

            {txSignature && (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <pre className="text-xs text-green-700 dark:text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {`Position(s) opened successfully!\n\nTx: ${txSignature}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}