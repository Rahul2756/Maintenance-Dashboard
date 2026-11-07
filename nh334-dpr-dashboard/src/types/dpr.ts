export type HighwaySide = 'LHS' | 'RHS' | 'ALL' | 'Both' | 'BHS';
export type ActivityType = 'Milling' | 'Tackcoat' | 'DBM' | 'BC';

export interface WeeklyPlannedValue {
  week: string; // e.g. "Week-1"
  weekNum: number; // 1 to 10
  startDate: string; // DD.MM.YYYY e.g. "02.11.2026"
  endDate: string; // DD.MM.YYYY e.g. "07.11.2026"
  quantity: number;
  isCompletedSnapshot?: boolean;
}

export interface PlannedRecord {
  section: string;
  stretch?: string;
  slNo: number;
  sNo?: number;
  hmp?: string;
  team?: string;
  activity?: string;
  normalizedActivity?: string;
  chainageFrom: number; // e.g. 130.560 or 188.900
  chainageTo: number;   // e.g. 206.220
  rawChainageFrom?: string;
  rawChainageTo?: string;
  side: HighwaySide;
  unit?: string;
  totalQty?: number;
  completedQtySnapshot?: number;
  balanceQtySnapshot?: number;
  weeklySchedule?: WeeklyPlannedValue[];
  lengthM: number;
  bcWidth: number;
  dbmWidthInner: number;
  dbmWidthOuter: number;
  dbmDepthInner: number; // mm
  dbmDepthOuter: number; // mm
  millingAreaSqm: number;
  dbmVolumeCum: number;
  dbmMT: number;
  plant: string;
  hmpTotalQtyMT?: number;
  hmpDailyQtyMT?: number;
  periodFrom?: string;
  periodTo?: string;
  days?: number;
  remarks?: string;
}

export interface PhaseDailyTarget {
  phaseIndex: number;
  section: string;
  startDate: string; // DD.MM.YYYY e.g. "10.10.2026"
  endDate: string;   // DD.MM.YYYY e.g. "15.10.2026"
  periodFromSerial?: number; // Excel date serial e.g. 46305
  periodToSerial?: number;   // Excel date serial e.g. 46310
  dailyQtyMT: number;        // Locked daily target e.g. 770.53 MT/day
  totalQtyMT?: number;
  days?: number;
}

export interface ProjectBaseline {
  totalMillingTargetSqm: number; // Absolute sum of Milling (Sqm) e.g. 515298
  totalDbmTargetCum: number;     // Absolute sum of DBM (Cum) e.g. 28406.245
  totalDbmTargetMT: number;      // Absolute sum of DBM (MT) e.g. 67606.863
  totalTackcoatTargetSqm?: number; // Absolute sum of Tack Coat (Sqm) from 'MCW -BC (BHS)' e.g. 979287
  totalBcTargetCum?: number;     // Absolute sum of BC (Cum) from 'MCW -BC (BHS)' e.g. 39171.5
  totalBcTargetMT?: number;      // Absolute sum of BC (MT) from 'MCW -BC (BHS)' e.g. 92053.0
  totalBcTargetLengthM?: number; // Total planned length for BC (m) e.g. 103286
  minChainage: number;           // Absolute minimum Chainage From e.g. 169.000
  maxChainage: number;           // Maximum Chainage To e.g. 206.220
  totalScopeKm: number;          // Full project scope corridor length (km)
  totalPlannedLengthM?: number;  // Total planned length (m) e.g. 91176 from MCW -Milling & DBM (BHS)
  millingPlannedLengthM?: number; // 91176
  dbmPlannedLengthM?: number;     // 91176
  tackcoatPlannedLengthM?: number;// 103286
  dailyPhases: PhaseDailyTarget[]; // Phased daily production targets
  source: 'work_program_excel' | 'boq_fallback';
  lhs?: {
    millingTargetSqm: number;
    dbmTargetMT: number;
    dbmTargetCum: number;
    tackcoatTargetSqm: number;
    bcTargetCum?: number;
    bcTargetMT?: number;
    millingLengthM: number;
    dbmLengthM: number;
    tackcoatLengthM: number;
    bcLengthM?: number;
  };
  rhs?: {
    millingTargetSqm: number;
    dbmTargetMT: number;
    dbmTargetCum: number;
    tackcoatTargetSqm: number;
    bcTargetCum?: number;
    bcTargetMT?: number;
    millingLengthM: number;
    dbmLengthM: number;
    tackcoatLengthM: number;
    bcLengthM?: number;
  };
}

export type AnomalyCategory = 'excess_qty' | 'milling_excess_depth' | 'offset' | 'none';

export interface ActualDPRRow {
  id: string;
  date: string; // Normalized DD.MM.YYYY e.g. "18.10.2026"
  isoDate?: string; // Standard ISO YYYY-MM-DD e.g. "2026-10-18"
  rawFromChainage: number; // Raw integer (189230)
  rawToChainage: number;   // Raw integer (189600)
  fromChainage: number;    // Normalized (189.230)
  toChainage: number;      // Normalized (189.600)
  side: HighwaySide;
  lane: string;            // e.g. "F/L", "F/L& S/L", "S/L"
  activity: ActivityType;
  unit: string;            // "sqm", "Cum", "MT"
  plannedToday: number | null;
  lengthM: number;
  widthM: number;
  depthM: number | null;   // e.g. 0.05, or null
  depthMm?: number;        // e.g. 50 or 90
  achievedToday: number;
  cumulativeAchieved: number;
  boqQuantity: number | null;
  remarks: string;
  isAnomaly: boolean;
  anomalyCategory: AnomalyCategory;
  anomalyDescription: string;
}

export interface DPRMetadata {
  projectName: string;
  contractor: string;
  concessionaire: string;
  pm: string;
  pmc: string;
  independentEngineer: string;
  dprNo: number | string;
  reportDate: string;
  weather: string;
  shift: string;
  workStartDate: string;
  targetCompletionDate: string;
}

export interface GlobalFilterState {
  side: 'LHS' | 'RHS' | 'Both';
  lane?: 'All' | 'F/L' | 'S/L' | 'FW' | 'SR';
  selectedActivities: ('Milling' | 'Tackcoat' | 'DBM' | 'BC')[];
  dateRange: { start: string; end: string }; // ISO or DD.MM.YYYY
  selectedSingleDate: string | null; // e.g. "16.10.2026"
  chainageScope: 'All' | 'DPR' | 'Sec1' | 'Sec2';
  chainageBounds: { from: number; to: number };
  anomaliesOnly: boolean;
  searchQuery: string;
}

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  side: HighwaySide;
  activities: ActivityType[];
  minChainage: number;
  maxChainage: number;
  anomaliesOnly: boolean;
  searchQuery: string;
}

export interface StretchData {
  plannedKm: number;
  actualKm: number;
  remainingKm: number;
  percentDone: number; // 0 to 100
}

export interface StretchWiseSummaryRow {
  rowNum: number;
  side: HighwaySide;
  activity: string;
  normalizedActivity: string;
  lane: string;
  stretch1: StretchData;
  stretch2: StretchData;
  stretch3: StretchData;
  total: StretchData;
}

export interface StretchWiseSummaryTableData {
  stretches: {
    stretch1: { name: string; fromM: number; toM: number; lengthKm: number };
    stretch2: { name: string; fromM: number; toM: number; lengthKm: number };
    stretch3: { name: string; fromM: number; toM: number; lengthKm: number };
    total: { name: string; fromM: number; toM: number; lengthKm: number };
  };
  rows: StretchWiseSummaryRow[];
  totals: {
    stretch1: StretchData;
    stretch2: StretchData;
    stretch3: StretchData;
    total: StretchData;
  };
}

export interface DailyGroupedExecutionRow {
  date: string;
  isoDate: string;
  activity: string;
  side: HighwaySide;
  lane: string;
  chainageSpan: string;
  minChainageM: number;
  maxChainageM: number;
  recordCount: number;
  dailyExecutedLaneLengthM: number;
  dailyExecutedLaneLengthKm: number;
  dailyUniqueCoverageM: number;
  dailyUniqueCoverageKm: number;
  cumulativeExecutedLaneLengthM: number;
  cumulativeExecutedLaneLengthKm: number;
  cumulativeUniqueCoverageM: number;
  cumulativeUniqueCoverageKm: number;
  hasMultiLaneOrOverlap: boolean;
}

export interface BOQCardMetric {
  activity: ActivityType;
  unit: string;
  targetQuantity: number;
  achievedToday: number;
  cumulativeAchieved: number;
  balanceQuantity: number;
  progressPercent: number;
  isOverachieved: boolean;
  overachievementPercent: number;
  // Linear measurements
  dailyCompletedLengthM: number;
  dailyCompletedLengthKm: number;
  cumulativeCompletedLengthM: number;
  cumulativeCompletedLengthKm: number;
  balanceLengthM: number;
  balanceLengthKm: number;
  linearProgressPercent: number;
  // Dual measurement fields (Requirement 2)
  dailyExecutedLaneLengthM?: number;
  dailyExecutedLaneLengthKm?: number;
  cumulativeExecutedLaneLengthM?: number;
  cumulativeExecutedLaneLengthKm?: number;
  dailyUniqueCoverageM?: number;
  dailyUniqueCoverageKm?: number;
  cumulativeUniqueCoverageM?: number;
  cumulativeUniqueCoverageKm?: number;
  dailyEntriesCount?: number;
  cumulativeEntriesCount?: number;
}

export interface KPIAggregates {
  selectedDate?: string;

  // Milling metrics
  millingAchieved: number;
  millingAchievedToday?: number;
  millingCumulative?: number;
  millingTarget: number;
  millingBalance?: number;
  millingVariance: number;
  millingPercent: number;
  millingUnit?: string;
  millingSparkline: number[];
  isMillingOverachieved?: boolean;

  // Tackcoat metrics
  tackcoatAchieved: number;
  tackcoatAchievedToday?: number;
  tackcoatCumulative?: number;
  tackcoatTarget: number;
  tackcoatBalance?: number;
  tackcoatVariance: number;
  tackcoatPercent: number;
  tackcoatUnit?: string;
  tackcoatSparkline: number[];
  isTackcoatOverachieved?: boolean;

  // DBM metrics
  dbmAchieved: number; // In MT
  dbmAchievedCum?: number; // In Cum
  dbmAchievedTodayCum?: number;
  dbmCumulativeCum?: number;
  dbmTarget: number; // In MT
  dbmTargetCum?: number; // In Cum
  dbmBalanceCum?: number;
  dbmVariance: number;
  dbmPercent: number;
  dbmUnit?: string;
  dbmSparkline: number[];
  isDbmOverachieved?: boolean;

  // BC metrics
  bcAchieved: number;
  bcAchievedCum?: number;
  bcAchievedTodayCum?: number;
  bcCumulativeCum?: number;
  bcTarget: number;
  bcTargetCum?: number;
  bcBalanceCum?: number;
  bcVariance: number;
  bcPercent: number;
  bcUnit?: string;
  bcSparkline: number[];
  isBcOverachieved?: boolean;

  // Linear length metrics (meters & km)
  millingDailyLengthM?: number;
  millingDailyLengthKm?: number;
  millingCumulativeLengthM?: number;
  millingCumulativeLengthKm?: number;

  tackcoatDailyLengthM?: number;
  tackcoatDailyLengthKm?: number;
  tackcoatCumulativeLengthM?: number;
  tackcoatCumulativeLengthKm?: number;

  dbmDailyLengthM?: number;
  dbmDailyLengthKm?: number;
  dbmCumulativeLengthM?: number;
  dbmCumulativeLengthKm?: number;

  bcDailyLengthM?: number;
  bcDailyLengthKm?: number;
  bcCumulativeLengthM?: number;
  bcCumulativeLengthKm?: number;

  overallAdherence: number;
  totalAnomaliesCount: number;
  excessQtyCount: number;
  excessDepthCount: number;
  offsetCount: number;
  dataQualityWarnings?: string[];
}

export interface DailyProgressComparison {
  date: string;
  displayDate: string;
  millingPlanned: number;
  millingAchieved: number;
  tackcoatPlanned: number;
  tackcoatAchieved: number;
  dbmPlanned: number;
  dbmAchieved: number;
  bcPlanned?: number;
  bcAchieved?: number;
  totalPlannedWeighted: number;
  totalAchievedWeighted: number;
  adherenceRate: number;
}

export interface QCTestLogItem {
  date: string;
  material: string;
  testName: string;
  location: string;
  sampleRef: string;
  criteria: string;
  result: string | number;
  status: 'Pass' | 'Fail' | 'Ok' | 'Pending';
  remarks: string;
}

export interface HighwayCorridorSegment {
  id: string;
  fromChainage: number;
  toChainage: number;
  activity: ActivityType;
  lane: string;
  date: string;
  achievedQty: number;
  hasAnomaly: boolean;
  anomalyDescription?: string;
  remarks: string;
}

export interface ScheduleMilestones {
  startDate: string;
  completionDate: string;
  reportDate: string;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
}

export interface SectionQuantityScope {
  sectionName: string;
  chainageSpan: string;
  lengthKm: number;
  millingSqm: { lhs: number; rhs: number; total: number };
  tackCoatSqm: { lhs: number; rhs: number; total: number };
  dbmCum: { lhs: number; rhs: number; total: number };
  bcCum: { lhs: number; rhs: number; total: number };
  roadMarkingSqm?: number;
  earthenShoulderCum?: number;
}

export interface ConsolidatedQuantityScope {
  millingSqm: { mcw: number; sr: number; total: number };
  tackCoatSqm: { mcw: number; sr: number; total: number };
  dbmCum: number;
  bcPmbCum: number;
  roadMarkingSqm: number;
  earthenShoulderCum: number;
}

export interface CumulativeAchievedQuantities {
  millingSqm: number;
  tackCoatSqm: number;
  dbmCum: number;
  bcCum: number;
}


