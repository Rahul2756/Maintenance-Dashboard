import React from 'react';

export interface MiniTripleBarChartProps {
  planned: number;
  actual: number;
  balance: number;
  unit: string;
  actualColor?: string; // Accent color per card
}

export const MiniTripleBarChart: React.FC<MiniTripleBarChartProps> = ({
  planned,
  actual,
  balance,
  unit,
  actualColor = '#06B6D4',
}) => {
  const maxValue = Math.max(planned, actual, balance, 1);

  const getBarHeight = (val: number) => {
    if (val <= 0) return 0;
    return Math.max(6, Math.min(100, Math.round((val / maxValue) * 100)));
  };

  const plannedHeight = getBarHeight(planned);
  const actualHeight = getBarHeight(actual);
  const balanceHeight = getBarHeight(balance);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 10_000) return `${(num / 1_000).toFixed(0)}k`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return Math.round(num).toLocaleString();
  };

  return (
    <div className="flex flex-col items-end gap-1.5 w-28 sm:w-32 shrink-0 select-none">
      {/* Mini Legend Row */}
      <div className="flex items-center gap-2 text-[9px] font-mono text-gray-400">
        <span className="flex items-center gap-1" title="Planned Target">
          <span className="w-1.5 h-1.5 rounded-xs bg-[#64748B]" />
          Plan
        </span>
        <span className="flex items-center gap-1" title="Actual Achieved">
          <span className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: actualColor }} />
          Act
        </span>
        <span className="flex items-center gap-1" title="Balance Remaining">
          <span className="w-1.5 h-1.5 rounded-xs bg-[#F97316]" />
          Bal
        </span>
      </div>

      {/* 3-Bar Chart Track */}
      <div
        className="w-full h-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 flex items-end justify-between gap-1.5 relative group cursor-pointer shadow-inner"
        title={`Planned: ${Math.round(planned).toLocaleString()} ${unit} | Actual: ${Math.round(actual).toLocaleString()} ${unit} | Balance: ${Math.round(balance).toLocaleString()} ${unit}`}
      >
        {/* Subtle Horizontal Grid Guideline */}
        <div className="absolute inset-x-2 top-1/2 border-t border-white/5 pointer-events-none" />

        {/* 1. Planned Bar (Slate / Gray) */}
        <div className="flex-1 flex flex-col items-center h-full justify-end">
          <div
            style={{ height: `${plannedHeight}%` }}
            title={`Planned: ${Math.round(planned).toLocaleString()} ${unit}`}
            className="w-full bg-[#64748B] hover:bg-[#94A3B8] rounded-t-sm transition-all duration-500 shadow-sm"
          />
        </div>

        {/* 2. Actual Bar (Dynamic Card Accent Color) */}
        <div className="flex-1 flex flex-col items-center h-full justify-end">
          <div
            style={{ height: `${actualHeight}%`, backgroundColor: actualColor }}
            title={`Actual: ${Math.round(actual).toLocaleString()} ${unit}`}
            className="w-full rounded-t-sm transition-all duration-500 shadow-sm brightness-110"
          />
        </div>

        {/* 3. Balance Bar (Vibrant Amber / Orange) */}
        <div className="flex-1 flex flex-col items-center h-full justify-end">
          <div
            style={{ height: `${balanceHeight}%` }}
            title={`Balance: ${Math.round(balance).toLocaleString()} ${unit}`}
            className="w-full bg-[#F97316] hover:bg-[#FB923C] rounded-t-sm transition-all duration-500 shadow-sm"
          />
        </div>
      </div>

      {/* Numerical Ratio Footer */}
      <div className="text-[10px] font-mono text-gray-400 text-right w-full truncate">
        <span className="text-white font-bold">{formatNumber(actual)}</span>
        <span className="text-gray-500"> / {formatNumber(planned)}</span>
      </div>
    </div>
  );
};

export default MiniTripleBarChart;

