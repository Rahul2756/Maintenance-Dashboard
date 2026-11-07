import { ActivityType, HighwaySide, ActualDPRRow, PlannedRecord } from './dpr';
import { CompletedWorkSubInterval, CellStatus, RoadStatusCategory } from './stripChart';

export type MapMode = 'satellite' | 'hybrid' | 'roadmap' | '3d';

export interface GpsPoint {
  sno: number;
  chainageM: number;
  chainageFmt: string;
  lat: number;
  lon: number;
}

export interface Landmark {
  name: string;
  chainageM: number;
  chainageFmt: string;
  lat: number;
  lon: number;
  description: string;
}

export interface SelectedRoadSection {
  fromM: number;
  toM: number;
  fromChainageFmt: string;
  toChainageFmt: string;
  lengthM: number;
  side: HighwaySide;
  activity?: string;
  activityId?: string;
  status?: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'future_planned' | 'dps' | 'under_construction' | 'himalayan' | 'eligible_scope';
  statusLabel?: string;
  date?: string;
  achievedQty?: number;
  unit?: string;
  source?: 'strip_chart' | 'gis_map';
  label?: string;
  logRecords?: any[];
  hasConflict?: boolean;
  conflictReason?: string;
}

export interface RoadSegmentGeo {
  id: string;
  fromChainageM: number;
  toChainageM: number;
  fromChainageFmt: string;
  toChainageFmt: string;
  lengthM: number;
  coordinates: [number, number][]; // [lat, lon][]
  side: HighwaySide;
  activity: string;
  activityId?: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'dps' | 'under_construction' | 'himalayan' | 'eligible_scope';
  statusCategory: RoadStatusCategory;
  statusLabel: string;
  label?: string;
  color: string;
  lane?: string;
  date?: string;
  isExclusion?: boolean;
  exclusionType?: 'dps' | 'under_construction' | 'himalayan';
  isCompleted?: boolean;
  logRecords?: CompletedWorkSubInterval[];
  hasConflict?: boolean;
  conflictReason?: string;
  isUnmapped?: boolean;
  sourceWorkbook?: string;
  actualRow?: ActualDPRRow;
  plannedRecord?: PlannedRecord;
}

export interface InspectionDetails {
  chainageM: number;
  chainageFmt: string;
  lat: number;
  lon: number;
  nearestLandmark?: string;
  segment?: RoadSegmentGeo;
  actualRow?: ActualDPRRow;
  plannedRecord?: PlannedRecord;
  selectedSection?: SelectedRoadSection;
}

export interface StreetViewLocation {
  lat: number;
  lon: number;
  chainageFmt: string;
  chainageM: number;
  heading?: number;
  pitch?: number;
}
