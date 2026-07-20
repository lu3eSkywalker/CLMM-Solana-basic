export enum PositionStrategy {
  SINGLE_BASE = 1,
  SINGLE_BASE_OVERLAP = 2,
  MULTI_INDEPENDENT = 3,
  MULTI_INDEPENDENT_OVERLAP = 4,
}

export interface PositionData {
  id: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
}

export interface BaseRange {
  tickLower: number;
  tickUpper: number;
}

export interface OpenPositionState {
  strategy: PositionStrategy;
  poolAddress: string;
  baseRange: BaseRange;
  positions: PositionData[];
}

export const TICK_SPACING = 1;
export const TICK_ARRAY_SIZE = 60;
export const TICKS_PER_ARRAY = TICK_ARRAY_SIZE * TICK_SPACING;

export const STRATEGY_INFO: Record<
  PositionStrategy,
  { label: string; description: string; hasBase: boolean }
> = {
  [PositionStrategy.SINGLE_BASE]: {
    label: "Single Base",
    description: "One wide continuous range",
    hasBase: true,
  },
  [PositionStrategy.SINGLE_BASE_OVERLAP]: {
    label: "Base + Sub-Positions",
    description: "Base range with overlapping sub-positions inside",
    hasBase: true,
  },
  [PositionStrategy.MULTI_INDEPENDENT]: {
    label: "Independent Positions",
    description: "Multiple standalone positions, no base range",
    hasBase: false,
  },
  [PositionStrategy.MULTI_INDEPENDENT_OVERLAP]: {
    label: "Independent + Overlaps",
    description: "Standalone positions that may overlap each other",
    hasBase: false,
  },
};

export function hasBaseRange(strategy: PositionStrategy): boolean {
  return (
    strategy === PositionStrategy.SINGLE_BASE ||
    strategy === PositionStrategy.SINGLE_BASE_OVERLAP
  );
}

export function allowsOverlap(strategy: PositionStrategy): boolean {
  return (
    strategy === PositionStrategy.SINGLE_BASE_OVERLAP ||
    strategy === PositionStrategy.MULTI_INDEPENDENT_OVERLAP
  );
}

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

export function priceToTick(price: number): number {
  return Math.round(Math.log(price) / Math.log(1.0001));
}

export function tickArrayStartIndex(tick: number): number {
  return Math.floor(tick / TICKS_PER_ARRAY) * TICKS_PER_ARRAY;
}

export function getOverlappingRanges(
  positions: PositionData[]
): Set<string> {
  const overlaps = new Set<string>();
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      if (a.tickLower < b.tickUpper && b.tickLower < a.tickUpper) {
        overlaps.add(a.id);
        overlaps.add(b.id);
      }
    }
  }
  return overlaps;
}

export function computeOverlapRegions(
  positions: PositionData[]
): Array<{ start: number; end: number; count: number }> {
  if (positions.length < 2) return [];

  const events: Array<{ tick: number; delta: number }> = [];
  for (const pos of positions) {
    events.push({ tick: pos.tickLower, delta: 1 });
    events.push({ tick: pos.tickUpper, delta: -1 });
  }
  events.sort((a, b) => a.tick - b.tick || a.delta - b.delta);

  const regions: Array<{ start: number; end: number; count: number }> = [];
  let active = 0;
  let regionStart = 0;

  for (const event of events) {
    if (event.delta > 0) {
      if (active >= 1) {
        regionStart = event.tick;
      }
      active += event.delta;
    } else {
      active += event.delta;
      if (active >= 1) {
        regions.push({ start: regionStart, end: event.tick, count: active });
      }
    }
  }

  return regions;
}

let _nextId = 1;
export function createPosition(
  tickLower: number = 0,
  tickUpper: number = 19,
  liquidity: string = ""
): PositionData {
  return {
    id: `pos-${_nextId++}`,
    tickLower,
    tickUpper,
    liquidity,
  };
}

export const DEFAULT_POSITIONS: PositionData[] = [
  createPosition(0, 19),
];
