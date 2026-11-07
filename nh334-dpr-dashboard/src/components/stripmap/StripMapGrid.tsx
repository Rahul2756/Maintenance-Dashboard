import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  StripChartDataset,
  ChainageInterval,
} from '../../types/stripChart';
import { SelectedRoadSection } from '../../types/gis';
import { ActivityRows, HoveredSliceInfo } from './ActivityRows';
import { ChainageHeaderBand } from './ChainageHeaderBand';
import { getActivityIcon } from './ActivitySidebar';
import { parseChainage, formatChainage } from '../../utils/stripChartExcelParser';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  MapPin,
  Layers,
} from 'lucide-react';

interface StripMapGridProps {
  dataset: StripChartDataset;
  selectedActivityId: string; // 'all' or specific id
  selectedDate: string | null; // 'all' or date string e.g. '01-Nov-2026'
  onSelectDate: (date: string | null) => void;
  scrollRatio: number;
  onScrollRatioChange: (ratio: number, currentStart: string, currentEnd: string) => void;
  scrollTrigger: { direction: 'left' | 'right'; id: number; step: 'page' | 'chunk' } | null;
  targetRatio: number | null;
  onSelectChainage?: (chainageM: number) => void;
  targetChainageM?: number | null;
  selectedSection?: SelectedRoadSection | null;
  onSelectSection?: (section: SelectedRoadSection) => void;
}

export const StripMapGrid: React.FC<StripMapGridProps> = ({
  dataset,
  selectedActivityId,
  selectedDate,
  onSelectDate,
  onScrollRatioChange,
  scrollTrigger,
  targetRatio,
  onSelectChainage,
  targetChainageM,
  selectedSection,
  onSelectSection,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredIntervalIndex, setHoveredIntervalIndex] = useState<number | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<HoveredSliceInfo | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<HoveredSliceInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Zoom scale state (default 0.088 px/m)
  const [zoomScale, setZoomScale] = useState<number>(0.088);
  const [isFullCorridorFit, setIsFullCorridorFit] = useState<boolean>(false);

  // Carriageway collapse state
  const [lhsExpanded, setLhsExpanded] = useState<boolean>(true);
  const [rhsExpanded, setRhsExpanded] = useState<boolean>(true);

  // Chainage Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchHighlightIndex, setSearchHighlightIndex] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { metadata, lhsActivities, rhsActivities, intervals, lhsCells, rhsCells, lhsWorkZones, rhsWorkZones, completedLogs = [], availableDates = [] } = dataset;

  // Filter activities based on selection
  const filteredLhsActivities = useMemo(() => {
    if (selectedActivityId === 'all') return lhsActivities;
    return lhsActivities.filter((act) => act.id === selectedActivityId);
  }, [lhsActivities, selectedActivityId]);

  const filteredRhsActivities = useMemo(() => {
    if (selectedActivityId === 'all') return rhsActivities;
    return rhsActivities.filter((act) => act.id === selectedActivityId);
  }, [rhsActivities, selectedActivityId]);

  // Compute proportional column widths
  const effectiveScale = useMemo(() => {
    if (isFullCorridorFit && scrollContainerRef.current) {
      const containerW = scrollContainerRef.current.clientWidth - 100;
      const totalM = intervals.reduce((s, i) => s + i.lengthM, 0) || 75840;
      return Math.max(0.012, containerW / totalM);
    }
    return zoomScale;
  }, [isFullCorridorFit, zoomScale, intervals]);

  const { columnWidths, columnOffsets, totalGridWidth } = useMemo(() => {
    const widths: number[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    intervals.forEach((inter) => {
      offsets.push(currentOffset);
      const computed = Math.round(inter.lengthM * effectiveScale);
      const minW = isFullCorridorFit ? Math.max(12, Math.round(inter.lengthM * 0.012)) : inter.lengthM < 300 ? 36 : 64;
      const finalW = Math.max(computed, minW);
      widths.push(finalW);
      currentOffset += finalW;
    });

    return {
      columnWidths: widths,
      columnOffsets: offsets,
      totalGridWidth: currentOffset,
    };
  }, [intervals, effectiveScale, isFullCorridorFit]);

  // Handle Scroll and update dynamic range
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const ratio = maxScroll > 0 ? scrollLeft / maxScroll : 0;

    const visibleStartPx = scrollLeft;
    const visibleEndPx = scrollLeft + clientWidth;

    let startIdx = 0;
    let endIdx = intervals.length - 1;

    for (let i = 0; i < columnOffsets.length; i++) {
      if (columnOffsets[i] + columnWidths[i] >= visibleStartPx) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx; i < columnOffsets.length; i++) {
      if (columnOffsets[i] >= visibleEndPx || i === intervals.length - 1) {
        endIdx = i;
        break;
      }
    }

    const startCh = intervals[startIdx]?.fromChainage || metadata.startChainage;
    const endCh = intervals[endIdx]?.toChainage || metadata.endChainage;

    onScrollRatioChange(ratio, startCh, endCh);
  }, [columnOffsets, columnWidths, intervals, metadata, onScrollRatioChange]);

  // Programmatic scroll triggers
  useEffect(() => {
    if (!scrollTrigger || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const shift = scrollTrigger.step === 'page' ? container.clientWidth * 0.85 : 300;

    if (scrollTrigger.direction === 'left') {
      container.scrollBy({ left: -shift, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: shift, behavior: 'smooth' });
    }
  }, [scrollTrigger]);

  // Target ratio sync
  useEffect(() => {
    if (targetRatio === null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: maxScroll * targetRatio, behavior: 'smooth' });
  }, [targetRatio]);

  // External target chainage sync
  useEffect(() => {
    if (targetChainageM !== null && targetChainageM !== undefined && intervals.length > 0) {
      const idx = intervals.findIndex(
        it => targetChainageM >= it.fromM && targetChainageM <= it.toM
      );
      if (idx !== -1 && scrollContainerRef.current) {
        const offset = columnOffsets[idx] || 0;
        scrollContainerRef.current.scrollTo({
          left: Math.max(0, offset - scrollContainerRef.current.clientWidth / 2),
          behavior: 'smooth',
        });
        setSearchHighlightIndex(idx);
        setTimeout(() => setSearchHighlightIndex(null), 3000);
      }
    }
  }, [targetChainageM, intervals, columnOffsets]);

  // Two-way sync: External selected road section from GIS Map
  useEffect(() => {
    if (selectedSection && intervals.length > 0) {
      const midM = (selectedSection.fromM + selectedSection.toM) / 2;
      const idx = intervals.findIndex(
        it => midM >= it.fromM && midM <= it.toM
      );
      if (idx !== -1 && scrollContainerRef.current) {
        const offset = columnOffsets[idx] || 0;
        scrollContainerRef.current.scrollTo({
          left: Math.max(0, offset - scrollContainerRef.current.clientWidth / 2),
          behavior: 'smooth',
        });
        setSearchHighlightIndex(idx);
        setTimeout(() => setSearchHighlightIndex(null), 4000);
      }
    }
  }, [selectedSection, intervals, columnOffsets]);

  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  // Zoom handlers
  const handleZoomIn = () => {
    setIsFullCorridorFit(false);
    setZoomScale(prev => Math.min(0.25, prev * 1.3));
  };

  const handleZoomOut = () => {
    setIsFullCorridorFit(false);
    setZoomScale(prev => Math.max(0.03, prev / 1.3));
  };

  const handleResetZoom = () => {
    setIsFullCorridorFit(false);
    setZoomScale(0.088);
  };

  const handleFitCorridor = () => {
    setIsFullCorridorFit(prev => !prev);
  };

  // Search Chainage Handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    if (!searchQuery.trim()) return;

    const queryM = parseChainage(searchQuery.trim());
    if (queryM < metadata.startM || queryM > metadata.endM) {
      setSearchError(`Ch. ${searchQuery} outside corridor range (${metadata.startChainage} to ${metadata.endChainage})`);
      return;
    }

    const idx = intervals.findIndex(it => queryM >= it.fromM && queryM <= it.toM);
    if (idx !== -1 && scrollContainerRef.current) {
      const offset = columnOffsets[idx] || 0;
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, offset - scrollContainerRef.current.clientWidth / 2),
        behavior: 'smooth',
      });
      setSearchHighlightIndex(idx);
      if (onSelectChainage) onSelectChainage(queryM);
      setTimeout(() => setSearchHighlightIndex(null), 4000);
    } else {
      setSearchError(`Chainage ${searchQuery} not found in intervals`);
    }
  };

  // Date navigation handlers
  const currentDateIdx = selectedDate && selectedDate !== 'all' ? availableDates.indexOf(selectedDate) : -1;
  const handlePrevDate = () => {
    if (availableDates.length === 0) return;
    if (currentDateIdx <= 0) {
      onSelectDate(availableDates[availableDates.length - 1]);
    } else {
      onSelectDate(availableDates[currentDateIdx - 1]);
    }
  };

  const handleNextDate = () => {
    if (availableDates.length === 0) return;
    if (currentDateIdx === -1 || currentDateIdx >= availableDates.length - 1) {
      onSelectDate(availableDates[0]);
    } else {
      onSelectDate(availableDates[currentDateIdx + 1]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="flex-1 bg-[#12161D] border border-cyan-500/25 rounded-2xl overflow-hidden shadow-2xl relative select-none flex flex-col font-mono"
      onMouseMove={handleMouseMove}
    >
      {/* ========================================================= */}
      {/* 1. TOP CONTROL BAR: Date Selector, Zoom & Search Controls  */}
      {/* ========================================================= */}
      <div className="px-4 py-2.5 bg-[#0A0E14] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Date Selector (Overall vs Daily DPR View) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Overall vs Daily View Mode Toggle */}
          <div className="flex items-center bg-[#06090D] p-0.5 rounded-lg border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => onSelectDate('all')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer font-semibold ${selectedDate === 'all' || !selectedDate
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Overall View (All History)
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedDate === 'all' || !selectedDate) {
                  onSelectDate(availableDates[availableDates.length - 1] || '01-Nov-2026');
                }
              }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer font-semibold ${selectedDate !== 'all' && selectedDate !== null
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Daily DPR View
            </button>
          </div>

          {/* Daily Date Stepper & Dropdown (When in Daily DPR View) */}
          {selectedDate !== 'all' && selectedDate !== null && (
            <div className="flex items-center gap-1 bg-[#0E1520] border border-cyan-500/30 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrevDate}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
                title="Previous Work Date"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs text-cyan-200 font-bold">
                <Calendar className="w-3 h-3 text-cyan-400" />
                <select
                  value={selectedDate}
                  onChange={(e) => onSelectDate(e.target.value)}
                  className="bg-transparent text-cyan-200 font-bold text-xs outline-none cursor-pointer"
                >
                  {availableDates.map(d => (
                    <option key={d} value={d} className="bg-[#0E1520] text-slate-200">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleNextDate}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
                title="Next Work Date"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Chainage Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 relative">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Ch. (e.g. 189+230)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError(null);
              }}
              className="pl-8 pr-3 py-1 bg-[#06090D] border border-cyan-500/30 focus:border-cyan-400 rounded-lg text-xs text-white placeholder-slate-500 outline-none w-48 sm:w-56 font-mono transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Go
          </button>
          {searchError && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-rose-950 text-rose-200 text-[10px] px-2 py-1 rounded border border-rose-500/50 shadow-lg whitespace-nowrap">
              {searchError}
            </div>
          )}
        </form>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#06090D] p-1 rounded-lg border border-white/10 text-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={isFullCorridorFit}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded cursor-pointer disabled:opacity-30"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-[11px] text-slate-300 font-semibold min-w-10 text-center">
            {isFullCorridorFit ? 'Fit' : `${Math.round(zoomScale * 1000)}%`}
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={isFullCorridorFit}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded cursor-pointer disabled:opacity-30"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={handleFitCorridor}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${isFullCorridorFit
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            title="Fit Entire 75.84 km Corridor in View"
          >
            <Maximize2 className="w-3 h-3 inline mr-1" />
            Fit
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded cursor-pointer"
            title="Reset Zoom Scale"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. PERMANENT 5-COLOR HIGHWAY ENGINEERING LEGEND (Sec 5.E) */}
      {/* ========================================================= */}
      <div className="px-4 py-2 bg-[#090C11] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Status Legend:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold">
          {/* Purple: DPS */}
          <div className="flex items-center gap-1.5" title="Work Done by DPS (Fixed Exclusion)">
            <span className="w-3 h-3 rounded-sm bg-purple-600 border border-purple-400 shadow-sm shadow-purple-600/40" />
            <span className="text-purple-300">Work Done by DPS</span>
          </div>

          {/* Orange: Under Construction */}
          <div className="flex items-center gap-1.5" title="Under Construction (Fixed Exclusion)">
            <span className="w-3 h-3 rounded-sm bg-amber-600 border border-amber-400 shadow-sm shadow-amber-600/40" />
            <span className="text-amber-300">Under Construction</span>
          </div>

          {/* Magenta: Himalayan */}
          <div className="flex items-center gap-1.5" title="Himalayan (Fixed Exclusion)">
            <span className="w-3 h-3 rounded-sm bg-pink-600 border border-pink-400 shadow-sm shadow-pink-600/40" />
            <span className="text-pink-300">Himalayan</span>
          </div>

          {/* Green: Completed by Our Team */}
          <div className="flex items-center gap-1.5" title="Physical Work Completed by Our Team">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-300 shadow-sm shadow-emerald-500/40 animate-pulse" />
            <span className="text-emerald-400 font-bold">Completed by Our Team</span>
          </div>

          {/* Blue / Cyan: Remaining Eligible Scope */}
          <div className="flex items-center gap-1.5" title="Our Eligible Scope (Available for Execution)">
            <span className="w-3 h-3 rounded-sm bg-sky-900/60 border border-sky-400/80 shadow-sm shadow-sky-500/30" />
            <span className="text-sky-300">Eligible Work Scope</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 hidden lg:flex items-center gap-2">
          <span>{intervals.length} Segments</span> •
          <span>Ch. {metadata.startChainage} to {metadata.endChainage}</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. MAIN DUAL-CARRIAGEWAY HIGHWAY STRIP CHART BODY         */}
      {/* ========================================================= */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* FIXED LEFT SIDEBAR: Carriageway & Activity Names */}
        <div className="flex shrink-0 bg-[#0A0E14] border-r-2 border-cyan-500/30 z-30 shadow-2xl">
          {/* Sub-column 1: Carriageway Labels (LHS / Central Band / RHS) */}
          <div className="w-16 sm:w-20 bg-[#06090D] border-r border-white/10 flex flex-col justify-between select-none">
            {/* LHS MCW Carriageway Header with Collapse Toggle */}
            <button
              type="button"
              onClick={() => setLhsExpanded(prev => !prev)}
              style={{
                height: lhsExpanded ? `${filteredLhsActivities.length * 28 + 24}px` : '40px',
              }}
              className="w-full bg-gradient-to-b from-[#091E24] to-[#061418] border-b border-cyan-500/30 flex flex-col items-center justify-center gap-1 text-cyan-300 p-1 cursor-pointer hover:bg-cyan-950/40 transition-colors"
              title="Toggle LHS Carriageway"
            >
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200">LHS</span>
                {lhsExpanded ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />}
              </div>
              <span className="text-[9px] text-slate-400 font-medium">MCW</span>
            </button>

            {/* Central Highway Roadway Badge */}
            <div className="h-[80px] w-full bg-gradient-to-b from-[#0B2530] to-[#071922] border-y-2 border-cyan-400/50 flex flex-col items-center justify-center gap-1 text-center p-1 shadow-inner">
              <MapPin className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span className="text-[9px] font-black text-cyan-200 uppercase tracking-tighter leading-tight">
                CENTRELINE<br />CHAINAGE
              </span>
            </div>

            {/* RHS MCW Carriageway Header with Collapse Toggle */}
            <button
              type="button"
              onClick={() => setRhsExpanded(prev => !prev)}
              style={{
                height: rhsExpanded ? `${filteredRhsActivities.length * 28 + 24}px` : '40px',
              }}
              className="w-full bg-gradient-to-b from-[#091E24] to-[#061418] border-t border-cyan-500/30 flex flex-col items-center justify-center gap-1 text-cyan-300 p-1 cursor-pointer hover:bg-cyan-950/40 transition-colors"
              title="Toggle RHS Carriageway"
            >
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200">RHS</span>
                {rhsExpanded ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />}
              </div>
              <span className="text-[9px] text-slate-400 font-medium">MCW</span>
            </button>
          </div>

          {/* Sub-column 2: Activity Row Names */}
          <div className="w-48 sm:w-56 flex flex-col divide-y divide-white/5 font-mono text-xs">
            {/* LHS Activities */}
            {lhsExpanded ? (
              <div className="flex flex-col">
                <div className="h-6 px-3 bg-[#08121A] flex items-center text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  LHS Layer Progression
                </div>
                {filteredLhsActivities.map((act) => (
                  <div
                    key={`lhs-label-${act.id}`}
                    className="h-7 px-3 flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    title={act.name}
                  >
                    <div className="text-cyan-400 shrink-0">
                      {getActivityIcon(act.id, 'w-3.5 h-3.5')}
                    </div>
                    <span className="text-[11px] truncate font-medium text-slate-200">
                      {act.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-10 px-3 flex items-center text-slate-400 text-xs italic">
                LHS Collapsed
              </div>
            )}

            {/* Central Chainage Row Labels (From, To, Length) */}
            <div className="bg-[#09141D] border-y-2 border-cyan-500/40 divide-y divide-white/10 font-mono">
              <div className="h-7 px-3 flex items-center justify-between text-cyan-300 font-bold text-xs">
                <span>From Ch.</span>
              </div>
              <div className="h-7 px-3 flex items-center justify-between text-slate-100 font-bold text-xs">
                <span>To Ch.</span>
              </div>
              <div className="h-6 px-3 flex items-center justify-between text-amber-300 font-bold text-[11px] bg-[#070D14]">
                <span>Length (m)</span>
              </div>
            </div>

            {/* RHS Activities */}
            {rhsExpanded ? (
              <div className="flex flex-col">
                <div className="h-6 px-3 bg-[#08121A] flex items-center text-[10px] uppercase font-bold text-teal-400 tracking-wider">
                  RHS Layer Progression
                </div>
                {filteredRhsActivities.map((act) => (
                  <div
                    key={`rhs-label-${act.id}`}
                    className="h-7 px-3 flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    title={act.name}
                  >
                    <div className="text-teal-400 shrink-0">
                      {getActivityIcon(act.id, 'w-3.5 h-3.5')}
                    </div>
                    <span className="text-[11px] truncate font-medium text-slate-200">
                      {act.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-10 px-3 flex items-center text-slate-400 text-xs italic">
                RHS Collapsed
              </div>
            )}
          </div>
        </div>

        {/* HORIZONTALLY SCROLLING PROPORTIONAL ROAD GRID */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-[#090A0D] bg-[#070A0F] relative"
        >
          <div
            style={{ width: `${totalGridWidth}px` }}
            className="flex flex-col relative min-w-full"
          >
            {/* LHS Section */}
            {lhsExpanded && (
              <div className="relative">
                <div className="h-6 bg-[#08121A] border-b border-white/5" />
                <ActivityRows
                  side="LHS"
                  activities={filteredLhsActivities}
                  intervals={intervals}
                  columnWidths={columnWidths}
                  columnOffsets={columnOffsets}
                  cellsByActivity={lhsCells}
                  workZones={lhsWorkZones}
                  hoveredIntervalIndex={hoveredIntervalIndex}
                  completedLogs={completedLogs}
                  selectedDate={selectedDate}
                  onHoverSlice={(info, e) => {
                    setHoveredSlice(info);
                    if (info) {
                      setHoveredIntervalIndex(info.interval.index);
                      if (e) setTooltipPos({ x: e.clientX, y: e.clientY });
                    } else {
                      setHoveredIntervalIndex(null);
                    }
                  }}
                  onClickSlice={(info) => {
                    setSelectedSlice(info);
                    if (onSelectChainage) onSelectChainage(info.fill.fromM);
                  }}
                />
              </div>
            )}

            {/* Central Highway Roadway Band */}
            <ChainageHeaderBand
              intervals={intervals}
              columnWidths={columnWidths}
              hoveredIntervalIndex={hoveredIntervalIndex}
              onHoverInterval={(idx, e) => {
                setHoveredIntervalIndex(idx);
                if (idx !== null && e) setTooltipPos({ x: e.clientX, y: e.clientY });
              }}
              onClickInterval={(inter) => {
                if (onSelectChainage) onSelectChainage(inter.fromM);
                if (onSelectSection) {
                  onSelectSection({
                    fromM: inter.fromM,
                    toM: inter.toM,
                    fromChainageFmt: inter.fromChainage,
                    toChainageFmt: inter.toChainage,
                    lengthM: inter.lengthM,
                    side: 'BHS',
                    activity: selectedActivityId !== 'all' ? selectedActivityId : 'Corridor Baseline',
                    status: 'eligible_scope',
                    statusLabel: 'Eligible Scope',
                    source: 'strip_chart',
                  });
                }
              }}
            />

            {/* RHS Section */}
            {rhsExpanded && (
              <div className="relative">
                <div className="h-6 bg-[#08121A] border-b border-white/5" />
                <ActivityRows
                  side="RHS"
                  activities={filteredRhsActivities}
                  intervals={intervals}
                  columnWidths={columnWidths}
                  columnOffsets={columnOffsets}
                  cellsByActivity={rhsCells}
                  workZones={rhsWorkZones}
                  hoveredIntervalIndex={hoveredIntervalIndex}
                  completedLogs={completedLogs}
                  selectedDate={selectedDate}
                  onHoverSlice={(info, e) => {
                    setHoveredSlice(info);
                    if (info) {
                      setHoveredIntervalIndex(info.interval.index);
                      if (e) setTooltipPos({ x: e.clientX, y: e.clientY });
                    } else {
                      setHoveredIntervalIndex(null);
                    }
                  }}
                  onClickSlice={(info) => {
                    setSelectedSlice(info);
                    if (onSelectChainage) onSelectChainage(info.fill.fromM);
                  }}
                />
              </div>
            )}

            {/* Synchronized Vertical Column Hover Highlight */}
            {hoveredIntervalIndex !== null && (
              <div
                style={{
                  left: `${columnOffsets[hoveredIntervalIndex]}px`,
                  width: `${columnWidths[hoveredIntervalIndex]}px`,
                }}
                className="absolute inset-y-0 bg-cyan-400/10 pointer-events-none border-x border-cyan-400/40 z-10"
              />
            )}

            {/* Search Target Flashing Pulse Indicator */}
            {searchHighlightIndex !== null && (
              <div
                style={{
                  left: `${columnOffsets[searchHighlightIndex]}px`,
                  width: `${columnWidths[searchHighlightIndex]}px`,
                }}
                className="absolute inset-y-0 bg-amber-400/25 pointer-events-none border-2 border-amber-400 ring-4 ring-amber-400/30 animate-pulse z-20"
              />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. HOVER TOOLTIP INSPECTION POPUP                          */}
      {/* ========================================================= */}
      {tooltipPos && hoveredSlice && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(tooltipPos.x + 15, window.innerWidth - 320)}px`,
            top: `${Math.max(tooltipPos.y - 150, 20)}px`,
          }}
          className="z-50 pointer-events-none bg-[#10141C]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 shadow-2xl text-xs font-mono w-76 animate-fade-in"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                {hoveredSlice.side} MCW • {hoveredSlice.activityName}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${hoveredSlice.statusCategory === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : hoveredSlice.statusCategory === 'dps'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : hoveredSlice.statusCategory === 'under_construction'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : hoveredSlice.statusCategory === 'himalayan'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
              >
                {hoveredSlice.statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px]">Slice From:</span>
                <div className="text-cyan-300 font-semibold">Ch. {formatChainage(hoveredSlice.fill.fromM)}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Slice To:</span>
                <div className="text-cyan-300 font-semibold">Ch. {formatChainage(hoveredSlice.fill.toM)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
              <span className="text-slate-400">Slice Length:</span>
              <span className="text-amber-300 font-bold">
                {hoveredSlice.fill.lengthM.toLocaleString()} m ({hoveredSlice.fill.widthPct.toFixed(1)}% of block)
              </span>
            </div>

            {/* Completed Work Details */}
            {hoveredSlice.statusCategory === 'completed' && hoveredSlice.fill.logRecords.length > 0 && (
              <div className="pt-1.5 border-t border-emerald-500/20 text-[10px] text-emerald-300 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Logged Execution ({hoveredSlice.fill.logRecords.length} entries):</span>
                </div>
                {hoveredSlice.fill.logRecords.slice(0, 2).map((l, idx) => (
                  <div key={idx} className="text-slate-300">
                    • Date: {l.date} | Lane: {l.lane} | Qty: {l.achievedQty} {l.unit || ''}
                  </div>
                ))}
              </div>
            )}

            {/* Data Conflict Alert */}
            {hoveredSlice.fill.logRecords.some(l => l.hasConflict) && (
              <div className="p-1.5 bg-amber-950/60 border border-amber-500/50 rounded text-[10px] text-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Data Conflict: Logged work overlaps exclusion boundary. Priority preserved.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. CLICKED SEGMENT INSPECTION PANEL (DOCKED BOTTOM)       */}
      {/* ========================================================= */}
      {selectedSlice && (
        <div className="p-3 bg-[#0A0F16] border-t-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-4 text-xs font-mono animate-fade-in shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <span>{selectedSlice.side} MCW — {selectedSlice.activityName}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${selectedSlice.statusCategory === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : selectedSlice.statusCategory === 'dps'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : selectedSlice.statusCategory === 'under_construction'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : selectedSlice.statusCategory === 'himalayan'
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    }`}
                >
                  {selectedSlice.statusLabel}
                </span>
              </div>
              <div className="text-slate-400 text-xs">
                Interval: <span className="text-cyan-300 font-semibold">Ch. {formatChainage(selectedSlice.fill.fromM)} to {formatChainage(selectedSlice.fill.toM)}</span> ({selectedSlice.fill.lengthM}m) • Column {selectedSlice.interval.colLetter}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            {selectedSlice.statusCategory === 'completed' && selectedSlice.fill.logRecords.length > 0 ? (
              <div className="text-xs">
                <span className="text-slate-400">Execution Date:</span>{' '}
                <span className="text-emerald-400 font-bold">{selectedSlice.fill.logRecords[0].date}</span>{' '}
                • Achieved: <span className="text-white font-bold">{selectedSlice.fill.logRecords[0].achievedQty} {selectedSlice.fill.logRecords[0].unit || ''}</span>
              </div>
            ) : selectedSlice.statusCategory === 'eligible_scope' ? (
              <div className="text-xs text-sky-300">
                Eligible Road Section: Available for Contractor Paving Execution
              </div>
            ) : (
              <div className="text-xs text-purple-300">
                Official Exclusion: Established in MH Project Strip Chart format workbook
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedSlice(null)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
