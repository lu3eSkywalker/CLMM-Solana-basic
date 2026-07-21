"use client";

import { useState, useMemo, useCallback } from "react";
import { useLiquidityCalculate } from "./useLiquidityCalculate";

export function LiquidityCalculatePage() {
  const {
    poolData,
    tickArrays,
    allTicks,
    loading,
    loadingTicks,
    error,
    fetched,
    fetchPool,
    fetchTicks,
    calculate,
  } = useLiquidityCalculate();

  const [poolAddress, setPoolAddress] = useState("");
  const [tickLower, setTickLower] = useState<number>(0);
  const [tickUpper, setTickUpper] = useState<number>(19);
  const [inputAmount, setInputAmount] = useState("");
  const [inputToken, setInputToken] = useState<0 | 1>(0);
  const [tickFilter, setTickFilter] = useState("");

  const result = useMemo(() => {
    return calculate(tickLower, tickUpper, inputAmount, inputToken);
  }, [tickLower, tickUpper, inputAmount, inputToken, calculate]);

  const filteredTicks = useMemo(() => {
    if (!tickFilter) return allTicks;
    const q = tickFilter.toLowerCase();
    return allTicks.filter(
      (t) =>
        t.tickIndex.toString().includes(q) ||
        t.price.toFixed(8).includes(q) ||
        t.liquidityGross.includes(q)
    );
  }, [allTicks, tickFilter]);

  const handleLoadPool = useCallback(() => {
    if (poolAddress.trim()) {
      fetchPool(poolAddress.trim());
    }
  }, [poolAddress, fetchPool]);

  const handleLoadTicks = useCallback(() => {
    if (poolAddress.trim()) {
      fetchTicks(poolAddress.trim());
    }
  }, [poolAddress, fetchTicks]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoadPool();
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const tickOptions = useMemo(() => {
    const ticks = allTicks.length > 0 ? allTicks : [];
    const options = ticks.map((t) => t.tickIndex);
    options.sort((a, b) => a - b);
    return options;
  }, [allTicks]);

  const formatPrice = (price: number) =>
    price < 0.0001 ? price.toExponential(4) : price.toFixed(6);

  const formatAmount = (amount: number) =>
    amount < 0.000001 && amount > 0 ? amount.toExponential(4) : amount.toFixed(6);

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Liquidity Calculator</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Enter a pool address to view available ticks and calculate token amounts for providing concentrated liquidity.
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Step 1: Pool Address Input */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1: Load Pool</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Pool Address
              </label>
              <input
                type="text"
                placeholder="Enter pool state PDA address..."
                value={poolAddress}
                onChange={(e) => setPoolAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <button
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
              onClick={handleLoadPool}
              disabled={loading || !poolAddress.trim()}
            >
              {loading ? "Loading..." : "Load Pool"}
            </button>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Error</p>
                <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{error}</pre>
              </div>
            )}
          </div>

          {/* Pool Info */}
          {poolData && (
            <div className="space-y-6">
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Pool Info</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <PoolField label="Token 0" value={shortAddr(poolData.tokenMint0)} />
                  <PoolField label="Token 1" value={shortAddr(poolData.tokenMint1)} />
                  <PoolField label="Current Price" value={formatPrice(poolData.price)} />
                  <PoolField label="Current Tick" value={poolData.currentTick.toString()} />
                  <PoolField label="Tick Spacing" value={poolData.tickSpacing.toString()} />
                  <PoolField label="Total Liquidity" value={poolData.liquidity.toString()} />
                  <PoolField label="Token 0 Decimals" value={poolData.tokenDecimals0.toString()} />
                  <PoolField label="Token 1 Decimals" value={poolData.tokenDecimals1.toString()} />
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                    onClick={handleLoadTicks}
                    disabled={loadingTicks}
                  >
                    {loadingTicks ? "Loading Ticks..." : "Load Available Ticks"}
                  </button>
                </div>
              </div>

              {/* Step 2: Tick Selection + Calculation */}
              {fetched && allTicks.length > 0 && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2: Select Tick Range</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Choose a lower and upper tick to define your liquidity range. Ticks shown have initialized liquidity.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Filter Ticks
                    </label>
                    <input
                      type="text"
                      placeholder="Search by tick index, price, or liquidity..."
                      value={tickFilter}
                      onChange={(e) => setTickFilter(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Lower Tick
                      </label>
                      <select
                        value={tickLower}
                        onChange={(e) => setTickLower(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      >
                        {tickOptions.map((t) => (
                          <option key={`lower-${t}`} value={t}>
                            {t} (price: {Math.pow(1.0001, t).toFixed(8)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Upper Tick
                      </label>
                      <select
                        value={tickUpper}
                        onChange={(e) => setTickUpper(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      >
                        {tickOptions.map((t) => (
                          <option key={`upper-${t}`} value={t}>
                            {t} (price: {Math.pow(1.0001, t).toFixed(8)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {tickLower >= tickUpper && (
                    <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        Lower tick must be less than upper tick.
                      </p>
                    </div>
                  )}

                  {/* Tick List */}
                  <details className="group">
                    <summary className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer select-none flex items-center gap-1.5 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                      <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      View All Available Ticks ({filteredTicks.length})
                    </summary>
                    <div className="mt-4 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Tick</th>
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Price</th>
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Liquidity Gross</th>
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Liquidity Net</th>
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredTicks.map((t) => {
                            const isLower = t.tickIndex === tickLower;
                            const isUpper = t.tickIndex === tickUpper;
                            return (
                              <tr
                                key={t.tickIndex}
                                className={isLower || isUpper ? "bg-green-50 dark:bg-green-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}
                              >
                                <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                                  <code>{t.tickIndex}</code>
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                                  <code>{t.price.toFixed(8)}</code>
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                                  <code>{t.liquidityGross}</code>
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                                  <code>{t.liquidityNet}</code>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                      onClick={() => setTickLower(t.tickIndex)}
                                      disabled={isLower}
                                    >
                                      Set Lower
                                    </button>
                                    <button
                                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                      onClick={() => setTickUpper(t.tickIndex)}
                                      disabled={isUpper}
                                    >
                                      Set Upper
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  {/* Token Amount Input */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 3: Calculate Amounts</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Enter an amount for one token and the corresponding amount for the other token will be calculated.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Input Token
                      </label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="inputToken"
                            checked={inputToken === 0}
                            onChange={() => setInputToken(0)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          />
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                            Token 0 ({shortAddr(poolData?.tokenMint0 ?? "")})
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="inputToken"
                            checked={inputToken === 1}
                            onChange={() => setInputToken(1)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          />
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                            Token 1 ({shortAddr(poolData?.tokenMint1 ?? "")})
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Amount (decimal)
                      </label>
                      <input
                        type="text"
                        placeholder={`e.g. 1.5 (1 token = ${inputToken === 0 ? 10 ** (poolData?.tokenDecimals0 ?? 9) : 10 ** (poolData?.tokenDecimals1 ?? 9)} base units)`}
                        value={inputAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || /^\d*\.?\d*$/.test(v)) setInputAmount(v);
                        }}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>

                    {/* Results */}
                    {result && (
                      <div className={`p-6 rounded-xl border ${result.inRange 
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
                        <div className={`flex items-center gap-3 mb-4 ${result.inRange ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            {result.inRange ? (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            ) : (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            )}
                          </svg>
                          <span className="font-semibold">
                            {result.inRange
                              ? "Current price is within range"
                              : "Current price is outside range"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <PoolField 
                            label="Token 0 Amount" 
                            value={result.amount0} 
                            highlight 
                          />
                          <PoolField 
                            label="Token 1 Amount" 
                            value={result.amount1} 
                            highlight 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <PoolField label="Liquidity" value={result.liquidity} />
                          <PoolField 
                            label="Price Range" 
                            value={`${formatAmount(result.priceLower)} — ${formatAmount(result.priceUpper)}`} 
                          />
                        </div>

                        {!result.inRange && (
                          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                              Note
                            </p>
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              {inputToken === 0
                                ? "Only Token 0 is needed for this range (current price below range)."
                                : "Only Token 1 is needed for this range (current price above range)."}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fetched && !loadingTicks && allTicks.length === 0 && tickArrays.length > 0 && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Tick arrays loaded but no initialized ticks found for this pool.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PoolField({ label, value, fullWidth, highlight }: { 
  label: string; 
  value: string; 
  fullWidth?: boolean; 
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "sm:col-span-6" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <code className={`text-sm font-mono ${highlight ? "text-lg" : ""} ${highlight ? "text-gray-900 dark:text-gray-100" : "text-gray-900 dark:text-gray-100"} bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all`}>
        {value}
      </code>
    </div>
  );
}