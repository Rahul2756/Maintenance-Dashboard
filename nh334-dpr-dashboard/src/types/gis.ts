import { ActivityType, HighwaySide, ActualDPRRow, PlannedRecord } from './dpr';

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

export interface RoadSegmentGeo {
  id: string;
  fromChainageM: number;
  toChainageM: number;
  fromChainageFmt: string;
  toChainageFmt: string;
  lengthM: number;
  coordinates: [number, number][]; // [lat, lon][]
  side: HighwaySide;
  activity: ActivityType | 'All';
  status: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'dps' | 'under_construction' | 'himalayan';
  label?: string;
  color: string;
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
}

export interface StreetViewLocation {
  lat: number;
  lon: number;
  chainageFmt: string;
  chainageM: number;
  heading?: number;
  pitch?: number;
}

