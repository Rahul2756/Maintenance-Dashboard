export type CellStatus = 
  | 'completed' 
  | 'in_progress' 
  | 'delayed' 
  | 'future_planned' 
  | 'planned' 
  | 'dps' 
  | 'under_construction' 
  | 'himalayan'
  | 'eligible_scope';

export type RoadStatusCategory = 
  | 'dps' 
  | 'under_construction' 
  | 'himalayan' 
  | 'completed' 
  | 'eligible_scope';

export type WorkZoneType = 'DPS' | 'UNDER_CONSTRUCTION' | 'HIMALAYAN';

export interface ChainageInterval {
  index: number;
  col: number;
  colLetter: string;
  fromChainage: string;
  toChainage: string;
  fromM: number;
  toM: number;
  lengthM: number;
  lengthRHS?: number;
  calculatedLengthM: number;
  hasLengthMismatch: boolean;
}

export interface ActivityDefinition {
  id: string;
  name: string;
  row: number;
}

export interface StripCell {
  status: CellStatus;
  text: string | null;
  cellAddr: string;
}

export interface WorkZoneAnnotation {
  id: string;
  side: 'LHS' | 'RHS';
  status: CellStatus;
  type: WorkZoneType;
  label: string;
  startIndex: number;
  endIndex: number;
  fromM: number;
  toM: number;
  fromChainage: string;
  toChainage: string;
  totalLengthM: number;
  intervalCount: number;
  startCol: string;
  endCol: string;
}

export interface CompletedWorkSubInterval {
  id: string;
  logRowIndex: number;
  date: string;
  fromM: number;
  toM: number;
  lengthM: number;
  activity: string;
  mappedActivityId: string;
  side: 'LHS' | 'RHS' | 'BHS';
  lane: string;
  achievedQty?: number;
  unit?: string;
  hasConflict?: boolean;
  conflictType?: 'dps' | 'under_construction' | 'himalayan';
  conflictReason?: string;
  overlapM?: number;
}

export interface SubIntervalFill {
  startPct: number; // 0 to 100 within segment
  widthPct: number; // 0 to 100 within segment
  fromM: number;
  toM: number;
  lengthM: number;
  isCompleted: boolean;
  isExclusion: boolean;
  exclusionType?: 'dps' | 'under_construction' | 'himalayan';
  hasConflict?: boolean;
  logRecords: CompletedWorkSubInterval[];
}

export interface SegmentActivityState {
  activityId: string;
  intervalIndex: number;
  baseStatus: 'dps' | 'under_construction' | 'himalayan' | 'eligible_scope';
  exclusionLabel?: string;
  subFills: SubIntervalFill[];
  completedLengthM: number;
  hasConflict: boolean;
  conflictDetails?: string;
}

export interface StripChartMetadata {
  title: string;
  chainageSpanText: string;
  startChainage: string;
  endChainage: string;
  startM: number;
  endM: number;
  totalLengthM: number;
  totalIntervals: number;
}

export interface DataConflictRecord {
  excelRow: number;
  date: string;
  side: string;
  activity: string;
  workRange: string;
  exclusionType: 'dps' | 'under_construction' | 'himalayan';
  exclusionSide: string;
  exclusionRange: string;
  overlapM: number;
}

export interface StripChartDataset {
  metadata: StripChartMetadata;
  lhsActivities: ActivityDefinition[];
  rhsActivities: ActivityDefinition[];
  intervals: ChainageInterval[];
  lhsCells: Record<string, StripCell[]>;
  rhsCells: Record<string, StripCell[]>;
  lhsWorkZones: WorkZoneAnnotation[];
  rhsWorkZones: WorkZoneAnnotation[];
  completedLogs?: CompletedWorkSubInterval[];
  availableDates?: string[];
  unmatchedActivities?: string[];
  conflicts?: DataConflictRecord[];
}
