export type CellStatus = 
  | 'completed' 
  | 'in_progress' 
  | 'delayed' 
  | 'future_planned' 
  | 'planned' 
  | 'dps' 
  | 'under_construction' 
  | 'himalayan';

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

export interface StripChartDataset {
  metadata: StripChartMetadata;
  lhsActivities: ActivityDefinition[];
  rhsActivities: ActivityDefinition[];
  intervals: ChainageInterval[];
  lhsCells: Record<string, StripCell[]>;
  rhsCells: Record<string, StripCell[]>;
  lhsWorkZones: WorkZoneAnnotation[];
  rhsWorkZones: WorkZoneAnnotation[];
}

