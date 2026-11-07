import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Flag,
  Target,
  Timer,
  Hourglass,
  Layers,
  MapPin,
  Droplet
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

// Convert "02.11.2026" -> "02 Nov 2026"
function formatMilestoneDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length < 3) return dateStr;
  const d = parts[0].padStart(2, '0');
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

// Highway road icon with dashed center lane matching reference design
const HighwayRoadIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 text-[#00E599]' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19L8 5" />
    <path d="M20 19L16 5" />
    <path d="M12 5v2" strokeDasharray="1.5 2" />
    <path d="M12 11v2" strokeDasharray="1.5 2" />
    <path d="M12 17v2" strokeDasharray="1.5 2" />
  </svg>
);

// Road cold planer / milling machine icon
const MillingMachineIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 text-[#00E599]' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 18h18" />
    <path d="M6 18v-4h6v4" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
    <path d="M12 10l3 4" />
    <path d="M15 10h4v4" />
  </svg>
);

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
  const totalDays = milestones.totalDays || (milestones.daysElapsed + milestones.daysRemaining) || 70;
  const timeElapsedPct = totalDays > 0 ? (milestones.daysElapsed / totalDays) * 100 : 5.7;

  // Selected Section View Scope & Progress Calculations
  const currentView = useMemo(() => {
    if (selectedSection === 'sec1') {
      const mScope = sec1.millingSqm.total;
      const tScope = sec1.tackCoatSqm.total;
      const dScope = sec1.dbmCum.total;
      const bScope = sec1.bcCum.total;

      // Section 1 (Muzaffarnagar - Roorkee) is prior/future phase; actual DPR logging is on Sec 2
      const mAchieved = 0;
      const tAchieved = 0;
      const dAchieved = 0;
      const bAchieved = 0;

      return {
        name: sec1.sectionName,
        span: sec1.chainageSpan,
        lengthKm: sec1.lengthKm,
        milling: {
          scope: mScope,
          achieved: mAchieved,
          pct: mScope > 0 ? (mAchieved / mScope) * 100 : 0
        },
        tackCoat: {
          scope: tScope,
          achieved: tAchieved,
          pct: tScope > 0 ? (tAchieved / tScope) * 100 : 0
        },
        dbm: {
          scope: dScope,
          achieved: dAchieved,
          pct: dScope > 0 ? (dAchieved / dScope) * 100 : 0
        },
        bc: {
          scope: bScope,
          achieved: bAchieved,
          pct: bScope > 0 ? (bAchieved / bScope) * 100 : 0
        }
      };
    }

    if (selectedSection === 'sec2') {
      const mScope = sec2.millingSqm.total;
      const tScope = sec2.tackCoatSqm.total;
      const dScope = sec2.dbmCum.total;
      const bScope = sec2.bcCum.total;

      const mAchieved = cumulativeAchieved.millingSqm;
      const tAchieved = cumulativeAchieved.tackCoatSqm;
      const dAchieved = cumulativeAchieved.dbmCum;
      const bAchieved = cumulativeAchieved.bcCum;

      return {
        name: sec2.sectionName,
        span: sec2.chainageSpan,
        lengthKm: sec2.lengthKm,
        milling: {
          scope: mScope,
          achieved: mAchieved,
          pct: mScope > 0 ? (mAchieved / mScope) * 100 : 0
        },
        tackCoat: {
          scope: tScope,
          achieved: tAchieved,
          pct: tScope > 0 ? (tAchieved / tScope) * 100 : 0
        },
        dbm: {
          scope: dScope,
          achieved: dAchieved,
          pct: dScope > 0 ? (dAchieved / dScope) * 100 : 0
        },
        bc: {
          scope: bScope,
          achieved: bAchieved,
          pct: bScope > 0 ? (bAchieved / bScope) * 100 : 0
        }
      };
    }

    // Default 'all' - Consolidated Scope
    const mScope = consolidatedScope.millingSqm.mcw || 515298;
    const tScope = consolidatedScope.tackCoatSqm.mcw || 1494585;
    const dScope = consolidatedScope.dbmCum || 37026.246;
    const bScope = consolidatedScope.bcPmbCum || 46679.48;

    const mAchieved = cumulativeAchieved.millingSqm;
    const tAchieved = cumulativeAchieved.tackCoatSqm;
    const dAchieved = cumulativeAchieved.dbmCum;
    const bAchieved = cumulativeAchieved.bcCum;

    return {
      name: 'All Sections',
      span: 'CH. 130+560 to 206+220',
      lengthKm: 75.66,
      milling: {
        scope: mScope,
        achieved: mAchieved,
        pct: mScope > 0 ? (mAchieved / mScope) * 100 : 0
      },
      tackCoat: {
        scope: tScope,
        achieved: tAchieved,
        pct: tScope > 0 ? (tAchieved / tScope) * 100 : 0
      },
      dbm: {
        scope: dScope,
        achieved: dAchieved,
        pct: dScope > 0 ? (dAchieved / dScope) * 100 : 0
      },
      bc: {
        scope: bScope,
        achieved: bAchieved,
        pct: bScope > 0 ? (bAchieved / bScope) * 100 : 0
      }
    };
  }, [selectedSection, sec1, sec2, consolidatedScope, cumulativeAchieved]);

  return (
    <div className={`space-y-4 w-full ${className}`}>
      {/* ============================================================== */}
      {/* SECTION 1: SCHEDULE MILESTONE VARIANCE                         */}
      {/* ============================================================== */}
      <section
        aria-label="Schedule Milestone Variance"
        className="w-full bg-[#0B1215] border border-[#14382F] rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/40"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm">
            <Calendar className="w-5 h-5 text-[#00E599]" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm sm:text-base tracking-tight leading-snug">
              Schedule Milestone Variance
            </h2>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Targets vs Actual Timeline
            </p>
          </div>
        </div>

        {/* 5 Horizontal Information Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 items-center mt-5">
          {/* Block 1: Project Start */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Flag className="w-4.5 h-4.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-xs sm:text-[13px] leading-tight">
                Project Start
              </span>
              <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Planned work commencement
              </span>
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {formatMilestoneDate(milestones.startDate)}
              </span>
            </div>
          </div>

          {/* Block 2: Target Completion */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Target className="w-4.5 h-4.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-xs sm:text-[13px] leading-tight">
                Target Completion
              </span>
              <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Contractual completion date
              </span>
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {formatMilestoneDate(milestones.completionDate)}
              </span>
            </div>
          </div>

          {/* Block 3: Days Elapsed */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Timer className="w-4.5 h-4.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-xs sm:text-[13px] leading-tight">
                Days Elapsed
              </span>
              <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Active construction window
              </span>
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {milestones.daysElapsed} days
              </span>
            </div>
          </div>

          {/* Block 4: Days Remaining */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Hourglass className="w-4.5 h-4.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-xs sm:text-[13px] leading-tight">
                Days Remaining
              </span>
              <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                To milestone finish
              </span>
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {milestones.daysRemaining} days
              </span>
            </div>
          </div>

          {/* Block 5: Time Progress */}
          <div className="flex flex-col justify-center sm:col-span-2 lg:col-span-1 lg:border-l lg:border-white/[0.08] lg:pl-5">
            <div className="text-lg font-bold text-[#00E599] font-sans tracking-tight">
              {timeElapsedPct.toFixed(1)}% Elapsed
            </div>
            <div className="text-xs text-slate-300 font-mono font-medium mt-0.5">
              {milestones.daysElapsed} / {totalDays} Days
            </div>
            <div className="mt-2.5 w-full bg-[#112420] border border-[#0F5A46]/40 rounded-full h-2.5 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-[#00E599] transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, timeElapsedPct))}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 2: TOTAL PROJECT SCOPE & BOQ BASELINE                  */}
      {/* ============================================================== */}
      <section
        aria-label="Total Project Scope & BOQ Baseline"
        className="w-full bg-[#0B1215] border border-[#14382F] rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/40"
      >
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm">
              <Layers className="w-5 h-5 text-[#00E599]" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm sm:text-base tracking-tight leading-snug">
                Total Project Scope & BOQ Baseline
              </h2>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Work Program & Contractual Bill of Quantities (Muzaffarnagar – Haridwar)
              </p>
            </div>
          </div>

          {/* Top-Right Highway Corridor Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-xs shadow-sm">
            <HighwayRoadIcon className="w-4 h-4 text-[#00E599]" />
            <span className="text-white font-semibold">NH-334:</span>
            <span className="text-[#00E599] font-bold font-mono">75.66 km</span>
            <span className="text-slate-300">Total Corridor</span>
          </div>
        </div>

        {/* Corridor Scope Selector */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3.5 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-white font-medium mr-1">
            <MapPin className="w-3.5 h-3.5 text-[#00E599]" />
            <span>Corridor Scope View:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSection('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selectedSection === 'all'
                  ? 'bg-[#003B2C] text-[#00E599] border border-[#00E599] shadow-sm font-semibold'
                  : 'bg-[#091218] text-slate-300 border border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              All Sections (75.66 km)
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('sec1')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selectedSection === 'sec1'
                  ? 'bg-[#003B2C] text-[#00E599] border border-[#00E599] shadow-sm font-semibold'
                  : 'bg-[#091218] text-slate-300 border border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              Muzaffarnagar – Roorkee (38.44 km)
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('sec2')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selectedSection === 'sec2'
                  ? 'bg-[#003B2C] text-[#00E599] border border-[#00E599] shadow-sm font-semibold'
                  : 'bg-[#091218] text-slate-300 border border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              Roorkee – Haridwar (37.22 km)
            </button>
          </div>
        </div>

        {/* 4 Activity Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Card 1: Milling */}
          <div className="rounded-2xl bg-[#091218] border border-[#143028] p-4 flex flex-col justify-between shadow-md hover:border-[#0F5A46] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599]">
                    <MillingMachineIcon className="w-4 h-4 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">Milling</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[11px] font-mono font-bold">
                  Sqm
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight mt-2">
                {formatNumber(currentView.milling.scope)}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-2 mb-1.5">
                <span>Achieved: {formatNumber(currentView.milling.achieved, 1)} Sqm</span>
                <span className="text-white font-bold">{currentView.milling.pct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-full bg-[#112420] border border-[#0F5A46]/30 rounded-full h-2 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, currentView.milling.pct))}%` }}
              />
            </div>
          </div>

          {/* Card 2: Tack Coat */}
          <div className="rounded-2xl bg-[#091218] border border-[#143028] p-4 flex flex-col justify-between shadow-md hover:border-[#0F5A46] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599]">
                    <Droplet className="w-4 h-4 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">Tack Coat</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[11px] font-mono font-bold">
                  Sqm
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight mt-2">
                {formatNumber(currentView.tackCoat.scope)}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-2 mb-1.5">
                <span>Achieved: {formatNumber(currentView.tackCoat.achieved, 1)} Sqm</span>
                <span className="text-white font-bold">{currentView.tackCoat.pct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-full bg-[#112420] border border-[#0F5A46]/30 rounded-full h-2 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, currentView.tackCoat.pct))}%` }}
              />
            </div>
          </div>

          {/* Card 3: DBM (Bituminous Base) */}
          <div className="rounded-2xl bg-[#091218] border border-[#143028] p-4 flex flex-col justify-between shadow-md hover:border-[#0F5A46] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599]">
                    <Layers className="w-4 h-4 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">
                    DBM <span className="text-slate-400 font-normal text-xs">(Bituminous Base)</span>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[11px] font-mono font-bold">
                  Cum
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight mt-2">
                {formatNumber(currentView.dbm.scope, 0)}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-2 mb-1.5">
                <span>Achieved: {formatNumber(currentView.dbm.achieved, 1)} Cum</span>
                <span className="text-white font-bold">{currentView.dbm.pct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-full bg-[#112420] border border-[#0F5A46]/30 rounded-full h-2 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, currentView.dbm.pct))}%` }}
              />
            </div>
          </div>

          {/* Card 4: BC (Wearing Course) */}
          <div className="rounded-2xl bg-[#091218] border border-[#143028] p-4 flex flex-col justify-between shadow-md hover:border-[#0F5A46] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599]">
                    <HighwayRoadIcon className="w-4 h-4 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">
                    BC <span className="text-slate-400 font-normal text-xs">(Wearing Course)</span>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#241432] border border-[#6B21A8]/50 text-[#C084FC] text-[11px] font-mono font-bold">
                  Cum
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight mt-2">
                {formatNumber(currentView.bc.scope, 0)}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-2 mb-1.5">
                <span>Achieved: {formatNumber(currentView.bc.achieved, 1)} Cum</span>
                <span className="text-white font-bold">{currentView.bc.pct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-full bg-[#112420] border border-[#0F5A46]/30 rounded-full h-2 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, currentView.bc.pct))}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProjectOverviewModule;
