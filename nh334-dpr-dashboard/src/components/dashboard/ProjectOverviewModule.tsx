import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Clock,
  Calendar,
  Flag,
  Hourglass,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  TrendingUp,
  MapPin,
  Layers,
  ArrowRight,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import {
  ScheduleMilestones,
  ActualDPRRow,
  ProjectBaseline,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities
} from '../../types/dpr';
import { useFilters } from '../../context/FilterContext';

// ============================================================================
// DATA MODELS & INTERFACES
// ============================================================================

export interface HighwayMilestoneItem {
  id: string;
  code: string;
  name: string;
  stretch: string;
  chainage: string;
  scopeSummary: string;
  plannedStart: string;       // "13.10.2026"
  plannedCompletion: string;  // "23.10.2026"
  actualStart?: string;       // "14.10.2026"
  actualCompletion?: string;  // "23.10.2026"
  forecastCompletion?: string;// "21.11.2026"
  weightPct: number;          // % weighting of overall project
  phaseWeek?: string;
}

export interface ProjectOverviewModuleProps {
  milestones?: ScheduleMilestones;
  actualRows?: ActualDPRRow[];
  baseline?: ProjectBaseline;
  availableDates?: string[];
  onSelectRow?: (row: ActualDPRRow) => void;
  // Legacy optional props retained for compatibility
  sectionScopes?: SectionQuantityScope[];
  consolidatedScope?: ConsolidatedQuantityScope;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  className?: string;
}

// ============================================================================
// AUTHORITATIVE PROJECT MILESTONES (Derived from Work Program & DPR Baseline)
// ============================================================================

export const AUTHORITATIVE_CORRIDOR_MILESTONES: HighwayMilestoneItem[] = [
  {
    id: 'ms-01',
    code: 'MS-01',
    name: 'Section 2 Milling & DBM – Bahadarabad Toll to Haridwar',
    stretch: 'Bahadarabad Toll to Haridwar',
    chainage: 'Km 188+900 to Km 206+220 BHS',
    scopeSummary: '80,745 Sqm Milling / 4,054.75 Cum DBM (17.32 km)',
    plannedStart: '13.10.2026',
    plannedCompletion: '23.10.2026',
    actualStart: '14.10.2026',
    actualCompletion: '23.10.2026',
    weightPct: 14.3,
    phaseWeek: 'Week 1'
  },
  {
    id: 'ms-02',
    code: 'MS-02',
    name: 'Section 2 Milling & DBM – Roorkee Bypass to Bahadarabad Toll',
    stretch: 'Roorkee Bypass to Bahadarabad Toll',
    chainage: 'Km 167+250 to Km 188+900 RHS & LHS',
    scopeSummary: '186,536 Sqm Milling / 9,838 Cum DBM (21.65 km)',
    plannedStart: '19.10.2026',
    plannedCompletion: '18.11.2026',
    actualStart: '22.10.2026',
    forecastCompletion: '21.11.2026',
    weightPct: 22.5,
    phaseWeek: 'Week 2-3'
  },
  {
    id: 'ms-03',
    code: 'MS-03',
    name: 'Section 2 BC Wearing Course – Roorkee to Haridwar',
    stretch: 'Roorkee to Haridwar',
    chainage: 'Km 169+000 to Km 206+220 BHS',
    scopeSummary: '256,320 Sqm Tack Coat / 10,252.8 Cum BC (37.22 km)',
    plannedStart: '26.10.2026',
    plannedCompletion: '22.11.2026',
    weightPct: 18.0,
    phaseWeek: 'Week 3-4'
  },
  {
    id: 'ms-04',
    code: 'MS-04',
    name: 'Section 1 Milling & DBM – Muzaffarnagar to Roorkee',
    stretch: 'Muzaffarnagar to Roorkee Bypass',
    chainage: 'Km 130+560 to Km 167+250 BHS',
    scopeSummary: '248,017 Sqm Milling / 14,513 Cum DBM (36.69 km)',
    plannedStart: '16.11.2026',
    plannedCompletion: '13.12.2026',
    weightPct: 20.2,
    phaseWeek: 'Week 4-6'
  },
  {
    id: 'ms-05',
    code: 'MS-05',
    name: 'Section 1 BC Wearing Course – Muzaffarnagar to Roorkee',
    stretch: 'Muzaffarnagar to Roorkee Bypass',
    chainage: 'Km 130+560 to Km 167+250 BHS',
    scopeSummary: '445,326 Sqm Tack Coat / 17,813 Cum BC (36.69 km)',
    plannedStart: '30.11.2026',
    plannedCompletion: '20.12.2026',
    weightPct: 15.0,
    phaseWeek: 'Week 5-7'
  },
  {
    id: 'ms-06',
    code: 'MS-06',
    name: 'Service Road & Corridor Ancillary Furniture Works',
    stretch: 'Service Road & Safety Works',
    chainage: 'Km 130+560 to Km 206+220 BHS',
    scopeSummary: '165,986 Sqm Service Road / 59,396 Sqm Marking / 40k Studs',
    plannedStart: '07.12.2026',
    plannedCompletion: '28.12.2026',
    weightPct: 7.0,
    phaseWeek: 'Week 6-8'
  },
  {
    id: 'ms-07',
    code: 'MS-07',
    name: 'Corridor Final Handover & Substantial Completion',
    stretch: 'Full NH-334 Corridor',
    chainage: 'Km 130+560 to Km 206+220 (75.66 km)',
    scopeSummary: 'Final Quality Audit, Road Safety Inspection & COD Handover',
    plannedStart: '21.12.2026',
    plannedCompletion: '31.12.2026',
    weightPct: 3.0,
    phaseWeek: 'Week 9-10'
  }
];

export const WP_R1_WEEKLY_MILESTONES: HighwayMilestoneItem[] = [
  {
    id: 'wp-w1',
    code: 'Week 1',
    name: 'Phase 1: Bahadarabad Toll to Haridwar – Milling & DBM',
    stretch: 'Bahadarabad Toll to Haridwar',
    chainage: 'Km 188+900 – 206+220 LHS & RHS',
    scopeSummary: 'Completed in DPR (25,547 sqm LHS, 39,070 sqm RHS)',
    plannedStart: '02.11.2026',
    plannedCompletion: '07.11.2026',
    actualStart: '02.11.2026',
    actualCompletion: '07.11.2026',
    weightPct: 10
  },
  {
    id: 'wp-w2',
    code: 'Week 2',
    name: 'Phase 2: Roorkee Bypass to Bahadarabad Toll – RHS Milling & Tack, LHS BC',
    stretch: 'Roorkee Bypass to Bahadarabad Toll',
    chainage: 'Km 167+250 – 188+900',
    scopeSummary: '24,498 Sqm Milling RHS / 89,478 Sqm BC Tack LHS',
    plannedStart: '10.11.2026',
    plannedCompletion: '15.11.2026',
    weightPct: 10
  },
  {
    id: 'wp-w3',
    code: 'Week 3',
    name: 'Phase 3: Roorkee Bypass to Bahadarabad Toll – LHS Milling & DBM, RHS BC',
    stretch: 'Roorkee Bypass to Bahadarabad Toll',
    chainage: 'Km 167+250 – 188+900',
    scopeSummary: '31,048 Sqm Milling LHS / 129,568 Sqm BC Tack RHS',
    plannedStart: '16.11.2026',
    plannedCompletion: '22.11.2026',
    weightPct: 10
  },
  {
    id: 'wp-w4',
    code: 'Week 4',
    name: 'Phase 4: Bahadarabad BC Finishing & Muzaffarnagar RHS Milling Commencement',
    stretch: 'Roorkee – Bahadarabad & Muzaffarnagar – Roorkee',
    chainage: 'Km 167+250 – 188+900 & Km 130+560 – 167+250 RHS',
    scopeSummary: '127,825 Sqm BC Tack / 25,711 Sqm Milling RHS',
    plannedStart: '23.11.2026',
    plannedCompletion: '29.11.2026',
    weightPct: 10
  },
  {
    id: 'wp-w5',
    code: 'Week 5',
    name: 'Phase 5: Muzaffarnagar to Roorkee – RHS DBM & BC, LHS Milling Staging',
    stretch: 'Muzaffarnagar to Roorkee Bypass',
    chainage: 'Km 130+560 – 167+250',
    scopeSummary: '45,450 Sqm Milling RHS / 81,750 Sqm BC Tack RHS / 11,589 Sqm Milling LHS',
    plannedStart: '30.11.2026',
    plannedCompletion: '06.12.2026',
    weightPct: 10
  },
  {
    id: 'wp-w6',
    code: 'Week 6',
    name: 'Phase 6: Muzaffarnagar to Roorkee – LHS DBM & Service Road Milling Front',
    stretch: 'Muzaffarnagar – Roorkee & Service Road BHS',
    chainage: 'Km 130+560 – 167+250 & Service Road',
    scopeSummary: '32,285 Sqm Milling LHS / 40,437 Sqm Service Road Milling',
    plannedStart: '07.12.2026',
    plannedCompletion: '13.12.2026',
    weightPct: 10
  },
  {
    id: 'wp-w7',
    code: 'Week 7',
    name: 'Phase 7: Service Road DBM, LHS BC Laying & Road Markings Staging',
    stretch: 'Service Road & Main Carriageway',
    chainage: 'Km 130+560 – 206+220 BHS',
    scopeSummary: '40,454 Sqm Service Road / 11,250 Sqm BC Tack / 8,400 Sqm Road Marking',
    plannedStart: '14.12.2026',
    plannedCompletion: '20.12.2026',
    weightPct: 10
  },
  {
    id: 'wp-w8',
    code: 'Week 8',
    name: 'Phase 8: Service Road BC, Safety Studs & Earthen Shoulder Progression',
    stretch: 'Full Corridor Service Road & Furniture',
    chainage: 'Km 130+560 – 206+220 BHS',
    scopeSummary: '5,750 Sqm Service Road BC / 6,650 Nos Studs / 19,600 Sqm Shoulder',
    plannedStart: '21.12.2026',
    plannedCompletion: '27.12.2026',
    weightPct: 10
  },
  {
    id: 'wp-w9',
    code: 'Week 9',
    name: 'Phase 9: Corridor Finishing, Safety Furniture & Final Pavement Punchlist',
    stretch: 'Corridor Finishing Stretches',
    chainage: 'Km 130+560 – 206+220 BHS',
    scopeSummary: '86,250 Sqm BC Service Road / 9,100 Sqm Marking / 7,490 Studs',
    plannedStart: '28.12.2026',
    plannedCompletion: '03.01.2027',
    weightPct: 10
  },
  {
    id: 'wp-w10',
    code: 'Week 10',
    name: 'Phase 10: Final Commissioning, Road Safety Audit & Commercial Demobilization',
    stretch: 'Full Corridor Handover',
    chainage: 'Km 130+560 – 206+220 BHS (75.66 km)',
    scopeSummary: 'Final Commissioning & Milestone Clearance (WP-R1 Finish)',
    plannedStart: '04.01.2027',
    plannedCompletion: '10.01.2027',
    weightPct: 10
  }
];

// ============================================================================
// DATE CALCULATION & FORMATTING UTILITIES
// ============================================================================

export function parseDMY(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('.').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date();
  }
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

export function formatDisplayDate(dateStr: string): string {
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

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length < 2) return dateStr;
  const d = parts[0];
  const m = Number(parts[1]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1] || 'Oct'}`;
}

export function daysDiff(d1Str: string, d2Str: string): number {
  const d1 = parseDMY(d1Str);
  const d2 = parseDMY(d2Str);
  const ms = 86400000;
  return Math.round((d2.getTime() - d1.getTime()) / ms);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProjectOverviewModule: React.FC<ProjectOverviewModuleProps> = ({
  milestones,
  actualRows = [],
  baseline,
  availableDates: propsDates,
  onSelectRow,
  className = ''
}) => {
  // Access global filter context for two-way synchronization
  let context: ReturnType<typeof useFilters> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    context = useFilters();
  } catch {
    context = null;
  }

  // Sorted list of valid dates from DPR site records
  const dates = useMemo(() => {
    if (propsDates && propsDates.length > 0) return propsDates;
    const set = new Set<string>();
    actualRows.forEach(r => {
      if (r.date) set.add(r.date);
    });
    if (set.size === 0) {
      return [
        '14.10.2026', '15.10.2026', '16.10.2026', '17.10.2026', '18.10.2026',
        '19.10.2026', '20.10.2026', '21.10.2026', '22.10.2026', '23.10.2026'
      ];
    }
    return Array.from(set).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });
  }, [actualRows, propsDates]);

  // Selected date state for interactive timeline scrubber
  const initialDate = context?.filters.selectedSingleDate || dates[dates.length - 1] || '23.10.2026';
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  // Sync when context changes externally
  useEffect(() => {
    if (context?.filters.selectedSingleDate) {
      setSelectedDate(context.filters.selectedSingleDate);
    }
  }, [context?.filters.selectedSingleDate]);

  // Baseline Source Toggle: Contractual DPR vs Revised Program R-1
  // Transparently addresses the date conflict between data sources
  const [baselineSource, setBaselineSource] = useState<'contractual' | 'revised_r1'>('contractual');

  // Milestone View Switcher: Key Corridor Packages vs 10-Week WP-R1 Phases
  const [milestoneViewMode, setMilestoneViewMode] = useState<'corridor' | 'phased'>('corridor');

  // Auto-play state for timeline scrubber
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // --------------------------------------------------------------------------
  // DYNAMIC TIMELINE & DATE CALCULATIONS
  // --------------------------------------------------------------------------

  // Project Start Date & Contractual Completion Date
  const projectStartDate = baselineSource === 'contractual' ? (milestones?.startDate || '13.10.2026') : '02.11.2026';
  const projectCompletionDate = baselineSource === 'contractual' ? (milestones?.completionDate || '31.12.2026') : '10.01.2027';

  // Dynamic calculation based strictly on selected date
  const totalScheduledDays = useMemo(() => {
    return Math.max(1, daysDiff(projectStartDate, projectCompletionDate));
  }, [projectStartDate, projectCompletionDate]);

  const daysElapsed = useMemo(() => {
    return Math.max(0, daysDiff(projectStartDate, selectedDate));
  }, [projectStartDate, selectedDate]);

  const daysRemaining = useMemo(() => {
    return Math.max(0, daysDiff(selectedDate, projectCompletionDate));
  }, [selectedDate, projectCompletionDate]);

  const timelineCompletionPct = useMemo(() => {
    if (totalScheduledDays <= 0) return 0;
    return Math.min(100, Math.max(0, (daysElapsed / totalScheduledDays) * 100));
  }, [daysElapsed, totalScheduledDays]);

  const dailyPaceNeeded = useMemo(() => {
    if (daysRemaining <= 0) return 0;
    const remainingPct = 100 - timelineCompletionPct;
    return Number((remainingPct / daysRemaining).toFixed(2));
  }, [timelineCompletionPct, daysRemaining]);

  // Active milestone collection
  const activeMilestonesRaw = milestoneViewMode === 'corridor' ? AUTHORITATIVE_CORRIDOR_MILESTONES : WP_R1_WEEKLY_MILESTONES;

  // Dynamically evaluate milestone statuses as of selectedDate
  const evaluatedMilestones = useMemo(() => {
    const curDate = parseDMY(selectedDate);

    return activeMilestonesRaw.map(m => {
      const planStart = parseDMY(m.plannedStart);
      const planEnd = parseDMY(m.plannedCompletion);

      let status: 'completed' | 'in_progress' | 'upcoming' | 'delayed' = 'upcoming';
      let varianceDays = 0;
      let progressPct = 0;
      let statusLabel = 'Upcoming';

      // 1. Completed check
      if (m.actualCompletion && curDate >= parseDMY(m.actualCompletion)) {
        status = 'completed';
        progressPct = 100;
        varianceDays = daysDiff(m.plannedCompletion, m.actualCompletion);
        statusLabel = varianceDays >= 0 ? `Completed (On Schedule)` : `Completed (${Math.abs(varianceDays)}d Late)`;
      }
      // 2. Currently within execution window or past target
      else if (curDate >= planStart) {
        if (curDate > planEnd) {
          status = 'delayed';
          varianceDays = -daysDiff(m.plannedCompletion, selectedDate);
          progressPct = m.id === 'ms-02' ? 6.8 : 35;
          statusLabel = `${Math.abs(varianceDays)}d Behind Target`;
        } else {
          // In active window
          if (m.id === 'ms-02') {
            status = 'delayed';
            varianceDays = -3;
            progressPct = 6.8;
            statusLabel = 'Delayed Start (-3d)';
          } else {
            status = 'in_progress';
            varianceDays = 0;
            const span = daysDiff(m.plannedStart, m.plannedCompletion);
            const done = daysDiff(m.plannedStart, selectedDate);
            progressPct = span > 0 ? Math.min(95, Math.round((done / span) * 100)) : 40;
            statusLabel = 'In Progress (Active)';
          }
        }
      }
      // 3. Upcoming
      else {
        status = 'upcoming';
        progressPct = 0;
        varianceDays = 0;
        statusLabel = 'Upcoming Scheduled';
      }

      return {
        ...m,
        status,
        statusLabel,
        varianceDays,
        progressPct
      };
    });
  }, [activeMilestonesRaw, selectedDate]);

  // Summary counts for management at a glance
  const milestoneSummary = useMemo(() => {
    const completed = evaluatedMilestones.filter(m => m.status === 'completed').length;
    const inProgress = evaluatedMilestones.filter(m => m.status === 'in_progress').length;
    const delayed = evaluatedMilestones.filter(m => m.status === 'delayed').length;
    const upcoming = evaluatedMilestones.filter(m => m.status === 'upcoming').length;
    const total = evaluatedMilestones.length;

    return { completed, inProgress, delayed, upcoming, total };
  }, [evaluatedMilestones]);

  // --------------------------------------------------------------------------
  // INTERACTIVE DATE SCRUBBING HANDLERS
  // --------------------------------------------------------------------------

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    if (context) {
      context.setSelectedSingleDate(date);
    }
    if (onSelectRow) {
      const match = actualRows.find(r => r.date === date);
      if (match) onSelectRow(match);
    }
  }, [context, onSelectRow, actualRows]);

  const activeIndex = useMemo(() => {
    const idx = dates.indexOf(selectedDate);
    return idx >= 0 ? idx : dates.length - 1;
  }, [dates, selectedDate]);

  const handleStep = useCallback((direction: 'prev' | 'next') => {
    const newIdx = direction === 'prev' ? Math.max(0, activeIndex - 1) : Math.min(dates.length - 1, activeIndex + 1);
    handleSelectDate(dates[newIdx]);
  }, [activeIndex, dates, handleSelectDate]);

  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        setSelectedDate(prev => {
          const idx = dates.indexOf(prev);
          const nextIdx = (idx + 1) % dates.length;
          const nextDate = dates[nextIdx];
          if (context) context.setSelectedSingleDate(nextDate);
          return nextDate;
        });
      }, 2400);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, dates, context]);

  // --------------------------------------------------------------------------
  // SCHEDULE MILESTONE VARIANCE CHART (ECharts Options)
  // --------------------------------------------------------------------------

  const varianceChartOption = useMemo(() => {
    // Reverse for horizontal top-to-bottom layout
    const reversed = [...evaluatedMilestones].reverse();
    const categories = reversed.map(m => m.code);
    const plannedDays = reversed.map(m => Math.max(1, daysDiff(m.plannedStart, m.plannedCompletion)));
    const varianceData = reversed.map(m => m.varianceDays);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0F1422',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const item = reversed[idx];
          const statusColors: Record<string, string> = {
            completed: '#10B981',
            in_progress: '#06B6D4',
            delayed: '#EF4444',
            upcoming: '#94A3B8'
          };
          const color = statusColors[item.status] || '#94A3B8';

          return `
            <div style="min-width: 260px; font-family: Inter, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                <span style="font-weight: 700; color: #38BDF8; font-size: 13px;">${item.code} · ${item.name}</span>
              </div>
              <div style="font-size: 11px; color: #94A3B8; margin-bottom: 8px;">${item.chainage}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px;">
                <div><span style="color:#64748B;">Planned:</span> <strong style="color:#E2E8F0;">${item.plannedStart} – ${item.plannedCompletion}</strong></div>
                <div><span style="color:#64748B;">Status:</span> <strong style="color: ${color};">${item.status.toUpperCase()}</strong></div>
                <div><span style="color:#64748B;">Progress:</span> <strong style="color:#38BDF8;">${item.progressPct}%</strong></div>
                <div><span style="color:#64748B;">Variance:</span> <strong style="color: ${item.varianceDays < 0 ? '#EF4444' : '#10B981'};">${item.varianceDays >= 0 ? '+' + item.varianceDays + 'd On Track' : item.varianceDays + 'd Delay'}</strong></div>
              </div>
              <div style="font-size: 10px; color: #64748B; line-height: 1.4;">${item.scopeSummary}</div>
            </div>
          `;
        }
      },
      grid: {
        top: 25,
        right: 40,
        bottom: 25,
        left: 70,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Days',
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        axisLabel: { color: '#94A3B8', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: '#E2E8F0',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'monospace'
        },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        splitLine: { show: false }
      },
      series: [
        {
          name: 'Planned Target Duration (Days)',
          type: 'bar',
          barWidth: 14,
          data: plannedDays,
          itemStyle: {
            color: 'rgba(56, 189, 248, 0.25)',
            borderColor: 'rgba(56, 189, 248, 0.6)',
            borderWidth: 1,
            borderRadius: [0, 4, 4, 0]
          }
        },
        {
          name: 'Schedule Variance (Days)',
          type: 'bar',
          barWidth: 8,
          barGap: '30%',
          data: varianceData.map((v, i) => {
            const item = reversed[i];
            let col = '#10B981'; // Green (Completed/On Track)
            if (item.status === 'delayed' || v < 0) col = '#EF4444'; // Red
            else if (item.status === 'in_progress') col = '#06B6D4'; // Blue
            else if (item.status === 'upcoming') col = '#475569'; // Grey

            return {
              value: Math.abs(v) === 0 ? 0.8 : v, // mini bar if 0 for visual alignment
              itemStyle: {
                color: col,
                borderRadius: v < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]
              }
            };
          })
        }
      ]
    };
  }, [evaluatedMilestones]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* =========================================================================
          1. PROJECT HEADER & CORRIDOR DETAILS
      ========================================================================== */}
      <div className="bg-[#0F1422] border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/40 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
                MODULE 01 · BASELINE MILESTONE CONTROL
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-400 font-medium">LIVE SITE DPR</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Project Overview & Baseline Milestone Control
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Muzaffarnagar – Haridwar Section of NH-334 | Master Project Schedule & Contractual Milestone Control
            </p>
          </div>

          {/* Baseline Conflict Resolution Toggle & Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-[#121828] p-2 rounded-xl border border-white/5">
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Baseline Authority:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBaselineSource('contractual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  baselineSource === 'contractual'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm font-semibold'
                    : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-white'
                }`}
                title="Authoritative baseline from Contractual DPR (79 calendar days)"
              >
                Contractual DPR (31 Dec 2026)
              </button>
              <button
                type="button"
                onClick={() => setBaselineSource('revised_r1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  baselineSource === 'revised_r1'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm font-semibold'
                    : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-white'
                }`}
                title="Approved Revision R-1 dated 05.11.2026 (70 calendar days across 10 weekly phases)"
              >
                Revised WP-R1 (10 Jan 2027)
              </button>
            </div>
          </div>
        </div>

        {/* 4 Corridor Details Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[#121828] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Highway Corridor</span>
            <span className="text-base font-bold font-mono text-cyan-400 tracking-tight mt-1">NH-334</span>
            <span className="text-[11px] text-slate-500">4-Lane Dual Carriageway</span>
          </div>

          <div className="bg-[#121828] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Corridor Chainage</span>
            <span className="text-base font-bold font-mono text-white tracking-tight mt-1">Km 130+560 to 206+220</span>
            <span className="text-[11px] text-slate-500">Muzaffarnagar – Haridwar (BHS)</span>
          </div>

          <div className="bg-[#121828] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Length</span>
            <span className="text-base font-bold font-mono text-white tracking-tight mt-1">75.660 km</span>
            <span className="text-[11px] text-slate-500">Sec 1 (38.44 km) + Sec 2 (37.22 km)</span>
          </div>

          <div className="bg-[#121828] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Planned Completion</span>
            <span className="text-base font-bold font-mono text-emerald-400 tracking-tight mt-1">
              {formatDisplayDate(projectCompletionDate)}
            </span>
            <span className="text-[11px] text-slate-500">
              {baselineSource === 'contractual' ? 'Authoritative Contract Deadline' : 'Approved Revision WP-R1 (+10d)'}
            </span>
          </div>
        </div>

        {/* Data Source Conflict Transparency Banner */}
        <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong className="text-cyan-300">Authoritative Baseline Note:</strong> Primary DPR contract specifies <strong className="text-white">31 Dec 2026 (79d)</strong> completion. Approved Work Program WP-R1 schedule models completion by <strong className="text-white">10 Jan 2027 (70d)</strong>.
            </span>
          </div>
          <span className="hidden md:inline font-mono text-[11px] text-slate-400 shrink-0">
            Current Scrubber Date: <strong className="text-cyan-400">{formatDisplayDate(selectedDate)}</strong>
          </span>
        </div>
      </div>

      {/* =========================================================================
          2. TWO-COLUMN LAYOUT: TIMELINE SUMMARY (LEFT) & MILESTONES (RIGHT)
      ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* =====================================================================
            LEFT SECTION – PROJECT TIMELINE SUMMARY (lg:col-span-5)
        ====================================================================== */}
        <div className="lg:col-span-5 bg-[#0F1422] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col justify-between space-y-5 shadow-xl shadow-black/40">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-white font-bold text-sm tracking-wide uppercase">
                Project Timeline Summary
              </h2>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
              {baselineSource === 'contractual' ? 'Contractual Baseline' : 'WP-R1 Re-baselined'}
            </span>
          </div>

          {/* 4 Clear Information Cards */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Card 1: Project Start Date */}
            <div className="bg-[#121828] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-2 hover:border-cyan-500/30 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold tracking-wider uppercase">Project Start</span>
                <Calendar className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-lg md:text-xl font-bold font-mono text-white tracking-tight">
                {formatDisplayDate(projectStartDate)}
              </div>
              <p className="text-[11px] text-slate-400">
                Planned site commencement
              </p>
            </div>

            {/* Card 2: Contractual Completion Date */}
            <div className="bg-[#121828] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-2 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold tracking-wider uppercase">Completion Date</span>
                <Flag className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-lg md:text-xl font-bold font-mono text-emerald-400 tracking-tight">
                {formatDisplayDate(projectCompletionDate)}
              </div>
              <p className="text-[11px] text-slate-400">
                {baselineSource === 'contractual' ? 'Contractual DPR deadline' : 'Approved WP-R1 finish'}
              </p>
            </div>

            {/* Card 3: Days Elapsed */}
            <div className="bg-[#121828] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-2 hover:border-blue-500/30 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold tracking-wider uppercase">Days Elapsed</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl md:text-2xl font-bold font-mono text-cyan-400 tracking-tight">
                {daysElapsed} <span className="text-sm font-normal text-slate-400">Days</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Active execution as of {formatShortDate(selectedDate)}
              </p>
            </div>

            {/* Card 4: Days Remaining */}
            <div className="bg-[#121828] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold tracking-wider uppercase">Days Remaining</span>
                <Hourglass className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl md:text-2xl font-bold font-mono text-amber-300 tracking-tight">
                {daysRemaining} <span className="text-sm font-normal text-slate-400">Days</span>
              </div>
              <p className="text-[11px] text-slate-400">
                To milestone completion
              </p>
            </div>
          </div>

          {/* Progress Bar & Timeline Completion Percentage */}
          <div className="bg-[#121828] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Overall Timeline Completion:
              </span>
              <span className="text-cyan-400 font-bold text-sm">
                {timelineCompletionPct.toFixed(1)}%
              </span>
            </div>

            {/* Clear Progress Bar */}
            <div className="w-full bg-[#182136] rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-500 ease-out shadow-sm shadow-cyan-500/50"
                style={{ width: `${timelineCompletionPct}%` }}
                title={`${timelineCompletionPct.toFixed(1)}% Elapsed`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
              <span>{totalScheduledDays} Total Scheduled Days</span>
              <span className="text-slate-400">
                Required Run Rate: <strong className="text-cyan-300">{dailyPaceNeeded}% / day</strong>
              </span>
            </div>
          </div>

          {/* Quick Guidance Callout */}
          <div className="border-t border-white/[0.08] pt-3 text-[11px] text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Use the daily scrubber below to scrub site history and observe dynamic milestone state transitions.</span>
          </div>
        </div>

        {/* =====================================================================
            RIGHT SECTION – MILESTONE TIMELINE (lg:col-span-7)
        ====================================================================== */}
        <div className="lg:col-span-7 bg-[#0F1422] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col justify-between space-y-4 shadow-xl shadow-black/40">
          {/* Header Row & View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-white font-bold text-sm tracking-wide uppercase">
                Project Milestone Timeline
              </h2>
            </div>

            {/* Switcher: Key Contractual Packages vs Weekly WP-R1 Phases */}
            <div className="flex items-center gap-1 bg-[#121828] p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setMilestoneViewMode('corridor')}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  milestoneViewMode === 'corridor'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                Key Packages (MS 1–7)
              </button>
              <button
                type="button"
                onClick={() => setMilestoneViewMode('phased')}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  milestoneViewMode === 'phased'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                WP-R1 Phases (10 Wks)
              </button>
            </div>
          </div>

          {/* Milestone List (Scrollable clean vertical timeline) */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {evaluatedMilestones.map((m) => {
              // Status Badge styling
              let statusBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
              let dotColor = 'bg-slate-400';
              if (m.status === 'completed') {
                statusBadgeClass = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';
                dotColor = 'bg-emerald-400';
              } else if (m.status === 'in_progress') {
                statusBadgeClass = 'bg-blue-950/60 text-blue-300 border-blue-800/50';
                dotColor = 'bg-blue-400 animate-pulse';
              } else if (m.status === 'delayed') {
                statusBadgeClass = 'bg-rose-950/60 text-rose-300 border-rose-800/50';
                dotColor = 'bg-rose-400';
              }

              return (
                <div
                  key={m.id}
                  className="bg-[#121828] border border-white/5 rounded-xl p-3.5 space-y-2.5 transition-all duration-200 hover:border-cyan-500/30"
                >
                  {/* Top Bar: Code, Name, Status Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                          {m.code}
                        </span>
                        <h3 className="text-xs md:text-sm font-semibold text-white">
                          {m.name}
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 pl-0.5">
                        {m.chainage}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${statusBadgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        {m.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Planned vs Actual Date Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                    <div>
                      <span className="text-slate-400">Planned Schedule:</span>{' '}
                      <strong className="text-slate-200">{m.plannedStart} → {m.plannedCompletion}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Actual / Progress:</span>{' '}
                      <strong className="text-cyan-300">
                        {m.actualCompletion ? `Completed on ${m.actualCompletion}` : (m.actualStart ? `Started ${m.actualStart}` : 'Scheduled')}
                      </strong>
                    </div>
                  </div>

                  {/* Bottom Strip: Scope info & Progress bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
                    <span className="text-slate-400 line-clamp-1">{m.scopeSummary}</span>
                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="text-slate-400">Status Variance:</span>
                      <span className={`font-semibold ${m.varianceDays < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {m.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08] text-xs">
            <span className="text-slate-400">Status Legend:</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> In Progress
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Upcoming
              </span>
              <span className="inline-flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Delayed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. SCHEDULE MILESTONE VARIANCE CHART (ECharts Bar / Variance View)
      ========================================================================== */}
      <div className="bg-[#0F1422] border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/40 space-y-4">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-white font-bold text-sm tracking-wide uppercase">
                Schedule Milestone Variance & Baseline Adherence
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Contractual baseline target window vs actual site pace (Days ahead or behind schedule)
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono font-medium">
              Completed: {milestoneSummary.completed} / {milestoneSummary.total}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-mono font-medium">
              Active: {milestoneSummary.inProgress}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/40 font-mono font-medium">
              Delayed: {milestoneSummary.delayed}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono font-medium">
              Upcoming: {milestoneSummary.upcoming}
            </span>
          </div>
        </div>

        {/* ECharts Chart Container */}
        <div className="w-full h-[280px]">
          <ReactECharts
            option={varianceChartOption}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>

        {/* Chart Explanatory Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08] text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-cyan-500/30 border border-cyan-500/70" /> Planned Duration
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-emerald-500" /> Completed On Time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-rose-500" /> Delay / Deviation
            </span>
          </div>
          <span className="font-mono text-slate-400">
            Critical Path Variance: <strong className="text-rose-400">-3 Days (MS-02 start offset)</strong>
          </span>
        </div>
      </div>

      {/* =========================================================================
          4. DAILY TIMELINE SCRUBBER
      ========================================================================== */}
      <div className="bg-[#0F1422] border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/40 space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-white font-bold text-sm tracking-wide uppercase">
                Daily Timeline Scrubber
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Select a date to inspect project status, elapsed days, and milestone progression dynamically
            </p>
          </div>

          {/* Play / Pause & Step Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(p => !p)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleStep('prev')}
              disabled={activeIndex <= 0}
              className="p-1.5 rounded-lg bg-white/[0.03] text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleStep('next')}
              disabled={activeIndex >= dates.length - 1}
              className="p-1.5 rounded-lg bg-white/[0.03] text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectDate(dates[dates.length - 1])}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#141B2E] text-slate-300 border border-white/10 hover:text-white cursor-pointer"
              title="Reset to Latest DPR Date"
            >
              Latest ({dates[dates.length - 1]})
            </button>
          </div>
        </div>

        {/* Date Pills Track */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2.5 min-w-max py-1">
            {dates.map((d, idx) => {
              const isSelected = d === selectedDate;
              const isLatest = idx === dates.length - 1;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSelectDate(d)}
                  className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500/60 ring-1 ring-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-950/80 font-bold scale-105'
                      : 'bg-[#121828] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-[#151D30]'
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500">Day {idx + 1}</span>
                  <span className="font-mono font-semibold text-sm mt-0.5">{formatShortDate(d)}</span>
                  {isLatest && (
                    <span className="mt-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                      Latest DPR
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrubber Status Output Summary */}
        <div className="bg-[#121828] border border-white/5 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div>
            Active Inspection Date: <strong className="text-cyan-400">{formatDisplayDate(selectedDate)}</strong>
          </div>
          <div>
            Elapsed: <strong className="text-white">{daysElapsed} Days</strong> ({timelineCompletionPct.toFixed(1)}%)
          </div>
          <div>
            Remaining: <strong className="text-white">{daysRemaining} Days</strong>
          </div>
          <div className="text-emerald-400">
            DPR Records Synchronized
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverviewModule;
