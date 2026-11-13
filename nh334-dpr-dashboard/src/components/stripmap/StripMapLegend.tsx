import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface StripMapLegendProps {
  className?: string;
}

export const StripMapLegend: React.FC<StripMapLegendProps> = ({ className = '' }) => {
  const { isLight } = useTheme();
  return (
    <div className={`bg-[#14171C] border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono select-none ${className}`}>
      <div className="flex items-center gap-2 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
        <span>Legend & Status Taxonomy:</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Completed */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#10B981] border border-emerald-300 shadow-sm shadow-emerald-500/20" />
          <span className="text-emerald-300 font-medium">Completed</span>
        </div>

        {/* Work Done by DPS */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#475569] border border-slate-400 shadow-sm shadow-slate-500/20" />
          <span className="text-slate-300 font-medium">Work Done by DPS</span>
        </div>

        {/* Under Construction */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#948A54] border border-[#BFA760] shadow-sm shadow-amber-500/20" />
          <span className="text-amber-200 font-medium">Under Construction</span>
        </div>

        {/* Himalayan */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#D97706] border border-orange-300 shadow-sm shadow-orange-500/20" />
          <span className="text-orange-300 font-medium">Himalayan</span>
        </div>

        {/* In Progress */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] border border-amber-300 shadow-sm shadow-amber-500/20" />
          <span className="text-amber-400 font-medium">In Progress</span>
        </div>

        {/* Delayed */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#EF4444] border border-rose-300 shadow-sm shadow-rose-500/20" />
          <span className="text-rose-400 font-medium">Delayed</span>
        </div>

        {/* Planned / Baseline */}
        <div className="flex items-center gap-2">
          <span
            className={`w-3.5 h-3.5 rounded shadow-sm ${
              isLight ? 'bg-[#E0F2FE] border border-[#38BDF8]' : 'bg-[#1E293B] border border-white/20'
            }`}
          />
          <span className="text-slate-400 font-medium">Planned / Scope</span>
        </div>
      </div>
    </div>
  );
};

