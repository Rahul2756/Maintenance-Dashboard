import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  Activity,
  Layers,
  Search,
  X,
  Compass,
  BarChart3,
  MapPin,
  Clock,
  ShieldCheck,
  LayoutGrid
} from 'lucide-react';
import { HighwaySide, ActivityType, DPRMetadata } from '../../types/dpr';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatChainagePlus, isoToDisplayDate, serialToIsoDate } from '../../utils/excelParser';
import { useFilters, CHAINAGE_PRESETS, ModuleTab } from '../../context/FilterContext';

interface HeaderFilterBarProps {
  metadata: DPRMetadata;
  dataSource: 'live_excel' | 'fallback' | 'indexeddb';
  availableDates: string[];
  anomaliesCount: number;
  onReload: () => void;
  onOpenUpload: () => void;
  onOpenQC?: () => void;
  onOpenSummary?: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

export const HeaderFilterBar: React.FC<HeaderFilterBarProps> = ({
  metadata,
  dataSource,
  availableDates,
  anomaliesCount,
  onReload,
  onOpenUpload,
  onOpenQC,
  onOpenSummary,
  onExport,
  isLoading = false
}) => {
  const {
    filters,
    activeModule,
    scrollToModule,
    setSide,
    state,
    setState,
    toggleActivity,
    selectAllActivities,
    setDateRange,
    setSelectedSingleDate,
    setChainageScope,
    setAnomaliesOnly,
    setSearchQuery,
    resetFilters,
    isFiltered,
    filterStats
  } = useFilters();

  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>(
    filters.selectedActivities.length === 1 ? 'single' : 'multi'
  );

  const handleActivityClick = (act: ActivityType) => {
    if (selectionMode === 'single') {
      toggleActivity(act, true);
    } else {
      toggleActivity(act, false);
    }
  };

  const moduleTabs: { id: ModuleTab; label: string; icon: React.ReactNode; number: string }[] = [
    { id: 'overview', label: 'Executive Summary', icon: <Calendar className="w-3.5 h-3.5" />, number: '01' },
    { id: 'analytics', label: 'Daily Analytics', icon: <BarChart3 className="w-3.5 h-3.5" />, number: '02' },
    { id: 'spatial', label: 'Spatial & Strip Map', icon: <Compass className="w-3.5 h-3.5" />, number: '03' },
    { id: 'logs', label: 'Chainage Logs & DPR', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, number: '04' }
  ];

  return (
    <header className="w-full bg-[#0B0C0E] border-b border-white/[0.08] shadow-2xl">
      {/* 1. Main Project Brand Command Bar */}
      <div className="w-full bg-[#0B0C0E]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 lg:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Official Project Title & Identification with Corporate Logo */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Cube Highways Technologies Logo (Image 2) */}
            <div className="h-11 px-2.5 py-1 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-black/40 border border-white/20">
              <img
                src="/cubetech-logo.png"
                alt="Cube Highways Technologies Pvt. Ltd."
                className="h-9 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm lg:text-base font-extrabold text-white tracking-tight drop-shadow-sm flex items-center gap-2">
                  <span>Muzaffarnagar - Haridwar Section, NH-334 (KM 130+560 TO KM 206+220)</span>
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono font-bold shrink-0">
                  BHS Both Sides
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-medium hidden md:inline shrink-0">
                  MCW & Service Roads
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                <span className="text-slate-300 font-medium truncate">PMC: {metadata.pmc}</span>
                <span className="text-slate-600">|</span>
                <span className="truncate">Concessionaire: {metadata.concessionaire}</span>
                <span className="text-slate-600">|</span>
                <span className="truncate text-slate-300">Contractor: {metadata.contractor}</span>
                <span className="text-slate-600">|</span>
                <span className="font-mono text-cyan-300 font-semibold shrink-0">DPR No: #{metadata.dprNo}</span>
                <span className="text-slate-600">|</span>
                <span className="font-mono text-emerald-400 shrink-0">{metadata.reportDate}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions & Upload Controls (Moved to Top Right Corner) */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Badge
              variant={
                dataSource === 'indexeddb'
                  ? 'cyan'
                  : dataSource === 'live_excel'
                  ? 'emerald'
                  : 'amber'
              }
              size="sm"
              pulse={dataSource === 'live_excel' || dataSource === 'indexeddb'}
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              {dataSource === 'indexeddb'
                ? 'IndexedDB Synced'
                : dataSource === 'live_excel'
                ? 'Live Excel Synced'
                : 'Offline Cache'}
            </Badge>

            <Button
              variant="secondary"
              size="sm"
              onClick={onReload}
              loading={isLoading}
              className="text-xs"
              icon={<RefreshCw className="w-3.5 h-3.5 text-slate-300" />}
            >
              Reload
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onOpenUpload}
              className="text-xs font-semibold"
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              Upload Excel
            </Button>

            <Button
              variant="emerald"
              size="sm"
              onClick={onExport}
              className="text-xs font-semibold"
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Four-Module Navigation Tabs Bar */}
      <div className="w-full bg-[#101217] px-4 lg:px-6 py-1.5 border-b border-white/[0.06] flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {moduleTabs.map(tab => {
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => scrollToModule(tab.id)}
                className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-white border border-cyan-500/40 shadow-sm shadow-cyan-950/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {tab.number}
                </span>
                <span className={isActive ? 'text-cyan-300' : 'text-slate-400'}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Search Input Box */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter chainage, remarks..."
              value={filters.searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#16181F] border border-white/10 rounded-xl pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-44 lg:w-56 transition-all"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Global Synchronized Filter Controls Row */}
      <div className="sticky top-0 z-40 w-full px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs bg-[#121316]/95 backdrop-blur-xl shadow-md">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Side Selector (LHS / RHS / Both) */}
          <div className="flex items-center gap-1 bg-[#1A1D24] p-0.5 rounded-xl border border-white/10">
            {(['LHS', 'RHS', 'Both'] as const).map(sideOption => {
              const active = filters.side === sideOption;
              return (
                <button
                  key={sideOption}
                  onClick={() => setSide(sideOption)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sideOption === 'Both' ? 'Both Sides' : `${sideOption} (Outer/Inner)`}
                </button>
              );
            })}
          </div>

          {/* Activities Selector: Single & Multi Options */}
          <div className="flex items-center gap-1.5 bg-[#1A1D24] p-1 rounded-xl border border-white/10">
            <div className="flex items-center gap-1 pl-1 pr-1.5 border-r border-white/10 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-medium hidden sm:inline text-slate-300">Activity:</span>
            </div>

            {/* Mode Switcher: Single vs Multi */}
            <div className="flex items-center bg-[#121316] p-0.5 rounded-lg border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setSelectionMode('single');
                  if (filters.selectedActivities.length > 1) {
                    toggleActivity(filters.selectedActivities[0], true);
                  }
                }}
                className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                  selectionMode === 'single'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Single Mode: Click any activity to view only that one"
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('multi')}
                className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                  selectionMode === 'multi'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Multi Mode: Choose multiple activities simultaneously"
              >
                Multi
              </button>
            </div>

            {/* Quick 'All (4)' Button */}
            <button
              type="button"
              onClick={selectAllActivities}
              className={`px-2 py-0.5 rounded-lg border font-medium text-[11px] transition-all cursor-pointer ${
                filters.selectedActivities.length === 4
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
              title="Select all 4 highway layers"
            >
              All (4)
            </button>

            {/* Activity Option Buttons */}
            {(['Milling', 'Tackcoat', 'DBM', 'BC'] as ActivityType[]).map(act => {
              const active = filters.selectedActivities.includes(act);
              const colorMaps: Record<ActivityType, string> = {
                Milling: active
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                  : 'text-slate-400',
                Tackcoat: active
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-950/50 ring-1 ring-amber-500/30'
                  : 'text-slate-400',
                DBM: active
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950/50 ring-1 ring-emerald-500/30'
                  : 'text-slate-400',
                BC: active
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-950/50 ring-1 ring-purple-500/30'
                  : 'text-slate-400'
              };

              return (
                <button
                  key={act}
                  type="button"
                  onClick={() => handleActivityClick(act)}
                  className={`px-2.5 py-0.5 rounded-lg border font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    active ? colorMaps[act] : 'border-transparent hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active
                        ? act === 'Milling'
                          ? 'bg-cyan-400 animate-pulse'
                          : act === 'Tackcoat'
                          ? 'bg-amber-400 animate-pulse'
                          : act === 'DBM'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-purple-400 animate-pulse'
                        : 'bg-slate-600'
                    }`}
                  />
                  <span>{act}</span>
                </button>
              );
            })}
          </div>

          {/* Chainage Scope Presets */}
          <div className="flex items-center gap-1.5 bg-[#1A1D24] px-2.5 py-1 rounded-xl border border-white/10 text-slate-300">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Scope:</span>
            <div className="flex items-center gap-1 font-mono text-cyan-300 text-[11px]">
              <span>{formatChainagePlus(filters.chainageBounds.from)}</span>
              <span className="text-slate-500">–</span>
              <span>{formatChainagePlus(filters.chainageBounds.to)}</span>
            </div>
            <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
              {(['All', 'DPR', 'Sec1', 'Sec2'] as const).map(scopeKey => {
                const preset = CHAINAGE_PRESETS[scopeKey];
                const active = filters.chainageScope === scopeKey;
                return (
                  <button
                    key={scopeKey}
                    onClick={() => setChainageScope(scopeKey)}
                    title={preset.description}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {scopeKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* As-Of Report Date Selector */}
          <div className="flex items-center gap-1.5 bg-[#1A1D24] px-2.5 py-1 rounded-xl border border-white/10 text-slate-300 font-mono">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-sans font-medium">As of:</span>
            <select
              value={filters.selectedSingleDate || 'ALL'}
              onChange={e => {
                const val = e.target.value;
                if (val === 'ALL') {
                  setSelectedSingleDate(null);
                } else {
                  setSelectedSingleDate(val);
                }
              }}
              className="bg-transparent border-none text-cyan-300 font-bold focus:outline-none cursor-pointer text-xs font-mono"
            >
              <option value="ALL" className="bg-[#1A1D24] text-cyan-300 font-bold">
                All (Cumulative to {availableDates[availableDates.length - 1] || '05.11.2026'})
              </option>
              {[...availableDates].reverse().map(d => {
                const isLatest = d === availableDates[availableDates.length - 1];
                const display = isoToDisplayDate(serialToIsoDate(d));
                return (
                  <option key={`hdr-date-${d}`} value={d} className="bg-[#1A1D24] text-slate-200">
                    {display} ({d}){isLatest ? ' ★ LATEST' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* State Selector */}
          <div className="flex items-center gap-1.5 bg-[#1A1D24] px-2.5 py-1 rounded-xl border border-white/10 text-slate-300 font-mono">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-sans font-medium">State:</span>
            <select
              value={state || 'All'}
              onChange={e => setState(e.target.value as any)}
              className="bg-transparent border-none text-cyan-300 font-bold focus:outline-none cursor-pointer text-xs font-mono"
            >
              <option value="All" className="bg-[#1A1D24] text-cyan-300 font-bold">
                All States
              </option>
              <option value="Uttar Pradesh" className="bg-[#1A1D24] text-slate-200">
                Uttar Pradesh
              </option>
              <option value="Uttarakhand" className="bg-[#1A1D24] text-slate-200">
                Uttarakhand
              </option>
            </select>
          </div>
        </div>

        {/* Anomaly Toggle & Reset Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnomaliesOnly(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filters.anomaliesOnly
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-md shadow-rose-950/50 ring-1 ring-rose-500/30'
                : 'bg-[#1A1D24] text-slate-400 border-white/10 hover:text-rose-300 hover:border-rose-500/30'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filters.anomaliesOnly ? 'text-rose-400' : 'text-amber-400'}`} />
            <span>Anomalies Only</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
              {anomaliesCount}
            </span>
          </button>

          {isFiltered && (
            <button
              onClick={() => resetFilters(availableDates)}
              title="Reset all filters to defaults"
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Reset</span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                {filterStats.activeFilterCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderFilterBar;
