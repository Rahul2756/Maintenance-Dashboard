import React from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface StripMapNavigationProps {
  currentStartCh: string;
  currentEndCh: string;
  totalStartCh: string;
  totalEndCh: string;
  totalLengthKm: string;
  scrollRatio: number; // 0 to 1
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScrollLeft: (step?: 'page' | 'chunk') => void;
  onScrollRight: (step?: 'page' | 'chunk') => void;
  onScrollToRatio: (ratio: number) => void;
}

export const StripMapNavigation: React.FC<StripMapNavigationProps> = ({
  currentStartCh,
  currentEndCh,
  totalStartCh,
  totalEndCh,
  totalLengthKm,
  scrollRatio,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  onScrollToRatio,
}) => {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onScrollToRatio(val / 100);
  };

  return (
    <div className="w-full bg-[#0E1218] border border-cyan-500/25 rounded-2xl px-4 py-3 select-none shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-4 font-mono">
      {/* Left: Start Boundary Pill */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-950/40 border border-teal-500/40 text-xs font-semibold text-teal-200 shrink-0 shadow-sm">
        <MapPin className="w-3.5 h-3.5 text-teal-400" />
        <span>Start: Ch. {totalStartCh}</span>
      </div>

      {/* Center: Navigation Controls & Slider Track */}
      <div className="flex-1 flex items-center gap-3 w-full max-w-3xl">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => onScrollLeft('page')}
          disabled={!canScrollLeft}
          title="Previous Section"
          className="w-8 h-8 rounded-lg bg-[#141A22] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-400 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Draggable Slider Track */}
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={Math.round(scrollRatio * 1000) / 10}
            onChange={handleSliderChange}
            aria-label="Corridor Chainage Progression Scroller"
            className="w-full h-2.5 bg-[#080B0F] rounded-lg appearance-none cursor-ew-resize border border-cyan-500/30 accent-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 shadow-inner"
          />
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => onScrollRight('page')}
          disabled={!canScrollRight}
          title="Next Section"
          className="w-8 h-8 rounded-lg bg-[#141A22] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-400 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Range Label */}
      <div className="text-xs text-center lg:text-left shrink-0">
        <div className="text-white font-bold text-xs sm:text-[13px]">
          Showing Ch. {currentStartCh} – {currentEndCh}
        </div>
        <div className="text-[10px] text-slate-400">
          of {totalStartCh} – {totalEndCh} (Total: {totalLengthKm} km)
        </div>
      </div>

      {/* Right: End Boundary Pill */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-950/40 border border-teal-500/40 text-xs font-semibold text-teal-200 shrink-0 shadow-sm">
        <MapPin className="w-3.5 h-3.5 text-teal-400" />
        <span>End: Ch. {totalEndCh}</span>
      </div>
    </div>
  );
};
