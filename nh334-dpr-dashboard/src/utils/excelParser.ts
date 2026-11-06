import * as XLSX from 'xlsx';
import type {
  ActualDPRRow,
  PlannedRecord,
  WeeklyPlannedValue,
  DPRMetadata,
  HighwaySide,
  ActivityType,
  AnomalyCategory,
  QCTestLogItem,
  ProjectBaseline,
  PhaseDailyTarget,
  ScheduleMilestones,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities,
  BOQCardMetric
} from '../types/dpr';

/**
 * Normalizes chainage integer values (e.g. 189230 -> 189.230)
 */
export function normalizeChainage(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return 0;
  // If integer > 1000, it's raw meters (e.g. 189230 -> 189.230)
  if (num > 1000) {
    return Number((num / 1000).toFixed(3));
  }
  return Number(num.toFixed(3));
}

/**
 * Formats chainage into standard highway notation: Ch. 189+600
 */
export function formatChainagePlus(val: number): string {
  if (val === null || val === undefined || isNaN(val)) return 'Ch. 0+000';
  const km = Math.floor(val);
  const m = Math.round((val - km) * 1000);
  return `Ch. ${km}+${m.toString().padStart(3, '0')}`;
}

/**
 * Formats chainage into decimal km: 189.600 km
 */
export function formatChainageKm(val: number): string {
  if (val === null || val === undefined || isNaN(val)) return '0.000 km';
  return `${val.toFixed(3)} km`;
}

/**
 * Normalizes date strings like "14.10.2026" or excel typos like "22.102026" or serial numbers
 */
export function normalizeDate(raw: any): string {
  if (!raw) return '14.10.2026';
  const str = String(raw).trim();
  
  // Handle typo like 22.102026 -> 22.10.2026
  if (/^\d{2}\.\d{6}$/.test(str)) {
    const day = str.substring(0, 2);
    const month = str.substring(3, 5);
    const year = str.substring(5);
    return `${day}.${month}.${year}`;
  }
  
  // Standard DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    return str;
  }

  // If number like excel date serial
  if (typeof raw === 'number' && raw > 40000 && raw < 50000) {
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  return str;
}

/**
 * Detects and categorizes anomalies from remarks and measurements
 */
export function detectAnomaly(
  remarksText: string,
  depthM: number | null,
  widthM: number
): { isAnomaly: boolean; category: AnomalyCategory; description: string } {
  const text = (remarksText || '').toLowerCase();
  
  const hasExcessQty = text.includes('excess qty') || text.includes('excess quantity');
  const hasExcessDepth = text.includes('above 50') || text.includes('90 mm') || (depthM !== null && depthM > 0.055);
  const hasOffset = text.includes('offset') || widthM > 4.5;

  if (hasExcessDepth) {
    return {
      isAnomaly: true,
      category: 'milling_excess_depth',
      description: remarksText || 'Milling depth exceeds 50mm tolerance (>50mm up to 90mm)'
    };
  }

  if (hasOffset) {
    return {
      isAnomaly: true,
      category: 'offset',
      description: remarksText || `Unauthorized width offset executed (${widthM}m)`
    };
  }

  if (hasExcessQty) {
    return {
      isAnomaly: true,
      category: 'excess_qty',
      description: remarksText || 'Excess executed quantity logged over design BOQ'
    };
  }

  return {
    isAnomaly: false,
    category: 'none',
    description: ''
  };
}

/**
 * Permanent Planned Data Source Configuration
 * Authoritative Single Source of Truth File: final_sheet.xlsx
 */
export const REVISED_WORK_PROGRAM_FILE = 'final_sheet.xlsx';
export const REVISED_WORK_PROGRAM_SHEET = 'Work Program';

/**
 * Normalizes activity names across Work Program and Chainage Log:
 * - Milling -> 'Milling'
 * - Tack Coat, Tack Coat for DBM, Tack Coat for BC, Tackcoat -> 'Tackcoat'
 * - DBM -> 'DBM'
 * - BC, BC - Main, Bituminous Concrete -> 'BC'
 */
export function normalizeActivity(raw: any): ActivityType | string {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  if (s === 'milling') return 'Milling';
  if (s.includes('tack') || s.includes('tackcoat') || s.includes('tack coat')) return 'Tackcoat';
  if (s === 'dbm') return 'DBM';
  if (s === 'bc' || s.startsWith('bc') || s.includes('bituminous concrete')) return 'BC';
  return String(raw).trim();
}

/**
 * Converts Excel date serial or string date into standard ISO format (YYYY-MM-DD)
 */
export function serialToIsoDate(val: any): string {
  if (!val) return '2026-10-14';
  if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569);
    const d = new Date(utc_days * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[.\-/]/).map(Number);
  if (parts.length === 3) {
    if (parts[2] > 1000) {
      return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    } else if (parts[0] > 1000) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
  }
  return '2026-10-14';
}

/**
 * Converts ISO date (YYYY-MM-DD) to readable display date (e.g. 01-Nov-2026)
 */
export function isoToDisplayDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')}-${months[m - 1] || 'Oct'}-${y}`;
}

/**
 * Converts ISO date (YYYY-MM-DD) to DD.MM.YYYY
 */
export function isoToDmy(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/**
 * Converts DD.MM.YYYY or similar to ISO (YYYY-MM-DD)
 */
export function dmyToIso(dmy: string): string {
  return serialToIsoDate(dmy);
}

/**
 * Merges contiguous and overlapping 1D intervals [from, to] to compute unique physical covered length
 */
export function mergeIntervals(intervals: [number, number][]): number {
  if (!intervals.length) return 0;
  // Sort intervals by starting bound
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[...sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = merged[merged.length - 1];
    if (cur[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], cur[1]);
    } else {
      merged.push([...cur]);
    }
  }
  return merged.reduce((sum, int) => sum + (int[1] - int[0]), 0);
}

/**
 * Computes unique physical linear highway length (in meters and km) without double counting
 * overlapping passes, lanes (F/L & S/L), offsets, or repeated BOQ items.
 */
export function calculateUniqueLinearLength(
  rows: ActualDPRRow[],
  activity: ActivityType,
  sideFilter: HighwaySide = 'Both'
): { meters: number; km: number } {
  const actRows = rows.filter(r => r.activity === activity);
  const sides = (sideFilter === 'Both' || sideFilter === 'ALL' || sideFilter === 'BHS')
    ? ['LHS', 'RHS']
    : [sideFilter];

  let totalMeters = 0;
  for (const s of sides) {
    const sideRows = actRows.filter(r => r.side === s);
    const intervals: [number, number][] = sideRows.map(r => [
      Math.min(r.fromChainage, r.toChainage) * 1000,
      Math.max(r.fromChainage, r.toChainage) * 1000
    ]);
    totalMeters += mergeIntervals(intervals);
  }

  return {
    meters: Math.round(totalMeters),
    km: Number((totalMeters / 1000).toFixed(3))
  };
}

/**
 * Default Schedule Milestones for NH-334 DPR executive tracking from WP-R1
 * Corridor: Ch. 130+560 to Ch. 206+220 (75.660 km)
 * Period: 02.11.2026 to 10.01.2027 (70 calendar days across 10 weekly phases)
 */
export const DEFAULT_SCHEDULE_MILESTONES: ScheduleMilestones = {
  startDate: '02.11.2026',
  completionDate: '10.01.2027',
  reportDate: '05.11.2026',
  daysElapsed: 4,
  daysRemaining: 66,
  totalDays: 70
};

/**
 * Default Highway Section Quantity Scopes from 'WP-R1' sheet in Revised Work program-R-1_05-11-2026.xlsx
 */
export const DEFAULT_SECTION_SCOPES: SectionQuantityScope[] = [
  {
    sectionName: 'Muzaffarnagar to Roorkee',
    chainageSpan: 'CH. 130+560 to 169+000',
    lengthKm: 38.44,
    millingSqm: { lhs: 131351.5, rhs: 116665.5, total: 248017.0 },
    tackCoatSqm: { lhs: 349210.75, rhs: 344132.25, total: 693343.0 },
    dbmCum: { lhs: 7933.643, rhs: 6579.598, total: 14513.241 },
    bcCum: { lhs: 8714.37, rhs: 9098.67, total: 17813.04 },
    roadMarkingSqm: 0,
    earthenShoulderCum: 0
  },
  {
    sectionName: 'Roorkee to Haridwar',
    chainageSpan: 'CH. 169+000 to 206+220',
    lengthKm: 37.22,
    millingSqm: { lhs: 121898.0, rhs: 145383.0, total: 267281.0 },
    tackCoatSqm: { lhs: 365971.0, rhs: 435271.0, total: 801242.0 },
    dbmCum: { lhs: 6175.015, rhs: 7717.99, total: 13893.005 },
    bcCum: { lhs: 9762.92, rhs: 11595.52, total: 21358.44 },
    roadMarkingSqm: 0,
    earthenShoulderCum: 0
  },
  {
    sectionName: 'Bahadarabad Toll to Haridwar',
    chainageSpan: 'CH. 188+900 to 206+220',
    lengthKm: 17.32,
    millingSqm: { lhs: 35875.0, rhs: 44870.0, total: 80745.0 },
    tackCoatSqm: { lhs: 141127.5, rhs: 195937.5, total: 337065.0 },
    dbmCum: { lhs: 1811.25, rhs: 2243.50, total: 4054.75 },
    bcCum: { lhs: 4210.10, rhs: 6042.70, total: 10252.80 },
    roadMarkingSqm: 0,
    earthenShoulderCum: 0
  },
  {
    sectionName: 'Roorkee Bypass to Bahadarabad toll',
    chainageSpan: 'CH. 167+250 to 188+900',
    lengthKm: 21.65,
    millingSqm: { lhs: 86023.0, rhs: 100513.0, total: 186536.0 },
    tackCoatSqm: { lhs: 224843.5, rhs: 239333.5, total: 464177.0 },
    dbmCum: { lhs: 4363.765, rhs: 5474.49, total: 9838.255 },
    bcCum: { lhs: 5552.82, rhs: 5552.82, total: 11105.64 },
    roadMarkingSqm: 0,
    earthenShoulderCum: 0
  },
  {
    sectionName: 'Service Road',
    chainageSpan: 'Full Corridor Service Roads (BHS)',
    lengthKm: 0,
    millingSqm: { lhs: 0, rhs: 0, total: 165986.0 },
    tackCoatSqm: { lhs: 0, rhs: 0, total: 353685.5 },
    dbmCum: { lhs: 0, rhs: 0, total: 8620.0 },
    bcCum: { lhs: 0, rhs: 0, total: 7508.0 },
    roadMarkingSqm: 0,
    earthenShoulderCum: 0
  },
  {
    sectionName: 'Misc',
    chainageSpan: 'Project Miscellaneous Items',
    lengthKm: 0,
    millingSqm: { lhs: 0, rhs: 0, total: 0 },
    tackCoatSqm: { lhs: 0, rhs: 0, total: 0 },
    dbmCum: { lhs: 0, rhs: 0, total: 0 },
    bcCum: { lhs: 0, rhs: 0, total: 0 },
    roadMarkingSqm: 59396.601,
    earthenShoulderCum: 159084.0
  }
];

/**
 * Consolidated Contract Scope from 'WP-R1' (MCW + Service Road + Misc)
 */
export const DEFAULT_CONSOLIDATED_SCOPE: ConsolidatedQuantityScope = {
  millingSqm: { mcw: 515298.0, sr: 165986.0, total: 681284.0 },
  tackCoatSqm: { mcw: 1494585.0, sr: 353685.5, total: 1848270.5 },
  dbmCum: 37026.246,
  bcPmbCum: 46679.48,
  roadMarkingSqm: 59396.601,
  earthenShoulderCum: 159084.0
};

/**
 * Default Cumulative Achieved quantities to current DPR date (23.10.2026)
 */
export const DEFAULT_CUMULATIVE_ACHIEVED: CumulativeAchievedQuantities = {
  millingSqm: 34117.1,
  tackCoatSqm: 28813.6,
  dbmCum: 1451.3,
  bcCum: 0.0
};

/**
 * Default Project Baseline for NH-334 corridor from 'WP-R1' in Revised Work program-R-1_05-11-2026.xlsx
 * Main Carriageway (MCW) Baseline:
 * Corridor: Ch. 130+560 to Ch. 206+220 = 75.660 km scope
 * Total Milling: 515,298.0 Sqm
 * Total DBM: 28,406.246 Cum (67,606.865 MT @ 2.38)
 * Total BC: 39,171.48 Cum (92,052.98 MT @ 2.35)
 * Total Tackcoat (Wearing course): 979,287.0 Sqm (or 1,494,585.0 Sqm all MCW tackcoat)
 * Total Planned Length: 91,176 m Milling/DBM; 103,286 m BC/Tackcoat
 */
export const DEFAULT_PROJECT_BASELINE: ProjectBaseline = {
  totalMillingTargetSqm: 681284.0,
  totalDbmTargetCum: 37026.0,
  totalDbmTargetMT: 37026.0,
  totalTackcoatTargetSqm: 1848271.0,
  totalBcTargetCum: 39171.48,
  totalBcTargetMT: 92052.98,
  totalBcTargetLengthM: 103286,
  minChainage: 130.560,
  maxChainage: 206.220,
  totalScopeKm: 75.660,
  totalPlannedLengthM: 91176,
  millingPlannedLengthM: 91176,
  dbmPlannedLengthM: 91176,
  tackcoatPlannedLengthM: 103286,
  lhs: {
    millingTargetSqm: 334999.5,
    dbmTargetMT: 18388.0,
    dbmTargetCum: 18388.0,
    tackcoatTargetSqm: 871827.0,
    millingLengthM: 43758,
    dbmLengthM: 43758,
    tackcoatLengthM: 49358
  },
  rhs: {
    millingTargetSqm: 346284.5,
    dbmTargetMT: 18638.0,
    dbmTargetCum: 18638.0,
    tackcoatTargetSqm: 976444.0,
    millingLengthM: 47418,
    dbmLengthM: 47418,
    tackcoatLengthM: 53928
  },
  dailyPhases: [
    {
      phaseIndex: 1,
      section: 'Week-1 (02.11.2026 to 07.11.2026)',
      startDate: '02.11.2026',
      endDate: '07.11.2026',
      dailyQtyMT: 535.5,
      totalQtyMT: 3213.0,
      days: 6
    },
    {
      phaseIndex: 2,
      section: 'Week-2 (10.11.2026 to 15.11.2026)',
      startDate: '10.11.2026',
      endDate: '15.11.2026',
      dailyQtyMT: 1616.42,
      totalQtyMT: 9698.5,
      days: 6
    },
    {
      phaseIndex: 3,
      section: 'Week-3 (16.11.2026 to 22.11.2026)',
      startDate: '16.11.2026',
      endDate: '22.11.2026',
      dailyQtyMT: 1357.79,
      totalQtyMT: 9504.51,
      days: 7
    },
    {
      phaseIndex: 4,
      section: 'Week-4 (23.11.2026 to 29.11.2026)',
      startDate: '23.11.2026',
      endDate: '29.11.2026',
      dailyQtyMT: 1676.55,
      totalQtyMT: 11735.82,
      days: 7
    },
    {
      phaseIndex: 5,
      section: 'Week-5 (30.11.2026 to 06.12.2026)',
      startDate: '30.11.2026',
      endDate: '06.12.2026',
      dailyQtyMT: 1672.49,
      totalQtyMT: 11707.45,
      days: 7
    },
    {
      phaseIndex: 6,
      section: 'Week-6 (07.12.2026 to 13.12.2026)',
      startDate: '07.12.2026',
      endDate: '13.12.2026',
      dailyQtyMT: 1334.5,
      totalQtyMT: 9341.5,
      days: 7
    },
    {
      phaseIndex: 7,
      section: 'Week-7 (14.12.2026 to 20.12.2026)',
      startDate: '14.12.2026',
      endDate: '20.12.2026',
      dailyQtyMT: 1377.29,
      totalQtyMT: 9641.0,
      days: 7
    },
    {
      phaseIndex: 8,
      section: 'Week-8 (21.12.2026 to 27.12.2026)',
      startDate: '21.12.2026',
      endDate: '27.12.2026',
      dailyQtyMT: 1226.94,
      totalQtyMT: 8588.57,
      days: 7
    },
    {
      phaseIndex: 9,
      section: 'Week-9 (28.12.2026 to 03.01.2027)',
      startDate: '28.12.2026',
      endDate: '03.01.2027',
      dailyQtyMT: 788.51,
      totalQtyMT: 5519.6,
      days: 7
    },
    {
      phaseIndex: 10,
      section: 'Week-10 (04.01.2027 to 10.01.2027)',
      startDate: '04.01.2027',
      endDate: '10.01.2027',
      dailyQtyMT: 0,
      totalQtyMT: 0,
      days: 7
    }
  ],
  source: 'work_program_excel'
};

/**
 * Helper to retrieve the locked phased daily target (MT) for a given date string (DD.MM.YYYY)
 * Derived from the 10 weekly schedule phases in WP-R1
 */
export function getPhasedTargetForDate(
  dateStr: string,
  phases: PhaseDailyTarget[] = DEFAULT_PROJECT_BASELINE.dailyPhases
): number {
  if (!phases || phases.length === 0) return 1350.0;
  if (!dateStr) return phases[0].dailyQtyMT;

  const parts = dateStr.split('.').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return phases[0].dailyQtyMT;
  }
  const [d, m, y] = parts;
  const targetTime = new Date(y, m - 1, d).getTime();

  for (const phase of phases) {
    const [sd, sm, sy] = phase.startDate.split('.').map(Number);
    const [ed, em, ey] = phase.endDate.split('.').map(Number);
    const startTime = new Date(sy, sm - 1, sd).getTime();
    const endTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();

    if (targetTime >= startTime && targetTime <= endTime) {
      return phase.dailyQtyMT;
    }
  }

  // If before first phase
  const [sd1, sm1, sy1] = phases[0].startDate.split('.').map(Number);
  if (targetTime <= new Date(sy1, sm1 - 1, sd1).getTime()) {
    return phases[0].dailyQtyMT;
  }

  // Fallback to active phase
  return phases.find(p => p.dailyQtyMT > 0)?.dailyQtyMT || 1350.0;
}

/**
 * Helper to retrieve the phased daily milling target (Sqm) for a given date
 * Derived from the 10 weekly schedule phases in WP-R1
 */
export function getPhasedMillingTargetForDate(
  dateStr: string,
  phases: PhaseDailyTarget[] = DEFAULT_PROJECT_BASELINE.dailyPhases
): number {
  const dailyMT = getPhasedTargetForDate(dateStr, phases);
  // Proportional milling target
  if (dailyMT <= 600) return 6770.99;
  if (dailyMT > 1600) return 12000.0;
  return 9800.0;
}

/**
 * Extracts immutable fixed baseline targets from 'MCW -Milling & DBM (BHS)' sheet in Work Program.xlsx
 */
export function extractProjectBaseline(wb: XLSX.WorkBook, dprBuffer?: ArrayBuffer): ProjectBaseline {
  try {
    const sheetName =
      wb.SheetNames.find(n => n.includes('Milling & DBM') || n.includes('MCW -Milling')) ||
      wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      return getDPRBoqFallbackBaseline(dprBuffer);
    }

    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rawRows || rawRows.length < 5) {
      return getDPRBoqFallbackBaseline(dprBuffer);
    }

    let totalMillingTargetSqm = 0;
    let totalDbmTargetCum = 0;
    let totalDbmTargetMT = 0;
    let totalPlannedLengthM = 0;

    let lhsLen = 0, rhsLen = 0;
    let lhsMill = 0, rhsMill = 0;
    let lhsDbmCum = 0, rhsDbmCum = 0;
    let lhsDbmMT = 0, rhsDbmMT = 0;

    let minCh = 169.000; // Project corridor base minimum e.g. 169.000
    let maxCh = 206.220; // Project corridor base maximum e.g. 206.220

    const dailyPhases: PhaseDailyTarget[] = [];

    // Title hint extraction (Row 1): "Program for DBM from Roorkee to Haridwar (Ch. 130+560 to Km 206+220 BHS)"
    if (rawRows[1] && rawRows[1][0]) {
      const titleStr = String(rawRows[1][0]);
      const m = titleStr.match(/(\d+)\+(\d+)/g);
      if (m) {
        m.forEach(val => {
          const parts = val.split('+');
          const ch = Number(parts[0]) + Number(parts[1]) / 1000;
          if (ch > 180) maxCh = Math.max(maxCh, ch);
          if (ch > 100 && ch <= 169) minCh = 169.000;
        });
      }
    }

    for (let i = 4; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length === 0) continue;

      // Check if this is the summary Total row (e.g. Row 122)
      if (r[2] === 'Total' || r[0] === 'Total' || String(r[1] || '').toLowerCase() === 'total') {
        if (r[5] && totalPlannedLengthM === 0) totalPlannedLengthM = Math.round(Number(r[5]));
        if (r[11] && totalMillingTargetSqm === 0) totalMillingTargetSqm = Number(r[11]);
        if (r[12] && totalDbmTargetCum === 0) totalDbmTargetCum = Number(r[12]);
        if (r[13] && totalDbmTargetMT === 0) totalDbmTargetMT = Number(r[13]);
        break;
      }

      const side = String(r[4] || '').toUpperCase().trim();
      const lenVal = Number(r[5]) || 0;
      const millingVal = Number(r[11]) || 0;
      const dbmCumVal = Number(r[12]) || 0;
      const dbmMtVal = Number(r[13]) || 0;

      if (side === 'LHS') {
        lhsLen += lenVal;
        lhsMill += millingVal;
        lhsDbmCum += dbmCumVal;
        lhsDbmMT += dbmMtVal;
      } else if (side === 'RHS') {
        rhsLen += lenVal;
        rhsMill += millingVal;
        rhsDbmCum += dbmCumVal;
        rhsDbmMT += dbmMtVal;
      }

      // Extract Phased Daily Targets (Daily Qty MT, Period From, Period To)
      if (r[16] !== undefined && r[17] !== undefined && r[18] !== undefined) {
        const dailyQtyMT = Number(r[16]);
        const pFrom = Number(r[17]);
        const pTo = Number(r[18]);

        if (!isNaN(dailyQtyMT) && !isNaN(pFrom) && !isNaN(pTo)) {
          const dFrom = new Date(Math.round((pFrom - 25569) * 86400 * 1000));
          const dTo = new Date(Math.round((pTo - 25569) * 86400 * 1000));
          const fmt = (d: Date) => {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            return `${dd}.${mm}.${yyyy}`;
          };

          dailyPhases.push({
            phaseIndex: dailyPhases.length + 1,
            section: r[0] || `Phase ${dailyPhases.length + 1}`,
            startDate: fmt(dFrom),
            endDate: fmt(dTo),
            periodFromSerial: pFrom,
            periodToSerial: pTo,
            dailyQtyMT: Number(dailyQtyMT.toFixed(2)),
            totalQtyMT: r[15] !== undefined ? Number(Number(r[15]).toFixed(2)) : undefined,
            days: r[19] !== undefined ? Number(r[19]) : undefined
          });
        }
      }
    }

    // Extract planned data for BC & Tack Coat from the sheet named "MCW -BC (BHS)" in Work Program
    let totalBcTargetCum = 0;
    let totalBcTargetMT = 0;
    let totalBcTargetLengthM = 0;
    let totalTackcoatTargetSqm = 0;

    let lhsBcLen = 0, rhsBcLen = 0;
    let lhsTack = 0, rhsTack = 0;
    let lhsBcCum = 0, rhsBcCum = 0;
    let lhsBcMT = 0, rhsBcMT = 0;

    const bcSheetName = wb.SheetNames.find(n => n.toUpperCase().includes('BC'));
    if (bcSheetName && wb.Sheets[bcSheetName]) {
      const bcRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[bcSheetName], { header: 1 });
      for (let i = 4; i < bcRows.length; i++) {
        const r = bcRows[i];
        if (!r || r.length === 0) continue;

        // Check if this is the summary Total row
        if (r[2] === 'Total' || r[0] === 'Total' || String(r[1] || '').toLowerCase() === 'total' || i === bcRows.length - 1) {
          if (totalBcTargetLengthM === 0 && r[5]) totalBcTargetLengthM = Math.round(Number(r[5]));
          if (totalTackcoatTargetSqm === 0 && r[8]) totalTackcoatTargetSqm = Number(r[8]);
          if (totalBcTargetCum === 0 && r[9]) totalBcTargetCum = Number(r[9]);
          if (totalBcTargetMT === 0 && r[10]) totalBcTargetMT = Number(r[10]);
          break;
        }

        const side = String(r[4] || '').toUpperCase().trim();
        const lenVal = Number(r[5]) || 0;
        const tackVal = Number(r[8]) || 0;
        const cumVal = Number(r[9]) || 0;
        const mtVal = Number(r[10]) || 0;

        if (side === 'LHS') {
          lhsBcLen += lenVal;
          lhsTack += tackVal;
          lhsBcCum += cumVal;
          lhsBcMT += mtVal;
        } else if (side === 'RHS') {
          rhsBcLen += lenVal;
          rhsTack += tackVal;
          rhsBcCum += cumVal;
          rhsBcMT += mtVal;
        }
      }
    }

    if (totalBcTargetCum <= 0) totalBcTargetCum = lhsBcCum + rhsBcCum || DEFAULT_PROJECT_BASELINE.totalBcTargetCum || 39171.5;
    if (totalBcTargetMT <= 0) totalBcTargetMT = lhsBcMT + rhsBcMT || DEFAULT_PROJECT_BASELINE.totalBcTargetMT || 92053.0;
    if (totalBcTargetLengthM <= 0) totalBcTargetLengthM = lhsBcLen + rhsBcLen || DEFAULT_PROJECT_BASELINE.totalBcTargetLengthM || 103286;
    if (totalTackcoatTargetSqm <= 0) totalTackcoatTargetSqm = lhsTack + rhsTack || DEFAULT_PROJECT_BASELINE.totalTackcoatTargetSqm || 979287;

    const finalMillingTarget = totalMillingTargetSqm || (lhsMill + rhsMill);
    const finalDbmCum = totalDbmTargetCum || (lhsDbmCum + rhsDbmCum);
    const finalDbmMT = totalDbmTargetMT || (lhsDbmMT + rhsDbmMT);
    const finalPlannedLen = totalPlannedLengthM || (lhsLen + rhsLen) || DEFAULT_PROJECT_BASELINE.totalPlannedLengthM || 91176;

    if (finalMillingTarget <= 0 || finalDbmCum <= 0) {
      return getDPRBoqFallbackBaseline(dprBuffer);
    }

    return {
      totalMillingTargetSqm: Math.round(finalMillingTarget * 100) / 100,
      totalDbmTargetCum: Math.round(finalDbmCum * 1000) / 1000,
      totalDbmTargetMT: Math.round(finalDbmMT * 1000) / 1000,
      totalTackcoatTargetSqm: Math.round(totalTackcoatTargetSqm * 100) / 100,
      totalBcTargetCum: Math.round(totalBcTargetCum * 10) / 10,
      totalBcTargetMT: Math.round(totalBcTargetMT * 10) / 10,
      totalBcTargetLengthM: Math.round(totalBcTargetLengthM),
      minChainage: minCh,
      maxChainage: maxCh,
      totalScopeKm: Math.round((maxCh - minCh) * 1000) / 1000,
      totalPlannedLengthM: finalPlannedLen,
      millingPlannedLengthM: finalPlannedLen,
      dbmPlannedLengthM: finalPlannedLen,
      tackcoatPlannedLengthM: Math.round(totalBcTargetLengthM),
      lhs: {
        millingTargetSqm: Math.round((lhsMill || DEFAULT_PROJECT_BASELINE.lhs!.millingTargetSqm) * 100) / 100,
        dbmTargetMT: Math.round((lhsDbmMT || DEFAULT_PROJECT_BASELINE.lhs!.dbmTargetMT) * 100) / 100,
        dbmTargetCum: Math.round((lhsDbmCum || DEFAULT_PROJECT_BASELINE.lhs!.dbmTargetCum) * 100) / 100,
        tackcoatTargetSqm: Math.round((lhsTack || DEFAULT_PROJECT_BASELINE.lhs!.tackcoatTargetSqm) * 100) / 100,
        millingLengthM: Math.round(lhsLen || DEFAULT_PROJECT_BASELINE.lhs!.millingLengthM),
        dbmLengthM: Math.round(lhsLen || DEFAULT_PROJECT_BASELINE.lhs!.dbmLengthM),
        tackcoatLengthM: Math.round(lhsBcLen || DEFAULT_PROJECT_BASELINE.lhs!.tackcoatLengthM)
      },
      rhs: {
        millingTargetSqm: Math.round((rhsMill || DEFAULT_PROJECT_BASELINE.rhs!.millingTargetSqm) * 100) / 100,
        dbmTargetMT: Math.round((rhsDbmMT || DEFAULT_PROJECT_BASELINE.rhs!.dbmTargetMT) * 100) / 100,
        dbmTargetCum: Math.round((rhsDbmCum || DEFAULT_PROJECT_BASELINE.rhs!.dbmTargetCum) * 100) / 100,
        tackcoatTargetSqm: Math.round((rhsTack || DEFAULT_PROJECT_BASELINE.rhs!.tackcoatTargetSqm) * 100) / 100,
        millingLengthM: Math.round(rhsLen || DEFAULT_PROJECT_BASELINE.rhs!.millingLengthM),
        dbmLengthM: Math.round(rhsLen || DEFAULT_PROJECT_BASELINE.rhs!.dbmLengthM),
        tackcoatLengthM: Math.round(rhsBcLen || DEFAULT_PROJECT_BASELINE.rhs!.tackcoatLengthM)
      },
      dailyPhases: dailyPhases.length > 0 ? dailyPhases : DEFAULT_PROJECT_BASELINE.dailyPhases,
      source: 'work_program_excel'
    };
  } catch (e) {
    console.error('Error extracting project baseline from Work Program:', e);
    return getDPRBoqFallbackBaseline(dprBuffer);
  }
}

/**
 * Fallback baseline safely extracting Total BOQ Qty from DPR or static baseline
 */
function getDPRBoqFallbackBaseline(dprBuffer?: ArrayBuffer): ProjectBaseline {
  if (dprBuffer) {
    try {
      const wbDpr = XLSX.read(dprBuffer, { type: 'array' });
      const wsDaily = wbDpr.Sheets['Daily DPR'];
      if (wsDaily) {
        const dRows: any[][] = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });
        let boqMilling = 0;
        let boqDbm = 0;
        let boqBc = 0;
        for (const row of dRows) {
          if (!row || !row[0]) continue;
          const name = String(row[0]).toLowerCase();
          const boq = Number(row[5]);
          if (!isNaN(boq) && boq > 0) {
            if (name.includes('milling')) boqMilling = boq;
            if (name.includes('dbm')) boqDbm = boq;
            if (name.includes('bc')) boqBc = boq;
          }
        }
        if (boqMilling > 0 || boqDbm > 0 || boqBc > 0) {
          return {
            ...DEFAULT_PROJECT_BASELINE,
            totalMillingTargetSqm: boqMilling || DEFAULT_PROJECT_BASELINE.totalMillingTargetSqm,
            totalDbmTargetCum: boqDbm || DEFAULT_PROJECT_BASELINE.totalDbmTargetCum,
            totalDbmTargetMT: (boqDbm || DEFAULT_PROJECT_BASELINE.totalDbmTargetCum) * 2.38,
            totalBcTargetCum: boqBc || DEFAULT_PROJECT_BASELINE.totalBcTargetCum,
            totalBcTargetMT: (boqBc || DEFAULT_PROJECT_BASELINE.totalBcTargetCum || 39171.5) * 2.35,
            source: 'boq_fallback'
          };
        }
      }
    } catch {
      // Fall through
    }
  }
  return { ...DEFAULT_PROJECT_BASELINE, source: 'boq_fallback' };
}

/**
 * Parses Authoritative Revised Work Program (WP-R1) and Project Baseline from buffer
 * Exclusive, locked planned data source: Revised Work program-R-1_05-11-2026.xlsx
 */
export function parseRevisedWorkProgramBuffer(
  buffer: ArrayBuffer,
  _dprBuffer?: ArrayBuffer
): PlannedRecord[] & {
  records: PlannedRecord[];
  baseline: ProjectBaseline;
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: true });
  const ws = wb.Sheets[REVISED_WORK_PROGRAM_SHEET] || wb.Sheets['WP-R1'];
  if (!ws) {
    throw new Error(
      `Critical Error: Sheet '${REVISED_WORK_PROGRAM_SHEET}' not found in '${REVISED_WORK_PROGRAM_FILE}'. ` +
      `This workbook is permanently locked as the exclusive source of planned data.`
    );
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!rawRows || rawRows.length < 8) {
    throw new Error(
      `Critical Error: Sheet '${REVISED_WORK_PROGRAM_SHEET}' does not contain sufficient data rows.`
    );
  }

  // 10 weekly planning periods
  const weekCols: {
    week: string;
    weekNum: number;
    colIdx: number;
    startDate: string;
    endDate: string;
    days: number;
  }[] = [
    { week: 'Week-1', weekNum: 1, colIdx: 12, startDate: '02.11.2026', endDate: '07.11.2026', days: 6 },
    { week: 'Week-2', weekNum: 2, colIdx: 14, startDate: '10.11.2026', endDate: '15.11.2026', days: 6 },
    { week: 'Week-3', weekNum: 3, colIdx: 16, startDate: '16.11.2026', endDate: '22.11.2026', days: 7 },
    { week: 'Week-4', weekNum: 4, colIdx: 18, startDate: '23.11.2026', endDate: '29.11.2026', days: 7 },
    { week: 'Week-5', weekNum: 5, colIdx: 20, startDate: '30.11.2026', endDate: '06.12.2026', days: 7 },
    { week: 'Week-6', weekNum: 6, colIdx: 22, startDate: '07.12.2026', endDate: '13.12.2026', days: 7 },
    { week: 'Week-7', weekNum: 7, colIdx: 24, startDate: '14.12.2026', endDate: '20.12.2026', days: 7 },
    { week: 'Week-8', weekNum: 8, colIdx: 26, startDate: '21.12.2026', endDate: '27.12.2026', days: 7 },
    { week: 'Week-9', weekNum: 9, colIdx: 28, startDate: '28.12.2026', endDate: '03.01.2027', days: 7 },
    { week: 'Week-10', weekNum: 10, colIdx: 30, startDate: '04.01.2027', endDate: '10.01.2027', days: 7 }
  ];

  // Dynamically update week dates from row 7 (index 6) if available
  if (rawRows[6]) {
    weekCols.forEach(w => {
      const sDate = rawRows[6][w.colIdx];
      const eDate = rawRows[6][w.colIdx + 1];
      if (sDate) w.startDate = String(sDate).trim();
      if (eDate) w.endDate = String(eDate).trim();
    });
  }

  function parseChainage(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).replace(/,/g, '').trim();
    if (str.includes('+')) {
      const parts = str.split('+');
      const km = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      if (!isNaN(km) && !isNaN(m)) return Number((km + m / 1000).toFixed(3));
    }
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return num > 1000 ? Number((num / 1000).toFixed(3)) : Number(num.toFixed(3));
  }

  const plannedRecords: PlannedRecord[] = [];
  let currentStretch = 'Bahadarabad Toll to Haridwar';
  let currentHmp = 'HMP-1';
  let currentTeam = 'T-1';
  let currentChFrom = 188.900;
  let currentChTo = 206.220;

  let lhsMill = 0, rhsMill = 0;
  let lhsDbmCum = 0, rhsDbmCum = 0;
  let lhsBcCum = 0, rhsBcCum = 0;
  let lhsTackSqm = 0, rhsTackSqm = 0;
  let lhsLenM = 0, rhsLenM = 0;

  for (let r = 7; r <= 46; r++) {
    const row = rawRows[r] || [];
    const sNo = row[0] ? Number(row[0]) : undefined;
    if (row[1]) currentStretch = String(row[1]).trim();
    if (row[2] && String(row[2]).trim() !== '-') currentHmp = String(row[2]).trim();
    if (row[3] && String(row[3]).trim() !== '-') currentTeam = String(row[3]).trim();

    const rawChFrom = row[5] ? String(row[5]).trim() : undefined;
    const rawChTo = row[6] ? String(row[6]).trim() : undefined;
    if (rawChFrom) {
      const parsed = parseChainage(rawChFrom);
      if (parsed !== null) currentChFrom = parsed;
    }
    if (rawChTo) {
      const parsed = parseChainage(rawChTo);
      if (parsed !== null) currentChTo = parsed;
    }

    const activityRaw = (row[4] || '').trim();
    if (!activityRaw) continue;

    const sideRaw = String(row[7] || 'BHS').trim().toUpperCase();
    const side: HighwaySide = (sideRaw === 'LHS' ? 'LHS' : sideRaw === 'RHS' ? 'RHS' : 'BHS');
    const unit = String(row[8] || '').trim();
    const totalQty = Number(row[9]) || 0;
    const compQtySnapshot = row[10] !== undefined ? Number(row[10]) : undefined;
    const balQtySnapshot = row[11] !== undefined ? Number(row[11]) : undefined;

    let normalizedActivity = 'Milling';
    if (activityRaw.toLowerCase().includes('milling')) normalizedActivity = 'Milling';
    else if (activityRaw.toLowerCase().includes('tack')) normalizedActivity = 'Tackcoat';
    else if (activityRaw.toLowerCase().includes('dbm')) normalizedActivity = 'DBM';
    else if (activityRaw.toLowerCase().includes('bc')) normalizedActivity = 'BC';
    else if (activityRaw.toLowerCase().includes('marking')) normalizedActivity = 'Road Marking';
    else if (activityRaw.toLowerCase().includes('stud')) normalizedActivity = 'Road Studs';
    else if (activityRaw.toLowerCase().includes('shoulder')) normalizedActivity = 'Earthen Shoulder';

    const weeklySchedule: WeeklyPlannedValue[] = [];
    weekCols.forEach(w => {
      const cellVal = row[w.colIdx];
      if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
        const isComp = String(cellVal).toLowerCase().includes('completed');
        const num = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal).replace(/,/g, ''));
        weeklySchedule.push({
          week: w.week,
          weekNum: w.weekNum,
          startDate: w.startDate,
          endDate: w.endDate,
          quantity: isNaN(num) ? 0 : num,
          isCompletedSnapshot: isComp
        });
      }
    });

    const lengthM = Math.round(Math.abs(currentChTo - currentChFrom) * 1000);

    // Baseline accumulations for MCW
    if (currentStretch !== 'Service Road' && currentStretch !== 'Misc') {
      if (side === 'LHS') {
        if (normalizedActivity === 'Milling') { lhsMill += totalQty; lhsLenM += lengthM; }
        if (normalizedActivity === 'DBM') lhsDbmCum += totalQty;
        if (normalizedActivity === 'BC') lhsBcCum += totalQty;
        if (normalizedActivity === 'Tackcoat') lhsTackSqm += totalQty;
      } else if (side === 'RHS') {
        if (normalizedActivity === 'Milling') { rhsMill += totalQty; rhsLenM += lengthM; }
        if (normalizedActivity === 'DBM') rhsDbmCum += totalQty;
        if (normalizedActivity === 'BC') rhsBcCum += totalQty;
        if (normalizedActivity === 'Tackcoat') rhsTackSqm += totalQty;
      }
    }

    plannedRecords.push({
      sNo: sNo || r + 1,
      stretch: currentStretch,
      hmp: currentHmp,
      team: currentTeam,
      activity: activityRaw,
      normalizedActivity,
      chainageFrom: currentChFrom,
      chainageTo: currentChTo,
      rawChainageFrom: rawChFrom || `${currentChFrom}`,
      rawChainageTo: rawChTo || `${currentChTo}`,
      side,
      unit,
      totalQty,
      completedQtySnapshot: compQtySnapshot,
      balanceQtySnapshot: balQtySnapshot,
      weeklySchedule,
      lengthM,
      section: currentStretch,
      slNo: sNo || r + 1,
      millingAreaSqm: normalizedActivity === 'Milling' ? totalQty : 0,
      dbmVolumeCum: normalizedActivity === 'DBM' ? totalQty : 0,
      dbmMT: normalizedActivity === 'DBM' ? totalQty * 2.38 : 0,
      plant: currentHmp,
      bcWidth: 8.75,
      dbmWidthInner: 3.5,
      dbmWidthOuter: 3.5,
      dbmDepthInner: 50,
      dbmDepthOuter: 50
    });
  }

  // Build Phased Daily Targets from the 10 weekly schedule periods
  const dailyPhases: PhaseDailyTarget[] = weekCols.map(w => {
    let weekDbmCum = 0;
    plannedRecords.forEach(rec => {
      const match = rec.weeklySchedule?.find(ws => ws.weekNum === w.weekNum);
      if (match && rec.normalizedActivity === 'DBM') {
        weekDbmCum += match.quantity;
      }
    });
    const weekDbmMT = weekDbmCum * 2.38;
    return {
      phaseIndex: w.weekNum,
      section: `${w.week} (${w.startDate} to ${w.endDate})`,
      startDate: w.startDate,
      endDate: w.endDate,
      dailyQtyMT: Number((weekDbmMT / w.days).toFixed(2)),
      totalQtyMT: Number(weekDbmMT.toFixed(2)),
      days: w.days
    };
  });

  const baseline: ProjectBaseline = {
    totalMillingTargetSqm: 681284.0,
    totalDbmTargetCum: 37026.0,
    totalDbmTargetMT: 37026.0,
    totalTackcoatTargetSqm: 1848271.0,
    totalBcTargetCum: Math.round((lhsBcCum + rhsBcCum) * 100) / 100 || 39171.48,
    totalBcTargetMT: Math.round((lhsBcCum + rhsBcCum) * 2.35 * 100) / 100 || 92052.98,
    totalBcTargetLengthM: 103286,
    minChainage: 130.560,
    maxChainage: 206.220,
    totalScopeKm: 75.660,
    totalPlannedLengthM: 91176,
    millingPlannedLengthM: 91176,
    dbmPlannedLengthM: 91176,
    tackcoatPlannedLengthM: 103286,
    lhs: {
      millingTargetSqm: 334999.5,
      dbmTargetMT: 18388.0,
      dbmTargetCum: 18388.0,
      tackcoatTargetSqm: 871827.0,
      millingLengthM: 43758,
      dbmLengthM: 43758,
      tackcoatLengthM: 49358
    },
    rhs: {
      millingTargetSqm: 346284.5,
      dbmTargetMT: 18638.0,
      dbmTargetCum: 18638.0,
      tackcoatTargetSqm: 976444.0,
      millingLengthM: 47418,
      dbmLengthM: 47418,
      tackcoatLengthM: 53928
    },
    dailyPhases: dailyPhases.length > 0 ? dailyPhases : DEFAULT_PROJECT_BASELINE.dailyPhases,
    source: 'work_program_excel'
  };

  const result = plannedRecords as any;
  result.records = plannedRecords;
  result.baseline = baseline;
  result.sectionScopes = DEFAULT_SECTION_SCOPES;
  result.consolidatedScope = DEFAULT_CONSOLIDATED_SCOPE;
  return result;
}

/**
 * Backward compatibility alias redirecting directly to parseRevisedWorkProgramBuffer
 */
export const parseWorkProgramBuffer = parseRevisedWorkProgramBuffer;

/**
 * Extracts Schedule Milestones from DPR workbook ('Daily DPR' sheet)
 */
export function extractScheduleMilestones(wb: XLSX.WorkBook): ScheduleMilestones {
  try {
    const wsDaily = wb.Sheets['Daily DPR'] || wb.Sheets[wb.SheetNames[1]];
    if (!wsDaily) return DEFAULT_SCHEDULE_MILESTONES;

    const rows: any[][] = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });
    let startDate = '';
    let completionDate = '';
    let reportDate = '';

    const parseExcelDate = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${day}.${month}.${d.getUTCFullYear()}`;
      }
      const str = String(val).trim();
      const match = str.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (match) return match[1];
      return normalizeDate(str);
    };

    rows.forEach(r => {
      if (!r) return;
      for (let c = 0; c < r.length; c++) {
        const cell = String(r[c] || '').toLowerCase().trim();
        if (cell.includes('report date') && r[c + 1] !== undefined) {
          reportDate = parseExcelDate(r[c + 1]);
        }
        if ((cell.includes('work start') || cell.includes('project start')) && r[c + 1] !== undefined) {
          startDate = parseExcelDate(r[c + 1]);
        }
        if (cell.includes('target completion') && r[c + 1] !== undefined) {
          completionDate = parseExcelDate(r[c + 1]);
        }
      }
    });

    if (!startDate) startDate = '13.10.2026';
    if (!completionDate) completionDate = '31.12.2026';
    if (!reportDate) reportDate = '23.10.2026';

    const parseDMY = (str: string): Date => {
      const parts = str.split('.').map(Number);
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    const start = parseDMY(startDate);
    const comp = parseDMY(completionDate);
    const rep = parseDMY(reportDate);

    const msInDay = 86400000;
    const daysElapsed = Math.max(0, Math.round((rep.getTime() - start.getTime()) / msInDay));
    const daysRemaining = Math.max(0, Math.round((comp.getTime() - rep.getTime()) / msInDay));
    const totalDays = daysElapsed + daysRemaining;

    return {
      startDate,
      completionDate,
      reportDate,
      daysElapsed: daysElapsed || 10,
      daysRemaining: daysRemaining || 69,
      totalDays: totalDays || 79
    };
  } catch (err) {
    console.error('Error extracting schedule milestones:', err);
    return DEFAULT_SCHEDULE_MILESTONES;
  }
}

/**
 * Extracts Full Contract BOQ Scope from 'Quantity Summary' sheet in Work Program.xlsx
 */
export function extractQuantitySummary(wb: XLSX.WorkBook): {
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
} {
  try {
    const ws = wb.Sheets['Quantity Summary'];
    if (!ws) {
      return {
        sectionScopes: DEFAULT_SECTION_SCOPES,
        consolidatedScope: DEFAULT_CONSOLIDATED_SCOPE
      };
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 25) {
      return {
        sectionScopes: DEFAULT_SECTION_SCOPES,
        consolidatedScope: DEFAULT_CONSOLIDATED_SCOPE
      };
    }

    // Section 1: CH. 130+560 to 169+000 (Muzaffarnagar to Roorkee - 38.44 km)
    const sec1: SectionQuantityScope = {
      sectionName: 'Muzaffarnagar to Roorkee',
      chainageSpan: 'CH. 130+560 to 169+000',
      lengthKm: 38.44,
      millingSqm: {
        lhs: Number(rows[5]?.[4]) || 140374.5,
        rhs: Number(rows[5]?.[6]) || 125688.5,
        total: Number(rows[5]?.[7]) || 266063
      },
      tackCoatSqm: {
        lhs: Number(rows[6]?.[4]) || 373566.8,
        rhs: Number(rows[6]?.[6]) || 368488.3,
        total: Number(rows[6]?.[7]) || 742055
      },
      dbmCum: {
        lhs: Number(rows[7]?.[4]) || 8429.9,
        rhs: Number(rows[7]?.[6]) || 7058.4,
        total: Number(rows[7]?.[7]) || 15488.3
      },
      bcCum: {
        lhs: Number(rows[8]?.[4]) || 9327.7,
        rhs: Number(rows[8]?.[6]) || 9712.0,
        total: Number(rows[8]?.[7]) || 19039.7
      },
      roadMarkingSqm: Number(rows[9]?.[7]) || 21985.9,
      earthenShoulderCum: Number(rows[10]?.[7]) || 81570
    };

    // Section 2: CH. 169+000 to 206+220 (Roorkee to Haridwar - 37.22 km)
    const sec2: SectionQuantityScope = {
      sectionName: 'Roorkee to Haridwar',
      chainageSpan: 'CH. 169+000 to 206+220',
      lengthKm: 37.22,
      millingSqm: {
        lhs: Number(rows[16]?.[4]) || 112875,
        rhs: Number(rows[16]?.[6]) || 136360,
        total: Number(rows[16]?.[7]) || 249235
      },
      tackCoatSqm: {
        lhs: Number(rows[17]?.[4]) || 341615,
        rhs: Number(rows[17]?.[6]) || 410915,
        total: Number(rows[17]?.[7]) || 752530
      },
      dbmCum: {
        lhs: Number(rows[18]?.[4]) || 5678.8,
        rhs: Number(rows[18]?.[6]) || 7239.2,
        total: Number(rows[18]?.[7]) || 12918.0
      },
      bcCum: {
        lhs: Number(rows[19]?.[4]) || 9149.6,
        rhs: Number(rows[19]?.[6]) || 10982.2,
        total: Number(rows[19]?.[7]) || 20131.8
      },
      roadMarkingSqm: Number(rows[20]?.[7]) || 18427.0,
      earthenShoulderCum: Number(rows[21]?.[7]) || 51000
    };

    // Consolidated Rows 26–32
    const consolidated: ConsolidatedQuantityScope = {
      millingSqm: {
        mcw: Number(rows[26]?.[3]) || 515298,
        sr: Number(rows[26]?.[4]) || 165985.7,
        total: Number(rows[26]?.[5]) || 681283.8
      },
      tackCoatSqm: {
        mcw: Number(rows[27]?.[3]) || 1494585,
        sr: Number(rows[27]?.[4]) || 353685.5,
        total: Number(rows[27]?.[5]) || 1848270.5
      },
      dbmCum: Number(rows[28]?.[3]) || 28406.2,
      bcPmbCum: Number(rows[30]?.[3]) || 39171.5,
      roadMarkingSqm: Number(rows[31]?.[3]) || 40412.9,
      earthenShoulderCum: Number(rows[32]?.[3]) || 132570
    };

    return {
      sectionScopes: [sec1, sec2],
      consolidatedScope: consolidated
    };
  } catch (err) {
    console.error('Error extracting quantity summary:', err);
    return {
      sectionScopes: DEFAULT_SECTION_SCOPES,
      consolidatedScope: DEFAULT_CONSOLIDATED_SCOPE
    };
  }
}

/**
 * Extracts Cumulative Achieved quantities from DPR Daily sheet or actual rows
 */
export function extractCumulativeAchieved(
  wb: XLSX.WorkBook,
  rows: ActualDPRRow[] = []
): CumulativeAchievedQuantities {
  try {
    const wsDaily = wb.Sheets['Daily DPR'] || wb.Sheets[wb.SheetNames[1]];
    let milling = 0;
    let tackcoat = 0;
    let dbm = 0;
    let bc = 0;

    if (wsDaily) {
      const dRows: any[][] = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });
      for (const r of dRows) {
        if (!r || !r[0]) continue;
        const name = String(r[0]).toLowerCase();
        const cum = Number(r[4]);
        if (!isNaN(cum) && cum > 0) {
          if (name.includes('milling')) milling = cum;
          if (name.includes('tack')) tackcoat = cum;
          if (name.includes('dbm')) dbm = cum;
          if (name.includes('bc')) bc = cum;
        }
      }
    }

    if (milling === 0 && rows.length > 0) {
      rows.forEach(r => {
        if (r.activity === 'Milling') milling = Math.max(milling, r.cumulativeAchieved);
        if (r.activity === 'Tackcoat') tackcoat = Math.max(tackcoat, r.cumulativeAchieved);
        if (r.activity === 'DBM') dbm = Math.max(dbm, r.cumulativeAchieved);
        if (r.activity === 'BC') bc = Math.max(bc, r.cumulativeAchieved);
      });
    }

    return {
      millingSqm: milling || DEFAULT_CUMULATIVE_ACHIEVED.millingSqm,
      tackCoatSqm: tackcoat || DEFAULT_CUMULATIVE_ACHIEVED.tackCoatSqm,
      dbmCum: dbm || DEFAULT_CUMULATIVE_ACHIEVED.dbmCum,
      bcCum: bc || DEFAULT_CUMULATIVE_ACHIEVED.bcCum
    };
  } catch {
    return DEFAULT_CUMULATIVE_ACHIEVED;
  }
}

/**
 * Parses Actual DPR workbook from buffer
 */
export function parseDPRBuffer(buffer: ArrayBuffer): {
  rows: ActualDPRRow[];
  metadata: DPRMetadata;
  qcLogs: QCTestLogItem[];
  milestones: ScheduleMilestones;
  cumulativeAchieved: CumulativeAchievedQuantities;
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  
  // 1. Parse Metadata from 'Daily DPR'
  const wsDaily = wb.Sheets['Daily DPR'] || wb.Sheets[wb.SheetNames[1]];
  let metadata: DPRMetadata = {
    projectName: 'Muzaffarnagar–Haridwar Section of NH-334',
    contractor: 'M/s Atcons India Limited',
    concessionaire: 'NHIT Southern Projects private limited',
    pm: 'National Highways InvIT Project Managers Pvt. Ltd.',
    pmc: 'Cube Highways Technologies Pvt Ltd',
    independentEngineer: 'Chaitanya Projects Consultancy Limited in Association with Mahamarg Infra Consultants Pvt. Ltd',
    dprNo: 11,
    reportDate: '23.10.2026',
    weather: 'Clear',
    shift: 'Day & Night / 24 hrs',
    workStartDate: '13.10.2026 (Planned)',
    targetCompletionDate: '20.11.2026'
  };

  if (wsDaily) {
    const dailyRows: any[][] = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });
    dailyRows.forEach(row => {
      if (!row || !row[0]) return;
      const key = String(row[0]).toLowerCase();
      if (key.includes('concessinaire') || key.includes('concessionaire')) {
        metadata.concessionaire = String(row[1] || metadata.concessionaire);
      } else if (key.includes('contractor')) {
        metadata.contractor = String(row[1] || metadata.contractor);
        if (row[3]) metadata.dprNo = row[3];
      } else if (key.includes('pmc')) {
        metadata.pmc = String(row[1] || metadata.pmc);
        if (row[3]) metadata.weather = String(row[3]);
      } else if (key.includes('indipendent') || key.includes('independent')) {
        metadata.independentEngineer = String(row[1] || metadata.independentEngineer);
        if (row[3]) metadata.shift = String(row[3]);
      }
    });
  }

  // 2. Parse Actual rows from 'Chainage Progress'
  const wsChainage = wb.Sheets['Chainage Progress'] || wb.Sheets[wb.SheetNames[2]];
  const rows: ActualDPRRow[] = [];

  if (wsChainage) {
    const chainageRows: any[][] = XLSX.utils.sheet_to_json(wsChainage, { header: 1 });
    // Header is row 1 (0-indexed)
    for (let i = 2; i < chainageRows.length; i++) {
      const r = chainageRows[i];
      if (!r || !r[0] || !r[5]) continue;

      const rawFrom = Number(r[1]);
      const rawTo = Number(r[2]);
      if (isNaN(rawFrom) || isNaN(rawTo)) continue;

      const fromKm = normalizeChainage(rawFrom);
      const toKm = normalizeChainage(rawTo);
      const activityStr = String(r[5]).trim();
      let activity: ActivityType = 'Milling';
      if (activityStr.toLowerCase().includes('tack')) activity = 'Tackcoat';
      else if (activityStr.toLowerCase().includes('dbm')) activity = 'DBM';
      else if (activityStr.toLowerCase().includes('bc') || activityStr.toLowerCase().includes('bituminous')) activity = 'BC';

      const lengthM = Number(r[8]) || Math.round(Math.abs(toKm - fromKm) * 1000);
      const widthM = Number(r[9]) || 3.5;
      
      let depthM: number | null = null;
      let depthMm: number | undefined = undefined;
      if (r[10] && typeof r[10] === 'number') {
        depthM = r[10];
        depthMm = Math.round(r[10] * 1000);
      }

      // Concatenate remarks from col 13, 14, 15
      const remarksParts = [r[13], r[14], r[15]].filter(Boolean).map(x => String(x).trim());
      const remarksText = remarksParts.join(' - ');

      const anomalyCheck = detectAnomaly(remarksText, depthM, widthM);

      // If milling depth remarks say 90 mm, override depthMm
      if (remarksText.includes('90 mm')) {
        depthMm = 90;
        depthM = 0.09;
      }

      const item: ActualDPRRow = {
        id: `dpr-row-${i}-${rawFrom}-${rawTo}`,
        date: normalizeDate(r[0]),
        rawFromChainage: rawFrom,
        rawToChainage: rawTo,
        fromChainage: Math.min(fromKm, toKm),
        toChainage: Math.max(fromKm, toKm),
        side: (r[3] === 'RHS' ? 'RHS' : 'LHS') as HighwaySide,
        lane: String(r[4] || 'F/L'),
        activity,
        unit: String(r[6] || (activity === 'DBM' || activity === 'BC' ? 'Cum' : 'sqm')),
        plannedToday: r[7] !== null && r[7] !== undefined ? Number(r[7]) : null,
        lengthM,
        widthM,
        depthM,
        depthMm: depthMm || (activity === 'DBM' ? 50 : activity === 'BC' ? 40 : undefined),
        achievedToday: Number(r[11]) || 0,
        cumulativeAchieved: Number(r[12]) || 0,
        boqQuantity: r[13] && typeof r[13] === 'number' ? Number(r[13]) : null,
        remarks: remarksText,
        isAnomaly: anomalyCheck.isAnomaly,
        anomalyCategory: anomalyCheck.category,
        anomalyDescription: anomalyCheck.description
      };

      rows.push(item);
    }
  }

  // 3. Parse QC Test Register
  const wsQC = wb.Sheets['QC Test Log'];
  const qcLogs: QCTestLogItem[] = [];
  if (wsQC) {
    const qcRows: any[][] = XLSX.utils.sheet_to_json(wsQC, { header: 1 });
    let currentDate = '14.10.2026';
    let currentMaterial = 'DBM';
    for (let i = 2; i < qcRows.length; i++) {
      const r = qcRows[i];
      if (!r || r.length < 3) continue;
      if (r[0]) currentDate = normalizeDate(r[0]);
      if (r[1]) currentMaterial = String(r[1]);

      const testName = String(r[2] || '');
      if (!testName) continue;

      qcLogs.push({
        date: currentDate,
        material: currentMaterial,
        testName,
        location: r[3] ? String(r[3]) : 'Plant-1 / Ch. 189-195',
        sampleRef: r[4] ? String(r[4]) : 'As per MoRTH 900-4',
        criteria: r[5] ? String(r[5]) : 'Standard Specification',
        result: r[6] !== undefined ? r[6] : 'Ok',
        status: (String(r[7] || r[6] || 'Ok').toLowerCase().includes('fail') ? 'Fail' : 'Pass'),
        remarks: r[8] ? String(r[8]) : 'Within tolerance'
      });
    }
  }

  const milestones = extractScheduleMilestones(wb);
  const cumulativeAchieved = extractCumulativeAchieved(wb, rows);

  return { rows, metadata, qcLogs, milestones, cumulativeAchieved };
}

/**
 * Built-in Fallback Dataset for NH-334 corridor (14.10.2026 - 23.10.2026)
 */
export function getFallbackData(): {
  planned: PlannedRecord[];
  actual: ActualDPRRow[];
  metadata: DPRMetadata;
  qcLogs: QCTestLogItem[];
  baseline: ProjectBaseline;
  milestones: ScheduleMilestones;
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
  cumulativeAchieved: CumulativeAchievedQuantities;
} {
  const metadata: DPRMetadata = {
    projectName: 'Muzaffarnagar–Haridwar Section of NH-334',
    contractor: 'M/s Atcons India Limited',
    concessionaire: 'NHIT Southern Projects private limited',
    pm: 'National Highways InvIT Project Managers Pvt. Ltd.',
    pmc: 'Cube Highways Technologies Pvt Ltd',
    independentEngineer: 'Chaitanya Projects Consultancy Limited in Association with Mahamarg Infra Consultants Pvt. Ltd',
    dprNo: 11,
    reportDate: '23.10.2026',
    weather: 'Clear',
    shift: 'Day & Night / 24 hrs',
    workStartDate: '13.10.2026 (Planned)',
    targetCompletionDate: '20.11.2026'
  };

  const planned: PlannedRecord[] = [
    { section: 'Roorkee to Haridwar LHS', slNo: 1, chainageFrom: 189.230, chainageTo: 190.220, side: 'LHS', lengthM: 990, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 55, dbmDepthOuter: 55, millingAreaSqm: 6930, dbmVolumeCum: 381.15, dbmMT: 907.13, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 2, chainageFrom: 190.220, chainageTo: 191.190, side: 'LHS', lengthM: 970, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 6790, dbmVolumeCum: 339.5, dbmMT: 808.01, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 3, chainageFrom: 193.180, chainageTo: 194.000, side: 'LHS', lengthM: 820, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 5740, dbmVolumeCum: 287.0, dbmMT: 683.06, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 4, chainageFrom: 194.000, chainageTo: 195.500, side: 'LHS', lengthM: 1500, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 10500, dbmVolumeCum: 525.0, dbmMT: 1249.5, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 5, chainageFrom: 195.500, chainageTo: 197.000, side: 'LHS', lengthM: 1500, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 10500, dbmVolumeCum: 525.0, dbmMT: 1249.5, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 6, chainageFrom: 201.250, chainageTo: 202.000, side: 'LHS', lengthM: 750, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 5250, dbmVolumeCum: 262.5, dbmMT: 624.75, plant: 'Plant-1' },
    { section: 'Roorkee to Haridwar LHS', slNo: 7, chainageFrom: 202.000, chainageTo: 204.000, side: 'LHS', lengthM: 2000, bcWidth: 8.75, dbmWidthInner: 3.5, dbmWidthOuter: 3.5, dbmDepthInner: 50, dbmDepthOuter: 50, millingAreaSqm: 14000, dbmVolumeCum: 700.0, dbmMT: 1666.0, plant: 'Plant-1' },
  ];

  const actual: ActualDPRRow[] = [
    { id: 'f-1', date: '14.10.2026', rawFromChainage: 189230, rawToChainage: 189600, fromChainage: 189.230, toChainage: 189.600, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 1000, lengthM: 370, widthM: 3.5, depthM: null, achievedToday: 1295, cumulativeAchieved: 1295, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-2', date: '14.10.2026', rawFromChainage: 189230, rawToChainage: 189500, fromChainage: 189.230, toChainage: 189.500, side: 'LHS', lane: 'F/L', activity: 'Tackcoat', unit: 'sqm', plannedToday: 1000, lengthM: 270, widthM: 3.5, depthM: null, achievedToday: 945, cumulativeAchieved: 945, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-3', date: '14.10.2026', rawFromChainage: 189230, rawToChainage: 189500, fromChainage: 189.230, toChainage: 189.500, side: 'LHS', lane: 'F/L', activity: 'DBM', unit: 'Cum', plannedToday: 50, lengthM: 270, widthM: 3.5, depthM: 0.05, depthMm: 50, achievedToday: 47.25, cumulativeAchieved: 47.25, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },

    { id: 'f-4', date: '15.10.2026', rawFromChainage: 189600, rawToChainage: 190210, fromChainage: 189.600, toChainage: 190.210, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 3000, lengthM: 610, widthM: 3.5, depthM: null, achievedToday: 2135, cumulativeAchieved: 3430, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },

    { id: 'f-5', date: '16.10.2026', rawFromChainage: 189500, rawToChainage: 190220, fromChainage: 189.500, toChainage: 190.220, side: 'LHS', lane: 'F/L', activity: 'DBM', unit: 'Cum', plannedToday: 175, lengthM: 720, widthM: 3.5, depthM: 0.05, depthMm: 50, achievedToday: 126, cumulativeAchieved: 173.25, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-6', date: '16.10.2026', rawFromChainage: 190210, rawToChainage: 191190, fromChainage: 190.210, toChainage: 191.190, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 3220, lengthM: 980, widthM: 3.5, depthM: null, achievedToday: 3430, cumulativeAchieved: 6860, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-7', date: '16.10.2026', rawFromChainage: 189500, rawToChainage: 190220, fromChainage: 189.500, toChainage: 190.220, side: 'LHS', lane: 'F/L', activity: 'Tackcoat', unit: 'sqm', plannedToday: 3500, lengthM: 720, widthM: 3.5, depthM: null, achievedToday: 2520, cumulativeAchieved: 3465, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },

    { id: 'f-8', date: '17.10.2026', rawFromChainage: 193180, rawToChainage: 194000, fromChainage: 193.180, toChainage: 194.000, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 2975, lengthM: 735, widthM: 3.5, depthM: null, achievedToday: 2572.5, cumulativeAchieved: 9432.5, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-9', date: '17.10.2026', rawFromChainage: 190220, rawToChainage: 191120, fromChainage: 190.220, toChainage: 191.120, side: 'LHS', lane: 'F/L', activity: 'DBM', unit: 'Cum', plannedToday: 170, lengthM: 900, widthM: 3.5, depthM: 0.05, depthMm: 50, achievedToday: 157.5, cumulativeAchieved: 330.75, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-10', date: '17.10.2026', rawFromChainage: 190220, rawToChainage: 191120, fromChainage: 190.220, toChainage: 191.120, side: 'LHS', lane: 'F/L', activity: 'Tackcoat', unit: 'sqm', plannedToday: 3400, lengthM: 900, widthM: 3.5, depthM: null, achievedToday: 3150, cumulativeAchieved: 6615, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },

    // 18.10.2026 - Critical Anomalies logged on site
    { id: 'f-11', date: '18.10.2026', rawFromChainage: 201250, rawToChainage: 201270, fromChainage: 201.250, toChainage: 201.270, side: 'LHS', lane: 'F/L& S/L', activity: 'Milling', unit: 'sqm', plannedToday: null, lengthM: 20, widthM: 7.0, depthM: 0.09, depthMm: 90, achievedToday: 140, cumulativeAchieved: 13758.5, boqQuantity: null, remarks: 'Milling above 50 mm depth (i.e. total 90 mm) - Excess qty', isAnomaly: true, anomalyCategory: 'milling_excess_depth', anomalyDescription: 'Milling depth 90 mm exceeded design 50 mm (+80% depth over tolerance)' },
    { id: 'f-12', date: '18.10.2026', rawFromChainage: 193500, rawToChainage: 193559, fromChainage: 193.500, toChainage: 193.559, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: null, lengthM: 59, widthM: 4.5, depthM: null, achievedToday: 59, cumulativeAchieved: 13817.5, boqQuantity: null, remarks: 'offset 4 m to 5 m - Excess qty', isAnomaly: true, anomalyCategory: 'offset', anomalyDescription: 'Unauthorized lane width offset 4.0m to 5.0m executed' },
    { id: 'f-13', date: '18.10.2026', rawFromChainage: 193630, rawToChainage: 193647, fromChainage: 193.630, toChainage: 193.647, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: null, lengthM: 17, widthM: 4.8, depthM: null, achievedToday: 22.1, cumulativeAchieved: 13839.6, boqQuantity: null, remarks: 'offset 4 m to 5.3 m - Excess qty', isAnomaly: true, anomalyCategory: 'offset', anomalyDescription: 'Pavement edge offset deviation 4.0m to 5.3m' },
    
    // Remaining days through 23.10.2026
    { id: 'f-14', date: '19.10.2026', rawFromChainage: 194000, rawToChainage: 195200, fromChainage: 194.000, toChainage: 195.200, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 4200, lengthM: 1200, widthM: 3.5, depthM: null, achievedToday: 4200, cumulativeAchieved: 18039.6, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-15', date: '19.10.2026', rawFromChainage: 193180, rawToChainage: 194000, fromChainage: 193.180, toChainage: 194.000, side: 'LHS', lane: 'F/L', activity: 'DBM', unit: 'Cum', plannedToday: 180, lengthM: 820, widthM: 3.5, depthM: 0.05, depthMm: 50, achievedToday: 143.5, cumulativeAchieved: 474.25, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-16', date: '20.10.2026', rawFromChainage: 195200, rawToChainage: 196800, fromChainage: 195.200, toChainage: 196.800, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 5600, lengthM: 1600, widthM: 3.5, depthM: null, achievedToday: 5600, cumulativeAchieved: 23639.6, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-17', date: '21.10.2026', rawFromChainage: 196800, rawToChainage: 198000, fromChainage: 196.800, toChainage: 198.000, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 4200, lengthM: 1200, widthM: 3.5, depthM: null, achievedToday: 4200, cumulativeAchieved: 27839.6, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-18', date: '22.10.2026', rawFromChainage: 198000, rawToChainage: 199000, fromChainage: 198.000, toChainage: 199.000, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 3500, lengthM: 1000, widthM: 3.5, depthM: null, achievedToday: 3357.5, cumulativeAchieved: 31197.1, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-19', date: '23.10.2026', rawFromChainage: 199000, rawToChainage: 199834, fromChainage: 199.000, toChainage: 199.834, side: 'LHS', lane: 'F/L', activity: 'Milling', unit: 'sqm', plannedToday: 7000, lengthM: 834, widthM: 3.5, depthM: null, achievedToday: 2920, cumulativeAchieved: 34117.1, boqQuantity: null, remarks: 'Rain stoppage in evening shift', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-20', date: '23.10.2026', rawFromChainage: 197500, rawToChainage: 198434, fromChainage: 197.500, toChainage: 198.434, side: 'LHS', lane: 'F/L', activity: 'Tackcoat', unit: 'sqm', plannedToday: 7000, lengthM: 934, widthM: 3.5, depthM: null, achievedToday: 3270, cumulativeAchieved: 28813.6, boqQuantity: null, remarks: '', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' },
    { id: 'f-21', date: '23.10.2026', rawFromChainage: 197500, rawToChainage: 198434, fromChainage: 197.500, toChainage: 198.434, side: 'LHS', lane: 'F/L', activity: 'DBM', unit: 'Cum', plannedToday: 350, lengthM: 934, widthM: 3.5, depthM: 0.05, depthMm: 50, achievedToday: 163.5, cumulativeAchieved: 1451.25, boqQuantity: null, remarks: 'Plant-1 Batch mix production completed', isAnomaly: false, anomalyCategory: 'none', anomalyDescription: '' }
  ];

  const qcLogs: QCTestLogItem[] = [
    { date: '14.10.2026', material: 'DBM', testName: 'Combined Dry Gradation', location: 'Plant-1', sampleRef: 'As per MoRTH Table 900-4', criteria: '2 Test/Day Plant', result: 'Complies', status: 'Pass', remarks: 'Gradation within envelope' },
    { date: '14.10.2026', material: 'DBM', testName: 'Bitumen Extraction', location: 'Plant-1', sampleRef: 'As per MoRTH Table 900-4', criteria: '4.5% - 4.8%', result: 4.53, status: 'Pass', remarks: 'Optimum binder content maintained' },
    { date: '15.10.2026', material: 'DBM', testName: 'GMM (Theoretical Max Density)', location: 'Plant-1', sampleRef: 'MoRTH Sec 500', criteria: '2.45 - 2.50', result: 2.469, status: 'Pass', remarks: 'Good compaction indicator' },
    { date: '16.10.2026', material: 'DBM', testName: 'Aggregate Impact Value (AIV)', location: 'Plant-1 Stockpile', sampleRef: 'IS 2386 Pt IV', criteria: 'Max 27%', result: 13.74, status: 'Pass', remarks: 'High aggregate strength' },
    { date: '17.10.2026', material: 'DBM', testName: 'Flakiness & Elongation Index', location: 'Quarry / Plant', sampleRef: 'IS 2386 Pt I', criteria: 'Max 35%', result: 29.62, status: 'Pass', remarks: 'Meets MoRTH standards' },
    { date: '18.10.2026', material: 'Tackcoat', testName: 'Tray Test for Application Rate', location: 'Ch. 193+500', sampleRef: 'MoRTH Table 500-2', criteria: '0.20 - 0.30 kg/sqm', result: 0.268, status: 'Pass', remarks: 'Uniform spray rate verified' },
    { date: '18.10.2026', material: 'Milling', testName: 'Milling Depth Gauge Verification', location: 'Ch. 201+250', sampleRef: 'Field Audit', criteria: '50 mm ± 5 mm', result: '90 mm (Exceeds)', status: 'Fail', remarks: 'Depth NCR #04 issued to contractor' },
    { date: '20.10.2026', material: 'DBM', testName: 'Marshall Stability & Flow', location: 'Plant-1 Lab', sampleRef: 'MoRTH Table 500-11', criteria: 'Min 9.0 kN / 2-4 mm', result: '14.2 kN / 3.1 mm', status: 'Pass', remarks: 'Exceptional stability' }
  ];

  return {
    planned,
    actual,
    metadata,
    qcLogs,
    baseline: DEFAULT_PROJECT_BASELINE,
    milestones: DEFAULT_SCHEDULE_MILESTONES,
    sectionScopes: DEFAULT_SECTION_SCOPES,
    consolidatedScope: DEFAULT_CONSOLIDATED_SCOPE,
    cumulativeAchieved: DEFAULT_CUMULATIVE_ACHIEVED
  };
}

/**
 * Authoritative parser for the Single Source of Truth workbook: final_sheet.xlsx
 * Parses 'Work Program' for contractual scope targets
 * Parses 'Chainage Log(input)' for daily and cumulative execution
 */
export function parseFinalSheetBuffer(buffer: ArrayBuffer): {
  planned: PlannedRecord[];
  actual: ActualDPRRow[];
  metadata: DPRMetadata;
  qcLogs: QCTestLogItem[];
  baseline: ProjectBaseline;
  milestones: ScheduleMilestones;
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
  cumulativeAchieved: CumulativeAchievedQuantities;
  source: 'live_excel';
  availableDates: string[];
  dataQualityWarnings: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];

  // ==========================================
  // 1. WORK PROGRAM WORKSHEET (Contract Scope)
  // ==========================================
  const wpSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('work program')) || wb.SheetNames[0];
  const wsWP = wb.Sheets[wpSheetName];
  if (!wsWP) {
    throw new Error(`Critical Error: 'Work Program' worksheet not found in final_sheet.xlsx.`);
  }

  const wpRows: any[][] = XLSX.utils.sheet_to_json(wsWP, { header: 1 });
  let wpHeaderRowIdx = -1;
  for (let i = 0; i < Math.min(15, wpRows.length); i++) {
    const row = wpRows[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('activity') && rowStr.includes('total qty')) {
        wpHeaderRowIdx = i;
        break;
      }
    }
  }

  if (wpHeaderRowIdx === -1) {
    throw new Error("Critical Error: Header row containing 'Activity' and 'Total Qty.' not found in 'Work Program'.");
  }

  const wpHeaders: string[] = (wpRows[wpHeaderRowIdx] || []).map(h => String(h || '').trim());
  const findCol = (pattern: RegExp) => wpHeaders.findIndex(h => pattern.test(h));

  const wpActCol = findCol(/^activity$/i);
  const wpUnitCol = findCol(/^unit$/i);
  const wpQtyCol = findCol(/total\s*qty/i);
  const wpSideCol = findCol(/^side$/i);
  const wpChFromCol = findCol(/ch.*from/i);
  const wpChToCol = findCol(/ch.*to/i);
  const wpStretchCol = findCol(/^stretch$/i);
  const wpHmpCol = findCol(/^hmp$/i);
  const wpTeamCol = findCol(/^team$/i);

  const targets = {
    Both: { Milling: 0, Tackcoat: 0, DBM: 0, BC: 0 },
    LHS: { Milling: 0, Tackcoat: 0, DBM: 0, BC: 0 },
    RHS: { Milling: 0, Tackcoat: 0, DBM: 0, BC: 0 },
    BHS: { Milling: 0, Tackcoat: 0, DBM: 0, BC: 0 }
  };

  const plannedRecords: PlannedRecord[] = [];
  let slNo = 1;

  for (let r = wpHeaderRowIdx + 1; r < wpRows.length; r++) {
    const row = wpRows[r];
    if (!row || row[wpActCol] === undefined || row[wpActCol] === null) continue;

    const rawAct = String(row[wpActCol]).trim();
    if (!rawAct) continue;

    const normAct = normalizeActivity(rawAct);
    const unit = String(row[wpUnitCol] || '').trim();
    const qty = Number(row[wpQtyCol]) || 0;
    const sideRaw = String(row[wpSideCol] || 'BHS').trim().toUpperCase();
    const side: HighwaySide = (sideRaw === 'LHS' ? 'LHS' : sideRaw === 'RHS' ? 'RHS' : 'BHS');

    // Unit validation check
    if (normAct === 'Milling' && unit.toLowerCase() !== 'sqm') {
      warnings.push(`Work Program Row ${r + 1}: Milling unit is '${unit}', expected 'Sqm'`);
    } else if (normAct === 'Tackcoat' && unit.toLowerCase() !== 'sqm') {
      warnings.push(`Work Program Row ${r + 1}: Tack Coat unit is '${unit}', expected 'Sqm'`);
    } else if (normAct === 'DBM' && unit.toLowerCase() !== 'cum') {
      warnings.push(`Work Program Row ${r + 1}: DBM unit is '${unit}', expected 'Cum'`);
    } else if (normAct === 'BC' && unit.toLowerCase() !== 'cum') {
      warnings.push(`Work Program Row ${r + 1}: BC unit is '${unit}', expected 'Cum'`);
    }

    if (targets.Both[normAct as ActivityType] !== undefined) {
      targets.Both[normAct as ActivityType] += qty;
      if (targets[side] && targets[side][normAct as ActivityType] !== undefined) {
        targets[side][normAct as ActivityType] += qty;
      }
    }

    const chFromStr = row[wpChFromCol] ? String(row[wpChFromCol]).trim() : '';
    const chToStr = row[wpChToCol] ? String(row[wpChToCol]).trim() : '';

    plannedRecords.push({
      section: String(row[wpStretchCol] || 'Muzaffarnagar - Haridwar').trim(),
      stretch: String(row[wpStretchCol] || '').trim(),
      slNo: slNo++,
      hmp: String(row[wpHmpCol] || '').trim(),
      team: String(row[wpTeamCol] || '').trim(),
      activity: rawAct,
      normalizedActivity: normAct,
      chainageFrom: normalizeChainage(chFromStr),
      chainageTo: normalizeChainage(chToStr),
      rawChainageFrom: chFromStr,
      rawChainageTo: chToStr,
      side,
      unit,
      totalQty: qty,
      lengthM: 0,
      bcWidth: 0,
      dbmWidthInner: 0,
      dbmWidthOuter: 0,
      dbmDepthInner: 0,
      dbmDepthOuter: 0,
      millingAreaSqm: normAct === 'Milling' ? qty : 0,
      dbmVolumeCum: normAct === 'DBM' ? qty : 0,
      dbmMT: normAct === 'DBM' ? qty * 2.38 : 0,
      plant: 'Plant-1'
    });
  }

  const baseline: ProjectBaseline = {
    ...DEFAULT_PROJECT_BASELINE,
    totalMillingTargetSqm: targets.Both.Milling,
    totalTackcoatTargetSqm: targets.Both.Tackcoat,
    totalDbmTargetCum: targets.Both.DBM,
    totalDbmTargetMT: Number((targets.Both.DBM * 2.38).toFixed(2)),
    totalBcTargetCum: targets.Both.BC,
    totalBcTargetMT: Number((targets.Both.BC * 2.35).toFixed(2)),
    lhs: {
      millingTargetSqm: targets.LHS.Milling,
      dbmTargetMT: Number((targets.LHS.DBM * 2.38).toFixed(2)),
      dbmTargetCum: targets.LHS.DBM,
      tackcoatTargetSqm: targets.LHS.Tackcoat,
      bcTargetCum: targets.LHS.BC,
      bcTargetMT: Number((targets.LHS.BC * 2.35).toFixed(2)),
      millingLengthM: 43758,
      dbmLengthM: 43758,
      tackcoatLengthM: 49358,
      bcLengthM: 49358
    },
    rhs: {
      millingTargetSqm: targets.RHS.Milling,
      dbmTargetMT: Number((targets.RHS.DBM * 2.38).toFixed(2)),
      dbmTargetCum: targets.RHS.DBM,
      tackcoatTargetSqm: targets.RHS.Tackcoat,
      bcTargetCum: targets.RHS.BC,
      bcTargetMT: Number((targets.RHS.BC * 2.35).toFixed(2)),
      millingLengthM: 47418,
      dbmLengthM: 47418,
      tackcoatLengthM: 53928,
      bcLengthM: 53928
    },
    source: 'work_program_excel'
  };

  // ==========================================
  // 2. CHAINAGE LOG WORKSHEET (Actual Execution)
  // ==========================================
  const clSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('chainage log')) || 'Chainage Log(input)';
  const wsCL = wb.Sheets[clSheetName];
  if (!wsCL) {
    throw new Error(`Critical Error: 'Chainage Log(input)' worksheet not found in final_sheet.xlsx.`);
  }

  const clRows: any[][] = XLSX.utils.sheet_to_json(wsCL, { header: 1 });
  let clHeaderRowIdx = -1;
  for (let i = 0; i < Math.min(15, clRows.length); i++) {
    const row = clRows[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('date') && (rowStr.includes('achieved today') || rowStr.includes('from ch'))) {
        clHeaderRowIdx = i;
        break;
      }
    }
  }

  if (clHeaderRowIdx === -1) {
    throw new Error("Critical Error: Header row containing 'Date' and 'Achieved Today' not found in 'Chainage Log(input)'.");
  }

  const clHeaders: string[] = (clRows[clHeaderRowIdx] || []).map(h => String(h || '').trim());
  const findClCol = (pattern: RegExp) => clHeaders.findIndex(h => pattern.test(h));

  const clDateCol = findClCol(/^date$/i);
  const clFromCol = findClCol(/from\s*ch/i);
  const clToCol = findClCol(/to\s*ch/i);
  const clSideCol = findClCol(/^side$/i);
  const clLaneCol = findClCol(/^lane$/i);
  const clActCol = findClCol(/^activity$/i);
  const clUnitCol = findClCol(/^unit$/i);
  const clPlannedCol = findClCol(/planned\s*today/i);
  const clLenCol = findClCol(/length.*m/i);
  const clWidthCol = findClCol(/width.*m/i);
  const clDepthCol = findClCol(/depth.*m/i);
  const clAchCol = findClCol(/achieved\s*today/i);
  const clCumCol = findClCol(/cumulative/i);
  const clRemarksCol = findClCol(/remarks/i);

  const actualRows: ActualDPRRow[] = [];
  const dateSet = new Set<string>();

  for (let r = clHeaderRowIdx + 1; r < clRows.length; r++) {
    const row = clRows[r];
    if (!row || row[clDateCol] === null || row[clDateCol] === undefined || row[clDateCol] === '') continue;

    const rawDate = row[clDateCol];
    const isoDate = serialToIsoDate(rawDate);
    const displayDate = isoToDmy(isoDate);
    dateSet.add(displayDate);

    const rawFrom = Number(row[clFromCol]);
    const rawTo = Number(row[clToCol]);
    if (isNaN(rawFrom) || isNaN(rawTo)) {
      warnings.push(`Chainage Log Row ${r + 1}: Invalid chainage values (${row[clFromCol]} to ${row[clToCol]})`);
      continue;
    }

    const fromKm = normalizeChainage(rawFrom);
    const toKm = normalizeChainage(rawTo);
    const rawAct = String(row[clActCol] || '').trim();
    const normAct = normalizeActivity(rawAct) as ActivityType;
    const sideRaw = String(row[clSideCol] || 'LHS').trim().toUpperCase();
    const side: HighwaySide = (sideRaw === 'RHS' ? 'RHS' : sideRaw === 'BHS' ? 'BHS' : 'LHS');
    const lane = String(row[clLaneCol] || 'F/L').trim();
    const unit = String(row[clUnitCol] || (normAct === 'DBM' || normAct === 'BC' ? 'Cum' : 'Sqm')).trim();

    const plannedToday = row[clPlannedCol] !== null && row[clPlannedCol] !== undefined && !isNaN(Number(row[clPlannedCol]))
      ? Number(row[clPlannedCol])
      : null;

    const lengthM = row[clLenCol] !== null && row[clLenCol] !== undefined && !isNaN(Number(row[clLenCol]))
      ? Number(row[clLenCol])
      : Math.round(Math.abs(toKm - fromKm) * 1000);

    const widthM = row[clWidthCol] !== null && row[clWidthCol] !== undefined && !isNaN(Number(row[clWidthCol]))
      ? Number(row[clWidthCol])
      : 3.5;

    let depthM: number | null = null;
    let depthMm: number | undefined = undefined;
    if (row[clDepthCol] !== null && row[clDepthCol] !== undefined && !isNaN(Number(row[clDepthCol]))) {
      depthM = Number(row[clDepthCol]);
      depthMm = Math.round(depthM * 1000);
    }

    // Column O: Achieved Today is primary
    const achievedToday = Number(row[clAchCol]) || 0;
    const cumulativeAchieved = Number(row[clCumCol]) || 0;

    const remarksText = row[clRemarksCol] ? String(row[clRemarksCol]).trim() : '';
    const anomalyCheck = detectAnomaly(remarksText, depthM, widthM);

    if (remarksText.includes('90 mm')) {
      depthMm = 90;
      depthM = 0.09;
    }

    actualRows.push({
      id: `cl-row-${r + 1}-${rawFrom}-${rawTo}`,
      date: displayDate,
      isoDate,
      rawFromChainage: rawFrom,
      rawToChainage: rawTo,
      fromChainage: Math.min(fromKm, toKm),
      toChainage: Math.max(fromKm, toKm),
      side,
      lane,
      activity: normAct,
      unit,
      plannedToday,
      lengthM,
      widthM,
      depthM,
      depthMm: depthMm || (normAct === 'DBM' ? 50 : normAct === 'BC' ? 40 : undefined),
      achievedToday,
      cumulativeAchieved,
      boqQuantity: null,
      remarks: remarksText,
      isAnomaly: anomalyCheck.isAnomaly,
      anomalyCategory: anomalyCheck.category,
      anomalyDescription: anomalyCheck.description
    });
  }

  // Sorted list of distinct dates present in Chainage Log
  const availableDates = Array.from(dateSet).sort((a, b) => {
    const [ad, am, ay] = a.split('.').map(Number);
    const [bd, bm, by] = b.split('.').map(Number);
    return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  });

  const latestDate = availableDates[availableDates.length - 1] || '01.11.2026';
  const latestIso = dmyToIso(latestDate);

  // Calculate cumulative achieved quantities up to latest date
  const cumMilling = actualRows
    .filter(r => r.activity === 'Milling' && serialToIsoDate(r.date) <= latestIso)
    .reduce((sum, r) => sum + r.achievedToday, 0);

  const cumTack = actualRows
    .filter(r => r.activity === 'Tackcoat' && serialToIsoDate(r.date) <= latestIso)
    .reduce((sum, r) => sum + r.achievedToday, 0);

  const cumDbm = actualRows
    .filter(r => r.activity === 'DBM' && serialToIsoDate(r.date) <= latestIso)
    .reduce((sum, r) => sum + r.achievedToday, 0);

  const cumBc = actualRows
    .filter(r => r.activity === 'BC' && serialToIsoDate(r.date) <= latestIso)
    .reduce((sum, r) => sum + r.achievedToday, 0);

  const cumulativeAchieved: CumulativeAchievedQuantities = {
    millingSqm: cumMilling,
    tackCoatSqm: cumTack,
    dbmCum: cumDbm,
    bcCum: cumBc
  };

  const metadata: DPRMetadata = {
    projectName: 'Muzaffarnagar - Haridwar Section, NH-334 (Ch. 130+560KM to 206+220KM)',
    contractor: 'M/s Atcons India Limited',
    concessionaire: 'NHIT Southern Projects private limited',
    pm: 'National Highways InvIT Project Managers Pvt. Ltd.',
    pmc: 'Cube Highways Technologies Pvt Ltd',
    independentEngineer: 'Chaitanya Projects Consultancy Limited in Association with Mahamarg Infra Consultants Pvt. Ltd',
    dprNo: 20,
    reportDate: latestDate,
    weather: 'Clear',
    shift: 'Day & Night / 24 hrs',
    workStartDate: '14.10.2026',
    targetCompletionDate: '10.01.2027'
  };

  return {
    planned: plannedRecords,
    actual: actualRows,
    metadata,
    qcLogs: getFallbackData().qcLogs,
    baseline,
    milestones: DEFAULT_SCHEDULE_MILESTONES,
    sectionScopes: DEFAULT_SECTION_SCOPES,
    consolidatedScope: {
      millingSqm: { mcw: 515298, sr: 165986, total: targets.Both.Milling },
      tackCoatSqm: { mcw: 1494585, sr: 353685, total: targets.Both.Tackcoat },
      dbmCum: targets.Both.DBM,
      bcPmbCum: targets.Both.BC,
      roadMarkingSqm: 59396.601,
      earthenShoulderCum: 159084.0
    },
    cumulativeAchieved,
    source: 'live_excel',
    availableDates,
    dataQualityWarnings: warnings
  };
}

/**
 * Computes unified, rigorous BOQ and physical progress metrics
 * for all 4 activities against a specific selected date.
 */
export function computeBOQProgressMetrics(
  actualRows: ActualDPRRow[],
  baseline: ProjectBaseline,
  selectedDate: string,
  sideFilter: HighwaySide = 'Both'
): {
  milling: BOQCardMetric;
  tackcoat: BOQCardMetric;
  dbm: BOQCardMetric;
  bc: BOQCardMetric;
  linearMetrics: {
    millingM: number;
    millingKm: number;
    tackM: number;
    tackKm: number;
    dbmM: number;
    dbmKm: number;
    bcM: number;
    bcKm: number;
  };
  warnings: string[];
} {
  const selectedIso = serialToIsoDate(selectedDate);
  const warnings: string[] = [];

  // Determine side targets
  let targetMilling = baseline.totalMillingTargetSqm;
  let targetTackcoat = baseline.totalTackcoatTargetSqm || 1848270;
  let targetDbm = baseline.totalDbmTargetCum;
  let targetBc = baseline.totalBcTargetCum || 46679.48;

  if (sideFilter === 'LHS' && baseline.lhs) {
    targetMilling = baseline.lhs.millingTargetSqm;
    targetTackcoat = baseline.lhs.tackcoatTargetSqm;
    targetDbm = baseline.lhs.dbmTargetCum;
    targetBc = 18477.29;
  } else if (sideFilter === 'RHS' && baseline.rhs) {
    targetMilling = baseline.rhs.millingTargetSqm;
    targetTackcoat = baseline.rhs.tackcoatTargetSqm;
    targetDbm = baseline.rhs.dbmTargetCum;
    targetBc = 20694.19;
  }

  // Calculate for each activity
  const activities: ActivityType[] = ['Milling', 'Tackcoat', 'DBM', 'BC'];
  const results: Record<ActivityType, BOQCardMetric> = {} as any;

  for (const act of activities) {
    const actRows = actualRows.filter(r => r.activity === act);
    const sideMatchingRows = actRows.filter(r => (sideFilter === 'Both' || sideFilter === 'ALL' || sideFilter === 'BHS') || r.side === sideFilter);

    // Daily rows: exactly on selected date
    const dailyRows = sideMatchingRows.filter(r => serialToIsoDate(r.date) === selectedIso);
    // Cumulative rows: up to and including selected date
    const cumRows = sideMatchingRows.filter(r => serialToIsoDate(r.date) <= selectedIso);

    const achievedToday = dailyRows.reduce((sum, r) => sum + r.achievedToday, 0);
    const cumulativeAchieved = cumRows.reduce((sum, r) => sum + r.achievedToday, 0);

    let targetQty = 0;
    let unit = 'Sqm';
    let targetLengthM = 91176;

    if (act === 'Milling') {
      targetQty = targetMilling;
      unit = 'Sqm';
      targetLengthM = sideFilter === 'LHS' ? 43758 : sideFilter === 'RHS' ? 47418 : 91176;
    } else if (act === 'Tackcoat') {
      targetQty = targetTackcoat;
      unit = 'Sqm';
      targetLengthM = sideFilter === 'LHS' ? 49358 : sideFilter === 'RHS' ? 53928 : 103286;
    } else if (act === 'DBM') {
      targetQty = targetDbm;
      unit = 'Cum';
      targetLengthM = sideFilter === 'LHS' ? 43758 : sideFilter === 'RHS' ? 47418 : 91176;
    } else if (act === 'BC') {
      targetQty = targetBc;
      unit = 'Cum';
      targetLengthM = sideFilter === 'LHS' ? 49358 : sideFilter === 'RHS' ? 53928 : 103286;
    }

    const balanceQuantity = targetQty - cumulativeAchieved;
    const progressPercent = targetQty > 0 ? (cumulativeAchieved / targetQty) * 100 : 0;
    const isOverachieved = cumulativeAchieved > targetQty;
    const overachievementPercent = isOverachieved ? Math.max(0, progressPercent - 100) : 0;

    // Physical linear length calculations using merged non-overlapping intervals
    const dailyLen = calculateUniqueLinearLength(dailyRows, act, sideFilter);
    const cumLen = calculateUniqueLinearLength(cumRows, act, sideFilter);
    const balanceLengthM = targetLengthM - cumLen.meters;
    const linearProgressPercent = targetLengthM > 0 ? (cumLen.meters / targetLengthM) * 100 : 0;

    results[act] = {
      activity: act,
      unit,
      targetQuantity: targetQty,
      achievedToday,
      cumulativeAchieved,
      balanceQuantity,
      progressPercent,
      isOverachieved,
      overachievementPercent,
      dailyCompletedLengthM: dailyLen.meters,
      dailyCompletedLengthKm: dailyLen.km,
      cumulativeCompletedLengthM: cumLen.meters,
      cumulativeCompletedLengthKm: cumLen.km,
      balanceLengthM,
      balanceLengthKm: Number((balanceLengthM / 1000).toFixed(3)),
      linearProgressPercent
    };
  }

  return {
    milling: results.Milling,
    tackcoat: results.Tackcoat,
    dbm: results.DBM,
    bc: results.BC,
    linearMetrics: {
      millingM: results.Milling.cumulativeCompletedLengthM,
      millingKm: results.Milling.cumulativeCompletedLengthKm,
      tackM: results.Tackcoat.cumulativeCompletedLengthM,
      tackKm: results.Tackcoat.cumulativeCompletedLengthKm,
      dbmM: results.DBM.cumulativeCompletedLengthM,
      dbmKm: results.DBM.cumulativeCompletedLengthKm,
      bcM: results.BC.cumulativeCompletedLengthM,
      bcKm: results.BC.cumulativeCompletedLengthKm
    },
    warnings
  };
}

/**
 * Loads Authoritative Planned Work Program and Daily DPR execution data from final_sheet.xlsx
 */
export async function loadDashboardData(): Promise<{
  planned: PlannedRecord[];
  actual: ActualDPRRow[];
  metadata: DPRMetadata;
  qcLogs: QCTestLogItem[];
  baseline: ProjectBaseline;
  milestones: ScheduleMilestones;
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
  cumulativeAchieved: CumulativeAchievedQuantities;
  source: 'live_excel' | 'fallback';
  availableDates: string[];
  dataQualityWarnings: string[];
}> {
  try {
    let res = await fetch('/data/final_sheet.xlsx');
    if (!res.ok) {
      res = await fetch('/data/Final_sheet.xlsx');
    }
    if (!res.ok) {
      throw new Error(`Critical Error: 'final_sheet.xlsx' could not be fetched (HTTP ${res.status}).`);
    }

    const buffer = await res.arrayBuffer();
    return parseFinalSheetBuffer(buffer);
  } catch (err) {
    console.error('Error loading live Excel files, falling back to local dataset:', err);
    const fallback = getFallbackData();
    return {
      planned: fallback.planned,
      actual: fallback.actual,
      metadata: fallback.metadata,
      qcLogs: fallback.qcLogs,
      baseline: fallback.baseline,
      milestones: fallback.milestones,
      sectionScopes: fallback.sectionScopes,
      consolidatedScope: fallback.consolidatedScope,
      cumulativeAchieved: fallback.cumulativeAchieved,
      source: 'fallback',
      availableDates: ['14.10.2026', '15.10.2026', '16.10.2026', '17.10.2026', '18.10.2026', '19.10.2026', '20.10.2026', '21.10.2026', '22.10.2026', '23.10.2026', '31.10.2026', '01.11.2026'],
      dataQualityWarnings: ['Running in fallback mode due to live workbook load issue']
    };
  }
}
