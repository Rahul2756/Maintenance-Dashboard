import React, { useState } from 'react';
import { Clock } from 'lucide-react';
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

interface MilestonePackageItem {
  id: string;
  title: string;
  chainage: string;
  statusLabel: string;
  statusType: 'completed' | 'in_progress' | 'upcoming' | 'delayed';
  plannedSchedule: string;
  actualProgress: string;
  metrics: string;
  variance: string;
  varianceColor: 'emerald' | 'cyan' | 'slate' | 'rose';
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

const KEY_PACKAGES_DATA: MilestonePackageItem[] = [
  {
    id: 'MS-01',
    title: 'Section 2 Milling & DBM – Bahadarabad Toll to Haridwar',
    chainage: 'Km 188+900 to Km 206+220 BHS',
    statusLabel: 'IN_PROGRESS',
    statusType: 'in_progress',
    plannedSchedule: '13.10.2026 → 23.10.2026',
    actualProgress: 'Completed on 23.10.2026',
    metrics: '80,745 Sqm Milling / 4,054.75 Cum DBM (17.32 km)',
    variance: 'In Progress (Active)',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-02',
    title: 'Section 2 Milling & DBM – Roorkee Bypass to Bahadarabad Toll',
    chainage: 'Km 167+250 to Km 188+900 RHS & LHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '19.10.2026 → 18.11.2026',
    actualProgress: 'Started 22.10.2026',
    metrics: '186,536 Sqm Milling / 9,838 Cum DBM (21.65 km)',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-03',
    title: 'Section 2 BC Wearing Course – Roorkee to Haridwar',
    chainage: 'Km 169+000 to Km 206+220 BHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '26.10.2026 → 22.11.2026',
    actualProgress: 'Scheduled',
    metrics: '256,320 Sqm Tack Coat / 10,252.8 Cum BC (37.22 km)',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-04',
    title: 'Section 1 Milling & DBM – Muzaffarnagar to Roorkee',
    chainage: 'Km 130+560 to Km 167+250 RHS & LHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '16.11.2026 → 18.12.2026',
    actualProgress: 'Scheduled',
    metrics: '248,017 Sqm Milling / 14,513.2 Cum DBM (36.69 km)',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-05',
    title: 'Section 1 BC Wearing Course – Muzaffarnagar to Roorkee',
    chainage: 'Km 130+560 to Km 169+000 BHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '28.11.2026 → 01.01.2027',
    actualProgress: 'Scheduled',
    metrics: '445,326 Sqm Tack Coat / 17,813 Cum BC (38.44 km)',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-06',
    title: 'Section 3 Service Roads Milling, DBM & Surfacing',
    chainage: 'Full Corridor Service Roads BHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '14.12.2026 → 10.01.2027',
    actualProgress: 'Scheduled',
    metrics: '165,986 Sqm Milling / 8,620 Cum DBM & 7,508 Cum BC',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'MS-07',
    title: 'Corridor Finishing, Road Markings & Earthen Shoulders',
    chainage: 'Km 130+560 to Km 206+220 BHS (75.66 km)',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '21.11.2026 → 10.01.2027',
    actualProgress: 'Scheduled',
    metrics: '59,397 Sqm Road Marking / 159,084 Cum Shoulder',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  }
];

const WP_R1_PHASES_DATA: MilestonePackageItem[] = [
  {
    id: 'WK-01',
    title: 'Phase 1: Bahadarabad Toll to Haridwar (LHS & RHS DBM Completion)',
    chainage: 'Ch. 188+900 to 206+220 BHS',
    statusLabel: 'COMPLETED',
    statusType: 'completed',
    plannedSchedule: '02.11.2026 → 07.11.2026',
    actualProgress: 'Completed 07.11.2026',
    metrics: '64,617 Sqm Milling / 3,223 Cum DBM Completed',
    variance: 'On Schedule',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-02',
    title: 'Phase 2: Roorkee Bypass to Bahadarabad Toll (RHS Active Execution)',
    chainage: 'Ch. 188+900 to 167+250 RHS',
    statusLabel: 'IN_PROGRESS',
    statusType: 'in_progress',
    plannedSchedule: '10.11.2026 → 15.11.2026',
    actualProgress: 'In Progress',
    metrics: '24,498 Sqm Milling / 1,350 Cum DBM Targeted',
    variance: 'In Progress (Active)',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-03',
    title: 'Phase 3: Roorkee to Haridwar BC Wearing Course Overlay',
    chainage: 'Ch. 188+900 to 206+220 BHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '16.11.2026 → 22.11.2026',
    actualProgress: 'Scheduled',
    metrics: '21,500 Cum Tack Coat / 860 Cum BC Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-04',
    title: 'Phase 4: Roorkee Bypass to Bahadarabad Toll (LHS Milling & DBM)',
    chainage: 'Ch. 167+250 to 188+900 LHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '23.11.2026 → 29.11.2026',
    actualProgress: 'Scheduled',
    metrics: '31,048 Sqm Milling / 1,575 Cum DBM Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-05',
    title: 'Phase 5: Muzaffarnagar to Roorkee Bypass (RHS Milling & DBM)',
    chainage: 'Ch. 167+250 to 130+560 RHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '30.11.2026 → 06.12.2026',
    actualProgress: 'Scheduled',
    metrics: '25,711 Sqm Milling / 1,450 Cum DBM Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-06',
    title: 'Phase 6: Muzaffarnagar to Roorkee Bypass (LHS Milling Launch)',
    chainage: 'Ch. 130+560 to 167+250 LHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '07.12.2026 → 13.12.2026',
    actualProgress: 'Scheduled',
    metrics: '11,589 Sqm Milling / 700 Cum DBM Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-07',
    title: 'Phase 7: Full Corridor Service Roads Surfacing (BHS)',
    chainage: 'Full Corridor Service Roads BHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '14.12.2026 → 20.12.2026',
    actualProgress: 'Scheduled',
    metrics: '40,437 Sqm Milling / 2,100 Cum DBM Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-08',
    title: 'Phase 8: Muzaffarnagar to Roorkee BC Wearing Course (RHS)',
    chainage: 'Ch. 167+250 to 130+560 RHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '21.12.2026 → 27.12.2026',
    actualProgress: 'Scheduled',
    metrics: '81,750 Sqm Tack Coat / 3,270 Cum BC Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-09',
    title: 'Phase 9: Muzaffarnagar to Roorkee BC Wearing Course (LHS)',
    chainage: 'Ch. 130+560 to 167+250 LHS',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '28.12.2026 → 03.01.2027',
    actualProgress: 'Scheduled',
    metrics: '78,125 Sqm Tack Coat / 3,125 Cum BC Targeted',
    variance: 'Upcoming Scheduled',
    varianceColor: 'emerald'
  },
  {
    id: 'WK-10',
    title: 'Phase 10: Final Handover, Road Markings & Earthen Shoulders',
    chainage: 'Ch. 130+560 to 206+220 BHS (75.66 km)',
    statusLabel: 'UPCOMING',
    statusType: 'upcoming',
    plannedSchedule: '04.01.2027 → 10.01.2027',
    actualProgress: 'Scheduled',
    metrics: '59,397 Sqm Road Markings / 159,084 Cum Shoulders',
    variance: 'Final Delivery',
    varianceColor: 'emerald'
  }
];

function getStatusBadgeClass(statusType: string): string {
  switch (statusType) {
    case 'in_progress':
      return 'bg-blue-950/70 text-blue-400 border border-blue-600/40';
    case 'upcoming':
      return 'bg-slate-800/70 text-slate-300 border border-slate-700/60';
    case 'completed':
      return 'bg-emerald-950/70 text-emerald-400 border border-emerald-600/40';
    case 'delayed':
      return 'bg-rose-950/70 text-rose-400 border border-rose-600/40';
    default:
      return 'bg-slate-800/70 text-slate-300 border border-slate-700/60';
  }
}

function getStatusDotClass(statusType: string): string {
  switch (statusType) {
    case 'in_progress':
      return 'bg-blue-400 animate-pulse';
    case 'upcoming':
      return 'bg-slate-400';
    case 'completed':
      return 'bg-emerald-400';
    case 'delayed':
      return 'bg-rose-400 animate-pulse';
    default:
      return 'bg-slate-400';
  }
}

export const ProjectOverviewModule: React.FC<ProjectOverviewModuleProps> = ({
  milestones = DEFAULT_SCHEDULE_MILESTONES,
  _sectionScopes = DEFAULT_SECTION_SCOPES,
  _consolidatedScope = DEFAULT_CONSOLIDATED_SCOPE,
  _cumulativeAchieved = DEFAULT_CUMULATIVE_ACHIEVED,
  className = ''
}: any) => {
  const [activeTab, setActiveTab] = useState<'packages' | 'phases'>('packages');

  // Derived timeline calculations
  const totalDays = milestones.totalDays || (milestones.daysElapsed + milestones.daysRemaining) || 79;
  const timeElapsedPct = totalDays > 0 ? (milestones.daysElapsed / totalDays) * 100 : 12.66;

  const currentItems = activeTab === 'packages' ? KEY_PACKAGES_DATA : WP_R1_PHASES_DATA;

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
      {/* COLUMN 2: PROJECT MILESTONE TIMELINE (lg:col-span-8)          */}
      {/* ============================================================ */}
      <div className="lg:col-span-8 bg-[#0F1422] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl shadow-black/40">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
            <h3 className="text-white font-bold text-sm md:text-base tracking-wider uppercase font-mono">
              PROJECT MILESTONE TIMELINE
            </h3>
          </div>

          {/* View Toggles */}
          <div className="flex items-center gap-1.5 bg-[#111624] p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'packages'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-900/40'
                  : 'bg-transparent text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              Key Packages (MS 1–7)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('phases')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'phases'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-900/40'
                  : 'bg-transparent text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              WP-R1 Phases (10 Wks)
            </button>
          </div>
        </div>

        {/* Scrollable Milestone Cards List */}
        <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {currentItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#111726]/90 border border-white/[0.06] rounded-xl p-3.5 space-y-2.5 transition-all duration-200 hover:border-cyan-500/30 shadow-md shadow-black/20"
            >
              {/* Row 1: ID, Title & Status Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/40 font-mono font-bold text-xs tracking-wider shrink-0">
                    {item.id}
                  </span>
                  <h4 className="text-white font-bold text-sm tracking-tight">
                    {item.title}
                  </h4>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shrink-0 flex items-center gap-1.5 ${getStatusBadgeClass(
                    item.statusType
                  )}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${getStatusDotClass(item.statusType)}`}
                  />
                  {item.statusLabel}
                </span>
              </div>

              {/* Row 2: Subtitle / Chainage */}
              <div className="text-slate-400 text-xs font-mono">
                {item.chainage}
              </div>

              {/* Row 3: Inner Schedule & Actual Box */}
              <div className="bg-[#0B0F19] border border-white/[0.04] rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Planned Schedule:</span>
                  <span className="text-slate-200 font-medium">{item.plannedSchedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Actual / Progress:</span>
                  <span className="text-cyan-400 font-semibold">{item.actualProgress}</span>
                </div>
              </div>

              {/* Row 4: Scope metrics and status variance */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="text-slate-400">{item.metrics}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Status Variance:</span>
                  <span className="text-emerald-400 font-medium">{item.variance}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: Status Legend */}
        <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium">Status Legend:</span>
          <div className="flex flex-wrap items-center gap-4 text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Upcoming</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Delayed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectOverviewModule;
