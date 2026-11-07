import React from 'react';
import { ChainageInterval } from '../../types/stripChart';

interface ChainageHeaderBandProps {
  intervals: ChainageInterval[];
  columnWidths: number[];
  hoveredIntervalIndex: number | null;
  onHoverInterval: (index: number | null, event?: React.MouseEvent) => void;
  onClickInterval?: (interval: ChainageInterval) => void;
}

export const ChainageHeaderBand: React.FC<ChainageHeaderBandProps> = ({
  intervals,
  columnWidths,
  hoveredIntervalIndex,
  onHoverInterval,
  onClickInterval,
}) => {
  return (
    <div className="relative bg-[#091017] border-y-2 border-cyan-500/50 font-mono select-none shadow-xl">
      {/* Central Roadway Texture & Dashed Road Markings */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 border-b border-dashed border-amber-400/40 pointer-events-none z-10" />

      {/* Row 1: Chainage From */}
      <div className="flex h-7 items-center bg-[#0C1620]/90 border-b border-white/5">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 50;
          const displayFrom = isTight && inter.fromChainage.includes('+')
            ? `+${inter.fromChainage.split('+')[1]}`
            : inter.fromChainage;

          return (
            <div
              key={`from-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              onClick={() => onClickInterval && onClickInterval(inter)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-cyan-500/40 text-white font-black' : 'text-cyan-300 font-bold'
              }`}
              title={`From: Ch. ${inter.fromChainage}`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[9px]' : 'text-xs'}`}>
                {displayFrom}
              </span>
            </div>
          );
        })}
      </div>

      {/* Row 2: Chainage To */}
      <div className="flex h-7 items-center bg-[#0A121A]/90 border-b border-white/5">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 50;
          const displayTo = isTight && inter.toChainage.includes('+')
            ? `+${inter.toChainage.split('+')[1]}`
            : inter.toChainage;

          return (
            <div
              key={`to-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              onClick={() => onClickInterval && onClickInterval(inter)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-cyan-500/40 text-white font-black' : 'text-slate-200 font-bold'
              }`}
              title={`To: Ch. ${inter.toChainage}`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[9px]' : 'text-xs'}`}>
                {displayTo}
              </span>
            </div>
          );
        })}
      </div>

      {/* Row 3: Length (m) */}
      <div className="flex h-6 items-center bg-[#070D14]">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 50;
          const formattedLen = inter.lengthM >= 1000
            ? `${inter.lengthM.toLocaleString()}m`
            : `${inter.lengthM}m`;

          return (
            <div
              key={`len-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              onClick={() => onClickInterval && onClickInterval(inter)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-amber-500/30 text-amber-200 font-black' : 'text-amber-400 font-bold'
              }`}
              title={`Segment Length: ${inter.lengthM}m (${inter.calculatedLengthM !== inter.lengthM ? 'Formula Discrepancy' : 'Exact'})`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[9px]' : 'text-[11px]'}`}>
                {formattedLen}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
