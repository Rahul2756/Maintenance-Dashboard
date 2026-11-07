import React from 'react';
import { useFilters } from '../../context/FilterContext';
import { ShieldAlert } from 'lucide-react';
import { formatChainagePlus } from '../../utils/excelParser';

interface ModuleSeparatorProps {
  filteredRowsCount?: number;
  overallAdherence?: number;
}

export const ModuleSeparator: React.FC<ModuleSeparatorProps> = ({
  filteredRowsCount,
  overallAdherence
}) => {
  const { filters, activeModule, selectedDate } = useFilters();

  const moduleMetaMap = {
    overview: {
      number: '01',
      total: '04',
      badge: 'MODULE 01',
      title: 'Project Overview & Baseline Milestone Control',
      desc: 'Milestone Timeline (13 Oct – 20 Nov 2026), Contract BOQ Baseline, and Daily Timeline Scrubber',
      color: 'from-cyan-500/50 via-blue-500/20 to-transparent',
      textColor: 'text-cyan-300',
      slashColor: 'text-cyan-400',
      badgeBorder: 'border-cyan-500/40',
      accentBg: 'bg-cyan-500/20'
    },
    analytics: {
      number: '02',
      total: '04',
      badge: 'MODULE 02',
      title: 'Daily Analytics & Predictive Volumetrics',
      desc: 'Volumetric KPIs, Linear Extent KPIs, Daily MT Bar Chart, S-Curve Pace Forecast, Depth Variance Scatter',
      color: 'from-blue-500/50 via-indigo-500/20 to-transparent',
      textColor: 'text-blue-300',
      slashColor: 'text-blue-400',
      badgeBorder: 'border-blue-500/40',
      accentBg: 'bg-blue-500/20'
    },
    spatial: {
      number: '03',
      total: '04',
      badge: 'MODULE 03',
      title: 'Spatial Corridor Twin & Linear Pavement Strip Map',
      desc: 'Interactive 3D Highway Corridor Inspector, Multi-Camera Views & Color-Coded Execution Strip Map',
      color: 'from-emerald-500/50 via-teal-500/20 to-transparent',
      textColor: 'text-emerald-300',
      slashColor: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/40',
      accentBg: 'bg-emerald-500/20'
    },
    logs: {
      number: '04',
      total: '04',
      badge: 'MODULE 04',
      title: 'Chainage Execution Logs & DPR Verification Grid',
      desc: 'Searchable DPR Chainage Data Grid with Anomaly Alerts, Depth Analysis, Sorting, and CSV Export',
      color: 'from-amber-500/50 via-orange-500/20 to-transparent',
      textColor: 'text-amber-300',
      slashColor: 'text-amber-400',
      badgeBorder: 'border-amber-500/40',
      accentBg: 'bg-amber-500/20'
    },
    all: {
      number: '00',
      total: '04',
      badge: 'ALL MODULES',
      title: 'Consolidated Highway Operations Platform',
      desc: 'All 4 Dedicated Engineering Modules Active Simultaneously',
      color: 'from-purple-500/50 via-cyan-500/20 to-transparent',
      textColor: 'text-purple-300',
      slashColor: 'text-purple-400',
      badgeBorder: 'border-purple-500/40',
      accentBg: 'bg-purple-500/20'
    }
  };

  const targetKey = (activeModule === 'dpr' ? 'logs' : activeModule) as keyof typeof moduleMetaMap;
  const currentMeta = moduleMetaMap[targetKey] || moduleMetaMap.overview;

  return (
    <div className="w-full bg-[#08090C] border-y-2 border-white/[0.12] shadow-2xl relative z-10 select-none">
      {/* Visual Accent Glow Top Line */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${currentMeta.color}`} />

      <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left Matter: Exactly formatted as requested (/// 0X/04 | MODULE 0X Title Case) */}
        <div className="flex items-center gap-3.5">
          {/* Engineering Image 3 Hash Mark Badge with Module Border Accent */}
          <div className={`flex items-center gap-2 bg-[#12141A] border ${currentMeta.badgeBorder} px-2.5 py-1.5 rounded-xl shadow-inner`}>
            {/* Triple Slanted Slashes /// */}
            <div className={`flex items-center font-mono font-black text-sm tracking-tight ${currentMeta.slashColor}`}>
              <span className="opacity-60 -mr-0.5">/</span>
              <span className="opacity-80 -mr-0.5">/</span>
              <span className="opacity-100">/</span>
            </div>

            {/* Vertical Sub-divider */}
            <div className="h-4 w-px bg-white/20 mx-0.5" />

            {/* Monospace 0X/04 Counter in Module Accent Color */}
            <span className={`font-mono text-xs font-bold tracking-widest ${currentMeta.textColor}`}>
              {currentMeta.number}/{currentMeta.total}
            </span>
          </div>

          {/* Module Title & Description formatted identically to bottom header */}
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md ${currentMeta.accentBg} ${currentMeta.textColor} border ${currentMeta.badgeBorder} font-mono text-[11px] font-bold tracking-wider`}>
                {currentMeta.badge}
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {currentMeta.title}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentMeta.desc}
            </p>
          </div>
        </div>

        {/* Right Matter: Contextual Indicators & Active Scope Stats */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Module Specific Dynamic Indicators */}
          {activeModule === 'overview' && (
            <>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                Corridor: Ch. 130+560 to Km 206+220 BHS (75.66 km)
              </span>
              <span className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                Planned Completion: 20 Nov 2026
              </span>
            </>
          )}

          {activeModule === 'analytics' && (
            <>
              <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300">
                Side: {filters.side === 'Both' ? 'Both Sides' : filters.side}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hidden md:inline">
                Layers: {filters.selectedActivities.join(', ')}
              </span>
              {overallAdherence !== undefined && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                  Adherence: {overallAdherence.toFixed(1)}%
                </span>
              )}
            </>
          )}

          {activeModule === 'spatial' && (
            <>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                Bound: {formatChainagePlus(filters.chainageBounds.from)} to {formatChainagePlus(filters.chainageBounds.to)}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                Preset: {filters.chainageScope}
              </span>
            </>
          )}

          {activeModule === 'logs' && (
            <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
              {filteredRowsCount !== undefined ? `${filteredRowsCount} Executed Stretches Logged` : 'Executed Stretches Logged'}
            </span>
          )}

          {/* Global filters chips */}
          {activeModule !== 'overview' && activeModule !== 'spatial' && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Scope:</span>
              <span className="text-cyan-300 font-bold">
                {formatChainagePlus(filters.chainageBounds.from)} – {formatChainagePlus(filters.chainageBounds.to)}
              </span>
            </div>
          )}

          {(filters.selectedSingleDate || selectedDate) ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
              <span>Day: {filters.selectedSingleDate || selectedDate}</span>
            </div>
          ) : null}

          {filters.anomaliesOnly && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Anomalies Only</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleSeparator;
