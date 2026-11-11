import React from 'react';
import {
  Calendar,
  Flag,
  Target,
  Timer,
  Hourglass,
  Layers,
  Droplet
} from 'lucide-react';
import {
  ScheduleMilestones,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities,
  ProjectBaseline
} from '../../types/dpr';
import {
  DEFAULT_SCHEDULE_MILESTONES,
  DEFAULT_CONSOLIDATED_SCOPE,
  DEFAULT_CUMULATIVE_ACHIEVED
} from '../../utils/excelParser';
import { useFilters } from '../../context/FilterContext';
import { STATE_BOUNDARIES } from '../../utils/stateFilterUtils';

export interface ProjectOverviewModuleProps {
  milestones?: ScheduleMilestones;
  sectionScopes?: SectionQuantityScope[];
  consolidatedScope?: ConsolidatedQuantityScope;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  baseline?: ProjectBaseline;
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
const HighwayRoadIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-[#00E599]' }) => (
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
const MillingMachineIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-[#00E599]' }) => (
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

// Feature flag: Hide achieved quantity and percentage progress bar from BOQ scope cards (Set to true to re-enable)
const SHOW_BOQ_ACHIEVED_PROGRESS = false;

export const ProjectOverviewModule: React.FC<ProjectOverviewModuleProps> = ({
  milestones = DEFAULT_SCHEDULE_MILESTONES,
  consolidatedScope = DEFAULT_CONSOLIDATED_SCOPE,
  cumulativeAchieved = DEFAULT_CUMULATIVE_ACHIEVED,
  baseline,
  className = ''
}) => {
  const { filters } = useFilters();
  const selectedState = filters.state || 'All';
  const stateBoundary = STATE_BOUNDARIES[selectedState];

  // Derived project timeline calculations dynamically computed from start date, completion date, and report date
  const parseDMY = (str: string): Date | null => {
    if (!str) return null;
    const parts = str.split('.').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const startObj = parseDMY(milestones.startDate) || new Date(2026, 9, 13);
  const compObj = parseDMY(milestones.completionDate) || new Date(2027, 0, 10);
  const repObj = parseDMY(milestones.reportDate) || new Date(2026, 10, 5);

  const msInDay = 86400000;
  const totalDays = Math.max(1, Math.round((compObj.getTime() - startObj.getTime()) / msInDay));
  const daysElapsed = Math.max(0, Math.round((repObj.getTime() - startObj.getTime()) / msInDay));
  const daysRemaining = Math.max(0, Math.round((compObj.getTime() - repObj.getTime()) / msInDay));
  const timeElapsedPct = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

  // Authoritative contractual BOQ targets dynamically reflecting state selection
  const millingScope = baseline?.totalMillingTargetSqm ?? (consolidatedScope?.millingSqm?.total || consolidatedScope?.millingSqm?.mcw || 681284);
  const tackCoatScope = baseline?.totalTackcoatTargetSqm ?? (consolidatedScope?.tackCoatSqm?.total || consolidatedScope?.tackCoatSqm?.mcw || 1848270.5);
  const dbmScope = baseline?.totalDbmTargetCum ?? (consolidatedScope?.dbmCum || 37026.246);
  const bcScope = baseline?.totalBcTargetCum ?? (consolidatedScope?.bcPmbCum || 46679.48);

  const millingAchieved = cumulativeAchieved?.millingSqm || 0;
  const tackCoatAchieved = cumulativeAchieved?.tackCoatSqm || 0;
  const dbmAchieved = cumulativeAchieved?.dbmCum || 0;
  const bcAchieved = cumulativeAchieved?.bcCum || 0;

  const millingPct = millingScope > 0 ? (millingAchieved / millingScope) * 100 : 0;
  const tackCoatPct = tackCoatScope > 0 ? (tackCoatAchieved / tackCoatScope) * 100 : 0;
  const dbmPct = dbmScope > 0 ? (dbmAchieved / dbmScope) * 100 : 0;
  const bcPct = bcScope > 0 ? (bcAchieved / bcScope) * 100 : 0;

  const millingBalance = Math.max(0, millingScope - millingAchieved);
  const tackCoatBalance = Math.max(0, tackCoatScope - tackCoatAchieved);
  const dbmBalance = Math.max(0, dbmScope - dbmAchieved);
  const bcBalance = Math.max(0, bcScope - bcAchieved);

  return (
    <div className={`space-y-6 w-full ${className}`}>
      {/* ============================================================== */}
      {/* SECTION 1: SCHEDULE MILESTONE VARIANCE                         */}
      {/* ============================================================== */}
      <section
        aria-label="Schedule Milestone Variance"
        className="w-full bg-[#0B1215] border border-[#14382F] rounded-[24px] p-6 sm:p-7 lg:p-8 shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-md">
            <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-[#00E599]" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide leading-tight">
              Schedule Milestone Variance
            </h2>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              Targets vs Actual Timeline
            </p>
          </div>
        </div>

        {/* 5 Horizontal Information Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-7 items-center mt-7">
          {/* Block 1: Project Start */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-[54px] sm:h-[54px] lg:w-[58px] lg:h-[58px] rounded-[16px] sm:rounded-[18px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Flag className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                Project Start
              </span>
              <span className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Planned work commencement
              </span>
              <span className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {formatMilestoneDate(milestones.startDate)}
              </span>
            </div>
          </div>

          {/* Block 2: Target Completion */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-[54px] sm:h-[54px] lg:w-[58px] lg:h-[58px] rounded-[16px] sm:rounded-[18px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Target className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                Target Completion
              </span>
              <span className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Contractual completion date
              </span>
              <span className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {formatMilestoneDate(milestones.completionDate)}
              </span>
            </div>
          </div>

          {/* Block 3: Days Elapsed */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-[54px] sm:h-[54px] lg:w-[58px] lg:h-[58px] rounded-[16px] sm:rounded-[18px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Timer className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                Days Elapsed
              </span>
              <span className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Active construction window
              </span>
              <span className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {daysElapsed} days
              </span>
            </div>
          </div>

          {/* Block 4: Days Remaining */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-[54px] sm:h-[54px] lg:w-[58px] lg:h-[58px] rounded-[16px] sm:rounded-[18px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-sm mt-0.5">
              <Hourglass className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-[#00E599]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                Days Remaining
              </span>
              <span className="text-[10px] text-slate-400 leading-normal mt-0.5">
                To milestone finish
              </span>
              <span className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-[#00E599] font-mono font-bold text-xs w-fit shadow-sm">
                {daysRemaining} days
              </span>
            </div>
          </div>

          {/* Block 5: Time Progress */}
          <div className="flex flex-col justify-center sm:col-span-2 lg:col-span-1 lg:border-l lg:border-white/[0.08] lg:pl-7">
            <div className="text-sm sm:text-base font-bold text-[#00E599] font-sans tracking-tight leading-tight">
              {timeElapsedPct.toFixed(1)}% Elapsed
            </div>
            <div className="text-[11px] text-slate-300 font-mono font-medium mt-0.5">
              {daysElapsed} / {totalDays} Days
            </div>
            <div className="mt-3.5 w-full bg-[#112420] border border-[#0F5A46]/50 rounded-full h-[16px] sm:h-[18px] overflow-hidden p-[2px] shadow-inner">
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
        className="w-full bg-[#0B1215] border border-[#14382F] rounded-[24px] p-6 sm:p-7 lg:p-8 shadow-2xl shadow-black/50"
      >
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0 shadow-md">
              <Layers className="w-7 h-7 sm:w-8 sm:h-8 text-[#00E599]" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide leading-tight">
                Total Project Scope & BOQ Baseline
              </h2>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                Work Program & Contractual Bill of Quantities (Muzaffarnagar – Haridwar)
              </p>
            </div>
          </div>

          {/* Top-Right Highway Corridor Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08201A] border border-[#0F5A46] text-xs font-medium shadow-sm">
            <HighwayRoadIcon className="w-4 h-4 text-[#00E599]" />
            <span className="text-white font-semibold">NH-334:</span>
            <span className="text-[#00E599] font-bold font-mono">{stateBoundary.lengthKm.toFixed(2)} km</span>
            <span className="text-slate-300">
              {selectedState === 'All' ? 'Total Corridor' : `${selectedState} (Ch. ${stateBoundary.minKm.toFixed(3)} to ${stateBoundary.maxKm.toFixed(3)})`}
            </span>
          </div>
        </div>

        {/* 4 BOQ Activity Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mt-7">
          {/* Card 1: Milling */}
          <div className="rounded-[22px] sm:rounded-[24px] bg-[#091218] border border-[#143028] p-5 sm:p-6 lg:p-7 flex flex-col justify-between shadow-lg hover:border-[#0F5A46] transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0">
                    <MillingMachineIcon className="w-5 h-5 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-xs sm:text-sm tracking-wide">
                    Milling
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[10px] font-mono font-bold">
                  Sqm
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight my-2.5 leading-none">
                {formatNumber(millingScope)}
              </div>

              {SHOW_BOQ_ACHIEVED_PROGRESS && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2">
                  <span>Achieved: {formatNumber(millingAchieved, 1)} Sqm</span>
                  <span className="text-white font-bold text-xs sm:text-sm font-mono">
                    {millingPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {SHOW_BOQ_ACHIEVED_PROGRESS && (
              <div className="w-full bg-[#112420] border border-[#0F5A46]/40 rounded-full h-3.5 sm:h-[18px] overflow-hidden p-[2px] shadow-inner">
                <div
                  className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, millingPct))}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 2: Tack Coat */}
          <div className="rounded-[22px] sm:rounded-[24px] bg-[#091218] border border-[#143028] p-5 sm:p-6 lg:p-7 flex flex-col justify-between shadow-lg hover:border-[#0F5A46] transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0">
                    <Droplet className="w-5 h-5 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-xs sm:text-sm tracking-wide">
                    Tack Coat
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[10px] font-mono font-bold">
                  Sqm
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight my-2.5 leading-none">
                {formatNumber(tackCoatScope)}
              </div>

              {SHOW_BOQ_ACHIEVED_PROGRESS && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2">
                  <span>Achieved: {formatNumber(tackCoatAchieved, 1)} Sqm</span>
                  <span className="text-white font-bold text-xs sm:text-sm font-mono">
                    {tackCoatPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {SHOW_BOQ_ACHIEVED_PROGRESS && (
              <div className="w-full bg-[#112420] border border-[#0F5A46]/40 rounded-full h-3.5 sm:h-[18px] overflow-hidden p-[2px] shadow-inner">
                <div
                  className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, tackCoatPct))}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 3: DBM (Bituminous Base) */}
          <div className="rounded-[22px] sm:rounded-[24px] bg-[#091218] border border-[#143028] p-5 sm:p-6 lg:p-7 flex flex-col justify-between shadow-lg hover:border-[#0F5A46] transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0">
                    <Layers className="w-5 h-5 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-xs sm:text-sm tracking-wide">
                    DBM <span className="text-slate-400 font-normal text-[10px]">(Bituminous Base)</span>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#08201A] border border-[#0F5A46] text-[#00E599] text-[10px] font-mono font-bold">
                  Cum
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight my-2.5 leading-none">
                {formatNumber(dbmScope, 0)}
              </div>

              {SHOW_BOQ_ACHIEVED_PROGRESS && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2">
                  <span>Achieved: {formatNumber(dbmAchieved, 1)} Cum</span>
                  <span className="text-white font-bold text-xs sm:text-sm font-mono">
                    {dbmPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {SHOW_BOQ_ACHIEVED_PROGRESS && (
              <div className="w-full bg-[#112420] border border-[#0F5A46]/40 rounded-full h-3.5 sm:h-[18px] overflow-hidden p-[2px] shadow-inner">
                <div
                  className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, dbmPct))}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 4: BC (Wearing Course) */}
          <div className="rounded-[22px] sm:rounded-[24px] bg-[#091218] border border-[#143028] p-5 sm:p-6 lg:p-7 flex flex-col justify-between shadow-lg hover:border-[#0F5A46] transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#082820] border border-[#0F5A46] flex items-center justify-center text-[#00E599] shrink-0">
                    <HighwayRoadIcon className="w-5 h-5 text-[#00E599]" />
                  </div>
                  <span className="text-white font-bold text-xs sm:text-sm tracking-wide">
                    BC <span className="text-slate-400 font-normal text-[10px]">(Wearing Course)</span>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#241432] border border-[#6B21A8]/60 text-[#C084FC] text-[10px] font-mono font-bold">
                  Cum
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight my-2.5 leading-none">
                {formatNumber(bcScope, 0)}
              </div>

              {SHOW_BOQ_ACHIEVED_PROGRESS && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2">
                  <span>Achieved: {formatNumber(bcAchieved, 1)} Cum</span>
                  <span className="text-white font-bold text-xs sm:text-sm font-mono">
                    {bcPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {SHOW_BOQ_ACHIEVED_PROGRESS && (
              <div className="w-full bg-[#112420] border border-[#0F5A46]/40 rounded-full h-3.5 sm:h-[18px] overflow-hidden p-[2px] shadow-inner">
                <div
                  className="h-full rounded-full bg-[#00E599] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, bcPct))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProjectOverviewModule;
