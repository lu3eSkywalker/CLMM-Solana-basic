"use client";

import { PositionData, getOverlappingRanges } from "./types";
import { PositionRow } from "./PositionRow";

interface PositionListProps {
  positions: PositionData[];
  minCount?: number;
  onUpdate: (id: string, updates: Partial<PositionData>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function PositionList({
  positions,
  minCount = 1,
  onUpdate,
  onRemove,
  onAdd,
}: PositionListProps) {
  const overlappingIds = getOverlappingRanges(positions);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {positions.map((pos, i) => (
          <PositionRow
            key={pos.id}
            position={pos}
            index={i}
            hasOverlap={overlappingIds.has(pos.id)}
            canRemove={positions.length > minCount}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>
      <button
        onClick={onAdd}
        className="w-full sm:w-auto px-6 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        + Add Position
      </button>
    </div>
  );
}