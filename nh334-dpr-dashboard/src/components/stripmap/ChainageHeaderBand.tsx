import React from 'react';
import { ChainageInterval } from '../../types/stripChart';

interface ChainageHeaderBandProps {
  intervals: ChainageInterval[];
  columnWidths: number[];
  hoveredIntervalIndex: number | null;
  onHoverInterval: (index: number | null, event?: React.MouseEvent) => void;
}

export const ChainageHeaderBand: React.FC<ChainageHeaderBandProps> = ({
  intervals,
  columnWidths,
  hoveredIntervalIndex,
  onHoverInterval,
}) => {
  return (
    <div className="bg-[#0C1A24] border-y-2 border-cyan-500/40 divide-y divide-white/10 font-mono select-none shadow-md">
      {/* Row 1: Chainage From */}
      <div className="flex h-8 items-center">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 48;
          const displayFrom = isTight && inter.fromChainage.includes('+')
            ? `+${inter.fromChainage.split('+')[1]}`
            : inter.fromChainage;

          return (
            <div
              key={`from-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-cyan-500/35 text-white font-extrabold' : 'text-cyan-300 font-bold'
              }`}
              title={`Chainage From: Ch. ${inter.fromChainage}`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[10px]' : 'text-xs sm:text-[12px]'}`}>
                {displayFrom}
              </span>
            </div>
          );
        })}
      </div>

      {/* Row 2: Chainage To */}
      <div className="flex h-8 items-center">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 48;
          const displayTo = isTight && inter.toChainage.includes('+')
            ? `+${inter.toChainage.split('+')[1]}`
            : inter.toChainage;

          return (
            <div
              key={`to-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-cyan-500/35 text-white font-extrabold' : 'text-slate-100 font-bold'
              }`}
              title={`Chainage To: Ch. ${inter.toChainage}`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[10px]' : 'text-xs sm:text-[12px]'}`}>
                {displayTo}
              </span>
            </div>
          );
        })}
      </div>

      {/* Row 3: Length (m) */}
      <div className="flex h-7 items-center bg-[#09141D]">
        {intervals.map((inter, idx) => {
          const width = columnWidths[idx] || 60;
          const isHovered = hoveredIntervalIndex === idx;
          const isTight = width < 48;
          const formattedLen = inter.lengthM >= 1000
            ? `${inter.lengthM.toLocaleString()} m`
            : `${inter.lengthM} m`;

          return (
            <div
              key={`len-${inter.index}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              onMouseEnter={(e) => onHoverInterval(idx, e)}
              onMouseLeave={() => onHoverInterval(null)}
              className={`h-full flex items-center justify-center border-r border-cyan-500/20 px-0.5 text-center transition-colors cursor-pointer ${
                isHovered ? 'bg-cyan-500/35 text-amber-200 font-extrabold' : 'text-amber-300 font-bold'
              }`}
              title={`Length: ${inter.lengthM.toLocaleString()} m (Row 8/11)`}
            >
              <span className={`truncate tracking-tight ${isTight ? 'text-[10px]' : 'text-xs sm:text-[12px]'}`}>
                {formattedLen}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
