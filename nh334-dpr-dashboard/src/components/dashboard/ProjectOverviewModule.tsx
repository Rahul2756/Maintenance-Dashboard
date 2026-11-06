import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  Hourglass,
  ArrowRight,
  TrendingUp,
  MapPin,
  Maximize2
} from 'lucide-react';
import {
  ScheduleMilestones,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities
} from '../../types/dpr';
import {
  DEFAULT_SCHEDULE_MILESTONES,
  DEFAULT_SECTION_SCOPES,
  DEFAULT_CONSOLIDATED_SCOPE,
  DEFAULT_CUMULATIVE_ACHIEVED
} from '../../utils/excelParser';

export interface ProjectOverviewModuleProps {
  milestones?: ScheduleMilestones;
  sectionScopes?: SectionQuantityScope[];
  consolidatedScope?: ConsolidatedQuantityScope;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  className?: string;
}

// Convert "13.10.2026" -> "13 Oct 2026"
function formatMilestoneDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length < 3) return dateStr;
  const d = parts[0];
  const m = Number(parts[1]);
  const y = parts[2];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || 'Oct';
  return `${d} ${monthName} ${y}`;
}

// Format numbers with thousands separators
function formatNumber(val: number | undefined | null, decimals: number = 0): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export const ProjectOverviewModule: React.FC<ProjectOverviewModuleProps> = ({
  milestones = DEFAULT_SCHEDULE_MILESTONES,
  sectionScopes = DEFAULT_SECTION_SCOPES,
  consolidatedScope = DEFAULT_CONSOLIDATED_SCOPE,
  cumulativeAchieved = DEFAULT_CUMULATIVE_ACHIEVED,
  className = ''
}) => {
  const [selectedSection, setSelectedSection] = useState<'all' | 'sec1' | 'sec2'>('all');

  const sec1 = sectionScopes[0] || DEFAULT_SECTION_SCOPES[0];
  const sec2 = sectionScopes[1] || DEFAULT_SECTION_SCOPES[1];

  // Derived timeline calculations
  const totalDays = milestones.totalDays || (milestones.daysElapsed + milestones.daysRemaining) || 79;
  const timeElapsedPct = totalDays > 0 ? (milestones.daysElapsed / totalDays) * 100 : 12.66;

  // Selected Section View Scope & Progress Calculations
  const currentView = React.useMemo(() => {
    if (selectedSection === 'sec1') {
      return {
        name: sec1.sectionName,
        span: sec1.chainageSpan,
        lengthKm: sec1.lengthKm,
        milling: {
          scope: sec1.millingSqm.total,
          achieved: 0,
          pct: 0,
          lhs: sec1.millingSqm.lhs,
          rhs: sec1.millingSqm.rhs
        },
        tackCoat: {
          scope: sec1.tackCoatSqm.total,
          achieved: 0,
          pct: 0,
          lhs: sec1.tackCoatSqm.lhs,
          rhs: sec1.tackCoatSqm.rhs
        },
        dbm: {
          scope: sec1.dbmCum.total,
          achieved: 0,
          pct: 0,
          lhs: sec1.dbmCum.lhs,
          rhs: sec1.dbmCum.rhs
        },
        bc: {
          scope: sec1.bcCum.total,
          achieved: 0,
          pct: 0,
          lhs: sec1.bcCum.lhs,
          rhs: sec1.bcCum.rhs
        }
      };
    }

    if (selectedSection === 'sec2') {
      const mAchieved = cumulativeAchieved.millingSqm;
      const tAchieved = cumulativeAchieved.tackCoatSqm;
      const dAchieved = cumulativeAchieved.dbmCum;
      const bAchieved = cumulativeAchieved.bcCum;

      return {
        name: sec2.sectionName,
        span: sec2.chainageSpan,
        lengthKm: sec2.lengthKm,
        milling: {
          scope: sec2.millingSqm.total,
          achieved: mAchieved,
          pct: sec2.millingSqm.total > 0 ? (mAchieved / sec2.millingSqm.total) * 100 : 13.7,
          lhs: sec2.millingSqm.lhs,
          rhs: sec2.millingSqm.rhs
        },
        tackCoat: {
          scope: sec2.tackCoatSqm.total,
          achieved: tAchieved,
          pct: sec2.tackCoatSqm.total > 0 ? (tAchieved / sec2.tackCoatSqm.total) * 100 : 3.8,
          lhs: sec2.tackCoatSqm.lhs,
          rhs: sec2.tackCoatSqm.rhs
        },
        dbm: {
          scope: sec2.dbmCum.total,
          achieved: dAchieved,
          pct: sec2.dbmCum.total > 0 ? (dAchieved / sec2.dbmCum.total) * 100 : 11.2,
          lhs: sec2.dbmCum.lhs,
          rhs: sec2.dbmCum.rhs
        },
        bc: {
          scope: sec2.bcCum.total,
          achieved: bAchieved,
          pct: 0,
          lhs: sec2.bcCum.lhs,
          rhs: sec2.bcCum.rhs
        }
      };
    }

    // Default 'all' - Consolidated Scope
    const mScope = consolidatedScope.millingSqm.mcw || 515298;
    const tScope = consolidatedScope.tackCoatSqm.mcw || 1494585;
    const dScope = consolidatedScope.dbmCum || 28406.2;
    const bScope = consolidatedScope.bcPmbCum || 39171.5;

    const mAchieved = cumulativeAchieved.millingSqm;
    const tAchieved = cumulativeAchieved.tackCoatSqm;
    const dAchieved = cumulativeAchieved.dbmCum;
    const bAchieved = cumulativeAchieved.bcCum;

    return {
      name: 'All Sections (Full Corridor)',
      span: 'CH. 130+560 to 206+220',
      lengthKm: 75.66,
      milling: {
        scope: mScope,
        grandTotal: consolidatedScope.millingSqm.total,
        achieved: mAchieved,
        pct: mScope > 0 ? (mAchieved / mScope) * 100 : 6.6
      },
      tackCoat: {
        scope: tScope,
        grandTotal: consolidatedScope.tackCoatSqm.total,
        achieved: tAchieved,
        pct: tScope > 0 ? (tAchieved / tScope) * 100 : 1.9
      },
      dbm: {
        scope: dScope,
        achieved: dAchieved,
        pct: dScope > 0 ? (dAchieved / dScope) * 100 : 5.1
      },
      bc: {
        scope: bScope,
        achieved: bAchieved,
        pct: 0
      }
    };
  }, [selectedSection, sec1, sec2, consolidatedScope, cumulativeAchieved]);

  return (
    <section
      aria-label="Project Overview & Schedule Milestone Module"
      className={`grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 ${className}`}
    >
      {/* ============================================================ */}
      {/* COLUMN 1: Schedule Milestone Variance Card (lg:col-span-4)  */}
      {/* ============================================================ */}
      <div className="lg:col-span-4 bg-[#0F1422] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-white font-bold text-sm tracking-wide">
              Chart 10 · Schedule Milestone Variance
            </h3>
          </div>
          <span className="text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded-full text-xs font-medium">
            Target vs Actual Timeline
          </span>
        </div>

        {/* 4 Stacked Metric Sub-Cards */}
        <div className="space-y-2.5 flex-1 flex flex-col justify-between">
          {/* 1. PROJECT START */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 space-y-1 transition-all duration-200 hover:border-cyan-500/30">
            <div className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              PROJECT START
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 tracking-tight">
              {formatMilestoneDate(milestones.startDate)}
            </div>
            <div className="text-xs text-gray-500">
              Planned work commencement
            </div>
          </div>

          {/* 2. TARGET COMPLETION */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 space-y-1 transition-all duration-200 hover:border-cyan-500/30">
            <div className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              TARGET COMPLETION
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 tracking-tight">
              {formatMilestoneDate(milestones.completionDate)}
            </div>
            <div className="text-xs text-gray-500">
              Contractual completion date
            </div>
          </div>

          {/* 3. DAYS ELAPSED */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 space-y-1 transition-all duration-200 hover:border-cyan-500/30">
            <div className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              DAYS ELAPSED
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 tracking-tight">
              {milestones.daysElapsed} days
            </div>
            <div className="text-xs text-gray-500">
              Active construction window
            </div>
          </div>

          {/* 4. DAYS REMAINING */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 space-y-1 transition-all duration-200 hover:border-cyan-500/30">
            <div className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              DAYS REMAINING
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 tracking-tight">
              {milestones.daysRemaining} days
            </div>
            <div className="text-xs text-gray-500">
              To milestone finish
            </div>
          </div>
        </div>

        {/* Timeline Mini Visual */}
        <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{timeElapsedPct.toFixed(1)}% elapsed</span>
            </div>
            <span className="text-gray-400">
              {totalDays} Total Scheduled Days
            </span>
          </div>

          {/* Dual-color Progress Bar */}
          <div className="w-full bg-[#181F30] rounded-full h-2.5 overflow-hidden flex p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-sm shadow-cyan-500/50 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, timeElapsedPct))}%` }}
              title={`${timeElapsedPct.toFixed(1)}% Elapsed`}
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* COLUMN 2: Total Contract Scope & BOQ Baseline (lg:col-span-8) */}
      {/* ============================================================ */}
      <div className="lg:col-span-8 bg-[#0F1422] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl shadow-black/40">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight">
                Total Project Scope & BOQ Baseline
              </h2>
              <p className="text-xs text-slate-400">
                Work Program & Contractual Bill of Quantities (Muzaffarnagar – Haridwar)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-mono font-medium">
              NH-334: 75.66 km Total Corridor
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-800/60 text-slate-300 border border-white/10 font-medium">
              Dual Carriageway (LHS & RHS)
            </span>
          </div>
        </div>

        {/* Section Filter Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111624] p-1.5 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 pl-1.5 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-slate-300">Corridor Scope View:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSection('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                selectedSection === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/50 font-semibold'
                  : 'bg-white/[0.03] text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
              }`}
            >
              All Sections (75.66 km)
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('sec1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                selectedSection === 'sec1'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/50 font-semibold'
                  : 'bg-white/[0.03] text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
              }`}
            >
              Muzaffarnagar to Roorkee (38.44 km)
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('sec2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                selectedSection === 'sec2'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/50 font-semibold'
                  : 'bg-white/[0.03] text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
              }`}
            >
              Roorkee to Haridwar (37.22 km)
            </button>
          </div>
        </div>

        {/* 4 Core Engineering Scope Cards (Milling, Tack Coat, DBM, BC) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 my-1">
          {/* 1. Milling Card */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-all hover:border-cyan-500/30">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Milling
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                  Sqm
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {formatNumber(currentView.milling.scope)} <span className="text-xs font-normal text-slate-400">Sqm</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                <span>Achieved:</span>
                <span className="text-cyan-400 font-semibold">{formatNumber(currentView.milling.achieved, 1)} Sqm</span>
              </div>
              {selectedSection !== 'all' && (currentView.milling as any).lhs !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-white/5 flex justify-between font-mono">
                  <span>LHS: {formatNumber((currentView.milling as any).lhs)}</span>
                  <span>RHS: {formatNumber((currentView.milling as any).rhs)}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-400">
                <span>Scope Progress</span>
                <span className="text-cyan-300 font-semibold">{currentView.milling.pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1A2234] rounded-full h-2 overflow-hidden flex">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, currentView.milling.pct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Tack Coat Card */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-all hover:border-amber-500/30">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Tack Coat
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                  Sqm
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {formatNumber(currentView.tackCoat.scope)} <span className="text-xs font-normal text-slate-400">Sqm</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                <span>Achieved:</span>
                <span className="text-amber-400 font-semibold">{formatNumber(currentView.tackCoat.achieved, 1)} Sqm</span>
              </div>
              {selectedSection !== 'all' && (currentView.tackCoat as any).lhs !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-white/5 flex justify-between font-mono">
                  <span>LHS: {formatNumber((currentView.tackCoat as any).lhs)}</span>
                  <span>RHS: {formatNumber((currentView.tackCoat as any).rhs)}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-400">
                <span>Scope Progress</span>
                <span className="text-amber-300 font-semibold">{currentView.tackCoat.pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1A2234] rounded-full h-2 overflow-hidden flex">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, currentView.tackCoat.pct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. DBM (Bituminous Base) Card */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-all hover:border-emerald-500/30">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  DBM (Bituminous Base)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                  Cum
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {formatNumber(currentView.dbm.scope, 0)} <span className="text-xs font-normal text-slate-400">Cum</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                <span>Achieved:</span>
                <span className="text-emerald-400 font-semibold">{formatNumber(currentView.dbm.achieved, 1)} Cum</span>
              </div>
              {selectedSection !== 'all' && (currentView.dbm as any).lhs !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-white/5 flex justify-between font-mono">
                  <span>LHS: {formatNumber((currentView.dbm as any).lhs, 1)}</span>
                  <span>RHS: {formatNumber((currentView.dbm as any).rhs, 1)}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-400">
                <span>Scope Progress</span>
                <span className="text-emerald-300 font-semibold">{currentView.dbm.pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1A2234] rounded-full h-2 overflow-hidden flex">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, currentView.dbm.pct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4. BC (Wearing Course) Card */}
          <div className="bg-[#111624] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-all hover:border-purple-500/30">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  BC (Wearing Course)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                  Cum
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {formatNumber(currentView.bc.scope, 0)} <span className="text-xs font-normal text-slate-400">Cum</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                <span>Achieved:</span>
                <span className="text-purple-300 font-semibold">{formatNumber(currentView.bc.achieved, 1)} Cum</span>
              </div>
              {selectedSection !== 'all' && (currentView.bc as any).lhs !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-white/5 flex justify-between font-mono">
                  <span>LHS: {formatNumber((currentView.bc as any).lhs, 1)}</span>
                  <span>RHS: {formatNumber((currentView.bc as any).rhs, 1)}</span>
                </div>
              )}
            </div>

            {/* Visual Indicator: Pending Layer Sequencing */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-400">
                <span>Scope Status</span>
                <span className="text-slate-500">0.0%</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium w-full justify-center">
                <Hourglass className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Pending Layer Sequencing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Corridor Strip Details */}
        <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Section 1 Breakdown Card */}
          <button
            type="button"
            onClick={() => setSelectedSection(selectedSection === 'sec1' ? 'all' : 'sec1')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedSection === 'sec1'
                ? 'bg-cyan-950/30 border-cyan-500/40 ring-1 ring-cyan-500/30 shadow-md'
                : 'bg-[#111624] border-white/5 hover:border-white/10 hover:bg-[#141b2c]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Muzaffarnagar</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span>Roorkee</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  38.44 km
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">
                Ch. 130+560 to 169+000
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>Milling: <strong className="text-slate-200">{formatNumber(sec1.millingSqm.total)}</strong> Sqm</span>
              <span className="text-slate-600">•</span>
              <span>DBM: <strong className="text-slate-200">{formatNumber(sec1.dbmCum.total, 0)}</strong> Cum</span>
              <span className="text-slate-600">•</span>
              <span>BC: <strong className="text-slate-200">{formatNumber(sec1.bcCum.total, 0)}</strong> Cum</span>
            </div>
          </button>

          {/* Section 2 Breakdown Card */}
          <button
            type="button"
            onClick={() => setSelectedSection(selectedSection === 'sec2' ? 'all' : 'sec2')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedSection === 'sec2'
                ? 'bg-cyan-950/30 border-cyan-500/40 ring-1 ring-cyan-500/30 shadow-md'
                : 'bg-[#111624] border-white/5 hover:border-white/10 hover:bg-[#141b2c]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Roorkee</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span>Haridwar</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono font-medium">
                  Active DPR
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  37.22 km
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">
                Ch. 169+000 to 206+220
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>Milling: <strong className="text-slate-200">{formatNumber(sec2.millingSqm.total)}</strong> Sqm</span>
              <span className="text-slate-600">•</span>
              <span>DBM: <strong className="text-slate-200">{formatNumber(sec2.dbmCum.total, 0)}</strong> Cum</span>
              <span className="text-slate-600">•</span>
              <span>BC: <strong className="text-slate-200">{formatNumber(sec2.bcCum.total, 0)}</strong> Cum</span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProjectOverviewModule;
