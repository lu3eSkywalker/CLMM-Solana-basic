"use client";

import {
  PositionData,
  BaseRange,
  tickToPrice,
  hasBaseRange,
  PositionStrategy,
  computeOverlapRegions,
} from "./types";

interface PriceAxisProps {
  positions: PositionData[];
  baseRange: BaseRange | null;
  strategy: PositionStrategy;
}

const COLORS = [
  "#6c5ce7",
  "#00cec9",
  "#fd79a8",
  "#fdcb6e",
  "#55efc4",
  "#a29bfe",
  "#fab1a0",
  "#74b9ff",
  "#e17055",
  "#00b894",
];

const OVERLAP_COLOR = "#e67e22";

export function PriceAxis({
  positions,
  baseRange,
  strategy,
}: PriceAxisProps) {
  if (positions.length === 0) return null;

  const showBase = hasBaseRange(strategy) && baseRange !== null;
  const allTicks = positions.map((p) => [p.tickLower, p.tickUpper]).flat();
  if (showBase && baseRange) {
    allTicks.push(baseRange.tickLower, baseRange.tickUpper);
  }

  const minTick = Math.min(...allTicks);
  const maxTick = Math.max(...allTicks);
  const range = maxTick - minTick || 1;
  const padding = range * 0.1;
  const axisMin = minTick - padding;
  const axisMax = maxTick + padding;
  const axisRange = axisMax - axisMin;

  const svgWidth = 540;
  const rowHeight = 28;
  const baseRowHeight = showBase ? rowHeight + 4 : 0;
  const overlapRegions = computeOverlapRegions(positions);
  const totalHeight =
    (showBase ? baseRowHeight : 0) +
    positions.length * rowHeight +
    40;

  const tickToX = (tick: number) =>
    ((tick - axisMin) / axisRange) * (svgWidth - 40) + 20;

  const overlapRanges = computeOverlapRegions(
    positions.map((p) => ({ ...p, liquidity: "1" }))
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Price Range Visualization
      </h3>
      <div className="overflow-x-auto">
        <svg
          className="price-axis-svg"
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          style={{ height: totalHeight, width: "100%" }}
        >
          {/* Axis line */}
          <line
            x1={20}
            y1={totalHeight - 16}
            x2={svgWidth - 20}
            y2={totalHeight - 16}
            stroke="#2a2a3a"
            strokeWidth={1}
          />

          {/* Tick labels */}
          {Array.from({ length: 7 }).map((_, i) => {
            const tick = axisMin + (axisRange * i) / 6;
            const x = tickToX(tick);
            const price = tickToPrice(tick);
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={x}
                  y1={totalHeight - 20}
                  x2={x}
                  y2={totalHeight - 12}
                  stroke="#2a2a3a"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={totalHeight - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#666"
                  fontFamily="SF Mono, Fira Code, monospace"
                >
                  {tickToPrice(tick) >= 1000
                    ? price.toFixed(0)
                    : price >= 1
                      ? price.toFixed(2)
                      : price.toFixed(4)}
                </text>
              </g>
            );
          })}

          {/* Base range bar */}
          {showBase && baseRange && (
            <g>
              <rect
                x={tickToX(baseRange.tickLower)}
                y={2}
                width={Math.max(
                  2,
                  tickToX(baseRange.tickUpper) - tickToX(baseRange.tickLower)
                )}
                height={rowHeight - 2}
                rx={4}
                fill="#6c5ce722"
                stroke="#6c5ce7"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <text
                x={tickToX(baseRange.tickLower) - 4}
                y={rowHeight / 2 + 6}
                textAnchor="end"
                fontSize={9}
                fill="#6c5ce7"
                fontWeight={600}
                fontFamily="SF Mono, Fira Code, monospace"
              >
                Base
              </text>
            </g>
          )}

          {/* Overlap regions (shaded background) */}
          {overlapRanges.map((region, i) => (
            <rect
              key={`overlap-bg-${i}`}
              x={tickToX(region.start)}
              y={showBase ? baseRowHeight : 0}
              width={Math.max(
                2,
                tickToX(region.end) - tickToX(region.start)
              )}
              height={positions.length * rowHeight}
              fill={OVERLAP_COLOR}
              opacity={0.08}
            />
          ))}

          {/* Position bars */}
          {positions.map((pos, i) => {
            const y = (showBase ? baseRowHeight : 0) + i * rowHeight + 4;
            const x1 = tickToX(pos.tickLower);
            const x2 = tickToX(pos.tickUpper);
            const color = COLORS[i % COLORS.length];
            const isOverlapping = overlapRanges.some(
              (r) => pos.tickLower < r.end && pos.tickUpper > r.start
            );

            return (
              <g key={pos.id}>
                <rect
                  x={x1}
                  y={y}
                  width={Math.max(2, x2 - x1)}
                  height={rowHeight - 8}
                  rx={4}
                  fill={isOverlapping ? `${OVERLAP_COLOR}44` : `${color}44`}
                  stroke={isOverlapping ? OVERLAP_COLOR : color}
                  strokeWidth={1.5}
                />
                <text
                  x={x1 - 4}
                  y={y + (rowHeight - 8) / 2 + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill={isOverlapping ? OVERLAP_COLOR : color}
                  fontWeight={600}
                  fontFamily="SF Mono, Fira Code, monospace"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Overlap annotations */}
          {overlapRanges.map((region, i) => {
            const x = tickToX((region.start + region.end) / 2);
            return (
              <text
                key={`overlap-label-${i}`}
                x={x}
                y={showBase ? baseRowHeight - 2 : 0}
                textAnchor="middle"
                fontSize={8}
                fill={OVERLAP_COLOR}
                fontWeight={600}
                dy={-3}
              >
                {region.count}x overlap
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}