import gpsData from '../data/nh334GpsAlignment.json';
import defaultStripData from '../data/stripChartData.json';
import wpSchedules from '../data/workProgramSchedules.json';
import { GpsPoint, Landmark, RoadSegmentGeo } from '../types/gis';
import { ActualDPRRow, PlannedRecord, HighwaySide } from '../types/dpr';
import { StripChartDataset, WorkZoneAnnotation, CompletedWorkSubInterval, RoadStatusCategory } from '../types/stripChart';
import { StateFilter, STATE_BOUNDARIES } from './stateFilterUtils';

export const GPS_POINTS: GpsPoint[] = gpsData.points as GpsPoint[];

export const CORRIDOR_EXTENT = {
  projectStartM: 130560,
  projectEndM: 206220,
  totalLengthM: 75660,
  minLat: 29.52684,
  maxLat: 30.00394,
  minLon: 77.72292,
  maxLon: 78.18989,
};

export const NH334_LANDMARKS: Landmark[] = [
  {
    name: 'Rampur Tiraha (Project Start)',
    chainageM: 130560,
    chainageFmt: '130+560',
    lat: 29.528838,
    lon: 77.727077,
    description: 'Project Corridor Start at Rampur Tiraha Junction (Muzaffarnagar North)'
  },
  {
    name: 'Purquazi Town & Toll Plaza',
    chainageM: 154000,
    chainageFmt: '154+000',
    lat: 29.702169,
    lon: 77.849717,
    description: 'Major transit junction & Purquazi Toll Plaza'
  },
  {
    name: 'Manglaur Bypass',
    chainageM: 169000,
    chainageFmt: '169+000',
    lat: 29.813454,
    lon: 77.896277,
    description: 'Entry to Uttarakhand State / Manglaur Bypass Start'
  },
  {
    name: 'Roorkee Cantonment & Canal Bridge',
    chainageM: 179000,
    chainageFmt: '179+000',
    lat: 29.878771,
    lon: 77.954541,
    description: 'Upper Ganga Canal Crossway & Roorkee City Bypass'
  },
  {
    name: 'Bahadrabad Industrial Zone',
    chainageM: 195000,
    chainageFmt: '195+000',
    lat: 29.93297,
    lon: 78.07765,
    description: 'Bahadrabad Flyover & Industrial Corridor'
  },
  {
    name: 'Jwalapur Junction',
    chainageM: 201000,
    chainageFmt: '201+000',
    lat: 29.95408,
    lon: 78.12879,
    description: 'Haridwar City Entry & Jwalapur Rail Overbridge'
  },
  {
    name: 'Haridwar (Project End)',
    chainageM: 206220,
    chainageFmt: '206+220',
    lat: 29.973201,
    lon: 78.181861,
    description: 'Haridwar Bypass End / Approach towards Rishikesh'
  }
];

// Exact colors matching the 4 Highway Progress statuses
export const STATUS_COLORS = {
  completed: '#10B981',           // Green (Completed)
  in_progress: '#06B6D4',         // Cyan (In Progress)
  planned: '#3B82F6',             // Blue (Planned)
  delayed: '#EF4444',             // Red (Delayed)
  dps: '#8B5CF6',
  under_construction: '#D97706',
  himalayan: '#EC4899',
  eligible_scope: '#3B82F6',
};

export const STRIP_ACTIVITIES = [
  { id: 'milling', name: 'Milling' },
  { id: 'tack_coat_dbm', name: 'Tack Coat (DBM)' },
  { id: 'dbm', name: 'DBM' },
  { id: 'tack_coat_bc', name: 'Tack Coat (BC)' },
  { id: 'bc', name: 'BC' },
];

export interface ConstructionStageDef {
  stage: number;
  id: string;
  name: string;
  colorHex: string;
  colorThree: number;
  predecessors: number[];
}

/**
 * Approved Unified Construction Execution Sequence and Colours:
 * 1: Milling -> Slate Grey (#64748B)
 * 2: Tack Coat (DBM) -> Amber (#F59E0B)
 * 3: DBM -> Blue (#2563EB)
 * 4: Tack Coat (BC) -> Violet (#8B5CF6)
 * 5: BC -> Green (#16A34A)
 */
export const CONSTRUCTION_STAGES: Record<number, ConstructionStageDef> = {
  1: {
    stage: 1,
    id: 'milling',
    name: 'Milling',
    colorHex: '#64748B',      // Slate Grey
    colorThree: 0x64748B,
    predecessors: []
  },
  2: {
    stage: 2,
    id: 'tack_coat_dbm',
    name: 'Tack Coat (DBM)',
    colorHex: '#F59E0B',      // Amber
    colorThree: 0xF59E0B,
    predecessors: [1]
  },
  3: {
    stage: 3,
    id: 'dbm',
    name: 'DBM',
    colorHex: '#2563EB',      // Blue
    colorThree: 0x2563EB,
    predecessors: [1, 2]
  },
  4: {
    stage: 4,
    id: 'tack_coat_bc',
    name: 'Tack Coat (BC)',
    colorHex: '#8B5CF6',      // Violet
    colorThree: 0x8B5CF6,
    predecessors: [1, 2, 3]
  },
  5: {
    stage: 5,
    id: 'bc',
    name: 'BC',
    colorHex: '#16A34A',      // Green
    colorThree: 0x16A34A,
    predecessors: [1, 2, 3, 4]
  }
};

export const SEQUENCE_INDICATOR_COLORS = {
  in_progress: '#06B6D4',
  deviation: '#EF4444',         // Solid Red (#EF4444)
  planned: '#CBD5E1',           // Silver Grey (#CBD5E1)
  not_started: '#CBD5E1',        // Maintained for backward compatibility
  not_started_dark: '#CBD5E1',
  not_started_light: '#CBD5E1',
};

/**
 * Normalizes any activity name or mapped ID to its sequence stage (1 to 5).
 * 1: Milling, 2: Tack Coat (DBM), 3: DBM, 4: Tack Coat (BC), 5: BC
 */
export function getActivityConstructionStage(activityName?: string, mappedId?: string): number {
  if (!activityName && !mappedId) return 0;
  const a = (activityName || '').trim().toLowerCase();
  const m = (mappedId || '').trim().toLowerCase();

  // 1. Milling
  if (a.includes('milling') || m.includes('milling')) {
    return 1;
  }

  // 4. Tack Coat (BC)
  if ((a.includes('tack') || a.includes('tackcoat') || m.includes('tack')) && (a.includes('bc') || m.includes('bc') || a.includes('wearing'))) {
    return 4;
  }

  // 2. Tack Coat (DBM)
  if (a.includes('tack') || a.includes('tackcoat') || m.includes('tack')) {
    return 2;
  }

  // 3. DBM (excluding milling & tack)
  if (a.includes('dbm') || m.includes('dbm')) {
    return 3;
  }

  // 5. BC
  if (a === 'bc' || a.includes('bc ') || a.includes('bc(') || a.includes('bc (') || m === 'bc' || m === 'bc_fw') {
    return 5;
  }

  return 0;
}

export const ACTIVITY_COLORS: Record<string, string> = {
  'Milling': '#64748B',
  'milling': '#64748B',
  'Tack Coat (DBM)': '#F59E0B',
  'tack_coat_dbm': '#F59E0B',
  'DBM': '#2563EB',
  'dbm': '#2563EB',
  'Tack Coat (BC)': '#8B5CF6',
  'tack_coat_bc': '#8B5CF6',
  'BC': '#16A34A',
  'bc': '#16A34A',
};

/**
 * Converts chainage string (e.g. "189+230", "189.23", "189230") to meters integer.
 */
export function parseChainageStrToM(str: string | number): number {
  if (typeof str === 'number') {
    return str < 1000 ? Math.round(str * 1000) : Math.round(str);
  }
  const clean = String(str).trim();
  if (clean.includes('+')) {
    const [km, m] = clean.split('+');
    return Math.round(parseFloat(km) * 1000 + (parseFloat(m) || 0));
  }
  const val = parseFloat(clean);
  if (isNaN(val)) return 0;
  return val < 1000 ? Math.round(val * 1000) : Math.round(val);
}

/**
 * Formats chainage meters to standard highway format "Ch. 189+230".
 */
export function formatChainageM(chainageM: number, prefix = 'Ch. '): string {
  const km = Math.floor(chainageM / 1000);
  const m = Math.round(Math.abs(chainageM % 1000));
  return `${prefix}${km}+${m.toString().padStart(3, '0')}`;
}

/**
 * Millimeter-accurate linear interpolation along the real NH-334 GPS alignment.
 */
export function getCoordinatesAtChainage(chainageM: number): [number, number] {
  if (!GPS_POINTS || GPS_POINTS.length === 0) return [29.8787, 77.9545];

  if (chainageM <= GPS_POINTS[0].chainageM) {
    return [GPS_POINTS[0].lat, GPS_POINTS[0].lon];
  }
  if (chainageM >= GPS_POINTS[GPS_POINTS.length - 1].chainageM) {
    const last = GPS_POINTS[GPS_POINTS.length - 1];
    return [last.lat, last.lon];
  }

  // Binary search for efficiency
  let low = 0;
  let high = GPS_POINTS.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (GPS_POINTS[mid].chainageM <= chainageM) {
      if (mid === GPS_POINTS.length - 1 || GPS_POINTS[mid + 1].chainageM > chainageM) {
        const p1 = GPS_POINTS[mid];
        const p2 = GPS_POINTS[mid + 1];
        const t = (chainageM - p1.chainageM) / (p2.chainageM - p1.chainageM || 1);
        const lat = p1.lat + t * (p2.lat - p1.lat);
        const lon = p1.lon + t * (p2.lon - p1.lon);
        return [lat, lon];
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return [GPS_POINTS[0].lat, GPS_POINTS[0].lon];
}

/**
 * Calculates a series of coordinate points along the highway between two chainages.
 * If side is 'LHS' or 'RHS', applies a subtle lateral offset perpendicular to the road heading.
 */
export function getCoordinatesSlice(fromM: number, toM: number, side: HighwaySide = 'Both'): [number, number][] {
  const startM = Math.min(fromM, toM);
  const endM = Math.max(fromM, toM);
  const coords: [number, number][] = [];

  coords.push(getCoordinatesAtChainage(startM));

  // Find all intermediate GPS points that fall between startM and endM
  for (const pt of GPS_POINTS) {
    if (pt.chainageM > startM && pt.chainageM < endM) {
      coords.push([pt.lat, pt.lon]);
    }
  }

  coords.push(getCoordinatesAtChainage(endM));

  // If specific carriageway (LHS vs RHS), compute perpendicular offset
  if (side === 'LHS' || side === 'RHS') {
    const offsetMagnitude = side === 'LHS' ? -0.00004 : 0.00004; // ~4m lateral shift
    return coords.map((c, i) => {
      const next = coords[Math.min(i + 1, coords.length - 1)];
      const prev = coords[Math.max(i - 1, 0)];
      const dLat = next[0] - prev[0];
      const dLon = next[1] - prev[1];
      const len = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
      // Perpendicular vector (-dLon, dLat)
      const pLat = (-dLon / len) * offsetMagnitude;
      const pLon = (dLat / len) * offsetMagnitude;
      return [c[0] + pLat, c[1] + pLon];
    });
  }

  return coords;
}

/**
 * Finds exact highway chainage in meters along the road centerline for any given lat/lon
 * using orthogonal projection onto adjacent road segments.
 */
export function getChainageAtCoordinates(lat: number, lon: number): {
  chainageM: number;
  chainageFmt: string;
  distanceM: number;
  nearestLandmark?: string;
} {
  let closestDistSq = Infinity;
  let bestChainageM = GPS_POINTS[0].chainageM;

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const x = lon * cosLat;
  const y = lat;

  for (let i = 0; i < GPS_POINTS.length - 1; i++) {
    const p1 = GPS_POINTS[i];
    const p2 = GPS_POINTS[i + 1];

    const x1 = p1.lon * cosLat;
    const y1 = p1.lat;
    const x2 = p2.lon * cosLat;
    const y2 = p2.lat;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);

    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      bestChainageM = Math.round(p1.chainageM + t * (p2.chainageM - p1.chainageM));
    }
  }

  const distanceM = Math.sqrt(closestDistSq) * 111319.5;

  // Find nearest landmark
  let nearestLandmark: string | undefined;
  let landmarkDist = Infinity;
  for (const lm of NH334_LANDMARKS) {
    const diff = Math.abs(lm.chainageM - bestChainageM);
    if (diff < landmarkDist && diff <= 5000) {
      landmarkDist = diff;
      nearestLandmark = lm.name;
    }
  }

  return {
    chainageM: bestChainageM,
    chainageFmt: formatChainageM(bestChainageM, ''),
    distanceM,
    nearestLandmark
  };
}

/**
 * Returns milestone markers along the NH-334 corridor at regular intervals.
 */
export function getMilestoneMarkers(intervalM = 5000): Array<{
  chainageM: number;
  chainageFmt: string;
  lat: number;
  lon: number;
  isMajor: boolean;
}> {
  const milestones: Array<{
    chainageM: number;
    chainageFmt: string;
    lat: number;
    lon: number;
    isMajor: boolean;
  }> = [];

  const startM = CORRIDOR_EXTENT.projectStartM;
  const endM = CORRIDOR_EXTENT.projectEndM;

  const [startLat, startLon] = getCoordinatesAtChainage(startM);
  milestones.push({
    chainageM: startM,
    chainageFmt: formatChainageM(startM, ''),
    lat: startLat,
    lon: startLon,
    isMajor: true
  });

  const firstTick = Math.ceil(startM / intervalM) * intervalM;
  for (let m = firstTick; m < endM; m += intervalM) {
    const [lat, lon] = getCoordinatesAtChainage(m);
    milestones.push({
      chainageM: m,
      chainageFmt: formatChainageM(m, ''),
      lat,
      lon,
      isMajor: m % 10000 === 0
    });
  }

  const [endLat, endLon] = getCoordinatesAtChainage(endM);
  milestones.push({
    chainageM: endM,
    chainageFmt: formatChainageM(endM, ''),
    lat: endLat,
    lon: endLon,
    isMajor: true
  });

  return milestones;
}

/**
 * Builds chainage-wise geographical road segments using the exact Strip Chart classification:
 * 1. Work Done by DPS
 * 2. Under Construction
 * 3. Himalayan
 * 4. Completed by Our Team
 * 5. Remaining Eligible Scope
 *
 * Slices are computed per interval, preserving exact From Ch and To Ch,
 * splitting road geometry down to the metre along the 798 GPS points.
 */
interface WPScheduleRow {
  activity: string;
  side: string;
  stretch: string;
  fromM: number;
  toM: number;
  weeks: {
    from: string;
    to: string;
    qty: number;
    isCompleted: boolean;
  }[];
}

/**
 * Normalizes activity name comparisons for the 5 core activities:
 * 1. Milling
 * 2. Tack Coat (DBM)
 * 3. DBM
 * 4. Tack Coat (BC)
 * 5. BC
 */
export function normalizeActMatch(actName: string, filterAct: string): boolean {
  if (!actName || !filterAct) return false;
  const a = actName.trim().toLowerCase();
  const f = filterAct.trim().toLowerCase();
  if (f === 'all') return true;

  // 1. Milling
  if (f === 'milling' || f === 'milling_dbm') {
    return a.includes('milling');
  }

  // 2. Tack Coat (DBM)
  if (f === 'tack_coat_dbm' || (f.includes('tack') && f.includes('dbm'))) {
    return (a.includes('tack') || a.includes('tackcoat')) && !a.includes('bc');
  }

  // 3. DBM (excluding milling and tack)
  if (f === 'dbm') {
    return a.includes('dbm') && !a.includes('milling') && !a.includes('tack');
  }

  // 4. Tack Coat (BC)
  if (f === 'tack_coat_bc' || (f.includes('tack') && (f.includes('bc') || f.includes('wearing')))) {
    return (a.includes('tack') || a.includes('tackcoat')) && (a.includes('bc') || a.includes('wearing'));
  }

  // 5. BC (excluding tack)
  if (f === 'bc' || f === 'bc_fw') {
    return (a === 'bc' || a.includes('bc ') || a.includes('bc(') || a.includes('bc (')) && !a.includes('tack');
  }

  return a === f;
}

export function parseDateStrToMs(dateStr?: string | null): number {
  if (!dateStr || dateStr === 'all') return Infinity;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str).getTime();
  }
  const parts = str.includes('-') ? str.split('-') : str.split('.');
  if (parts.length === 3) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mStr = parts[1].toLowerCase();
    const mIdx = months.indexOf(mStr);
    const m = mIdx >= 0 ? mIdx : (Number(parts[1]) - 1);
    const d = Number(parts[0]);
    const y = Number(parts[2]);
    return new Date(y, m, d).getTime();
  }
  return 0;
}

/**
 * Checks whether a chainage stretch was scheduled to be executed on or before reportDateMs
 * in the Work Program (Work Program.xlsx up to 01-Nov-2026, WP-R1 from 02-Nov-2026 onwards).
 */
export function isStretchPlannedOnOrBefore(
  fromM: number,
  toM: number,
  side: 'LHS' | 'RHS',
  actId: string,
  reportDateMs: number
): boolean {
  const effReportDateMs = (reportDateMs === 0 || !isFinite(reportDateMs))
    ? parseDateStrToMs('05-Nov-2026')
    : reportDateMs;

  const cutoffRevMs = parseDateStrToMs('02-Nov-2026');
  const sourceList: WPScheduleRow[] = effReportDateMs >= cutoffRevMs
    ? (wpSchedules.rev as WPScheduleRow[])
    : (wpSchedules.older as WPScheduleRow[]);

  for (const row of sourceList) {
    if (row.side !== 'BHS' && row.side !== side) continue;
    if (!normalizeActMatch(row.activity, actId)) continue;

    const overlapStart = Math.max(row.fromM, fromM);
    const overlapEnd = Math.min(row.toM, toM);
    if (overlapStart < overlapEnd) {
      for (const wk of row.weeks) {
        const wkStartMs = parseDateStrToMs(wk.from);
        if (wkStartMs <= effReportDateMs) {
          if (wk.qty > 0 || wk.isCompleted) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Builds unified construction-sequence road segments evaluating all 5 activities:
 * 1: Milling (#64748B) -> 2: Tack Coat DBM (#F59E0B) -> 3: DBM (#2563EB) -> 4: Tack Coat BC (#8B5CF6) -> 5: BC (#16A34A).
 * Automatically calculates accurate chainage distribution by slicing at activity boundaries,
 * detects sequence deviations (missing predecessors), and tags in-progress activities.
 */
export function buildConstructionSequenceSegments(
  actualRows: ActualDPRRow[] = [],
  _plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  sideFilter: HighwaySide = 'Both',
  selectedDate: string | null = 'all',
  stateFilter: StateFilter = 'All',
  isLight: boolean = false
): RoadSegmentGeo[] {
  const dataset = stripDataset || (defaultStripData as unknown as StripChartDataset);
  if (!dataset || !dataset.intervals || dataset.intervals.length === 0) {
    return [];
  }

  let {
    intervals = [],
    completedLogs = [],
  } = dataset;

  // Filter intervals and logs by state
  if (stateFilter && stateFilter !== 'All') {
    const boundary = STATE_BOUNDARIES[stateFilter];
    intervals = intervals.filter(inter => Math.max(inter.fromM, inter.toM) > boundary.minM && Math.min(inter.fromM, inter.toM) < boundary.maxM);
    completedLogs = (completedLogs || []).filter(l => Math.max(l.fromM, l.toM) > boundary.minM && Math.min(l.fromM, l.toM) < boundary.maxM);
  }

  const reportDateMs = (selectedDate && selectedDate !== 'all')
    ? parseDateStrToMs(selectedDate)
    : parseDateStrToMs('05-Nov-2026');

  const sidesToProcess: ('LHS' | 'RHS')[] = 
    sideFilter === 'LHS' ? ['LHS'] : sideFilter === 'RHS' ? ['RHS'] : ['LHS', 'RHS'];

  const plannedColor = '#CBD5E1'; // Planned: Silver Grey (#CBD5E1)
  const segments: RoadSegmentGeo[] = [];

  sidesToProcess.forEach(side => {
    const workZones = side === 'LHS' ? (dataset.lhsWorkZones || []) : (dataset.rhsWorkZones || []);
    const oosZones = workZones.filter(z => {
      const typeUpper = (z.type || z.status || '').toUpperCase();
      return typeUpper.includes('DPS') || typeUpper.includes('UNDER_CONSTRUCTION') || typeUpper.includes('HIMALAYAN');
    });

    // Filter logs for this side up to the evaluated report date (logDate <= reportDate)
    // and validate execution with Achieved Today (Column O) > 0 and valid intervals
    const sideLogs = (completedLogs || []).filter(l => {
      if (!l || !isFinite(l.fromM) || !isFinite(l.toM) || l.toM <= l.fromM) return false;
      if (l.side !== 'BHS' && l.side !== side) return false;
      if (l.achievedQty !== undefined && l.achievedQty <= 0) return false;
      const logMs = parseDateStrToMs(l.date);
      return logMs <= reportDateMs;
    });

    intervals.forEach(inter => {
      const iFrom = inter.fromM;
      const iTo = inter.toM;

      // Collect all slicing boundaries within [iFrom, iTo]
      const ptsSet = new Set<number>();
      ptsSet.add(iFrom);
      ptsSet.add(iTo);

      sideLogs.forEach(l => {
        if (l.fromM > iFrom && l.fromM < iTo) ptsSet.add(l.fromM);
        if (l.toM > iFrom && l.toM < iTo) ptsSet.add(l.toM);
      });

      oosZones.forEach(z => {
        if (z.fromM > iFrom && z.fromM < iTo) ptsSet.add(z.fromM);
        if (z.toM > iFrom && z.toM < iTo) ptsSet.add(z.toM);
      });

      const sortedPts = Array.from(ptsSet).sort((a, b) => a - b);

      for (let idx = 0; idx < sortedPts.length - 1; idx++) {
        const subFromM = sortedPts[idx];
        const subToM = sortedPts[idx + 1];
        const lenM = subToM - subFromM;
        if (lenM <= 0) continue;

        // Check if slice is within Out-of-Scope zone
        const oosMatch = oosZones.find(z => Math.max(z.fromM, subFromM) < Math.min(z.toM, subToM));
        if (oosMatch) {
          const oosType = (oosMatch.status === 'dps' || (oosMatch.type || '').toUpperCase().includes('DPS'))
            ? 'dps'
            : (oosMatch.status === 'under_construction' || (oosMatch.type || '').toUpperCase().includes('UNDER_CONSTRUCTION'))
            ? 'under_construction'
            : 'himalayan';
          const coords = getCoordinatesSlice(subFromM, subToM);

          segments.push({
            id: `${side.toLowerCase()}-${oosType}-${subFromM}-${subToM}`,
            fromChainageM: subFromM,
            toChainageM: subToM,
            fromChainageFmt: formatChainageM(subFromM, ''),
            toChainageFmt: formatChainageM(subToM, ''),
            lengthM: lenM,
            coordinates: coords,
            side: side as HighwaySide,
            activity: 'Out of Scope',
            status: oosType as any,
            statusCategory: oosType as any,
            statusLabel: oosMatch.label || (oosType === 'dps' ? 'Work Done by DPS' : oosType === 'under_construction' ? 'Under Construction' : 'Himalayan'),
            color: '', // Blank / no fill
            isExclusion: true,
            exclusionType: oosType as any,
            isCompleted: false,
            lane: 'MCW',
            sourceWorkbook: 'final_sheet.xlsx (Strip Chart Work Zones)',
            label: `Out of Scope - ${oosMatch.label} (${side}): Ch. ${formatChainageM(subFromM, '')} – ${formatChainageM(subToM, '')} (${lenM}m)`,
            latestStage: 0,
            latestStageName: 'Out of Scope',
            isInProgress: false,
            isDeviation: false,
            completedStages: [],
            isNotStarted: false,
          });
          continue;
        }

        // Find overlapping logs in this slice
        const sliceLogs = sideLogs.filter(l => Math.max(l.fromM, subFromM) < Math.min(l.toM, subToM));

        // Group logs by stage 1..5
        const stageLogsMap = new Map<number, CompletedWorkSubInterval[]>();
        sliceLogs.forEach(l => {
          const stg = getActivityConstructionStage(l.activity, l.mappedActivityId);
          if (stg > 0) {
            if (!stageLogsMap.has(stg)) stageLogsMap.set(stg, []);
            stageLogsMap.get(stg)!.push(l);
          }
        });

        const completedStages: number[] = [];
        let inProgressStage: number | undefined = undefined;

        for (let s = 1; s <= 5; s++) {
          const logsForStage = stageLogsMap.get(s);
          if (logsForStage && logsForStage.length > 0) {
            const isToday = selectedDate && selectedDate !== 'all' && logsForStage.some(l => l.date === selectedDate);
            if (isToday) {
              inProgressStage = s;
            } else {
              completedStages.push(s);
            }
          }
        }

        const latestCompletedStage = completedStages.length > 0 ? Math.max(...completedStages) : 0;
        const isInProgress = inProgressStage !== undefined && inProgressStage > latestCompletedStage;

        // Sequence Deviation Validation
        const allExecutedStages = Array.from(stageLogsMap.keys()).sort((a, b) => a - b);
        const highestExecutedStage = allExecutedStages.length > 0 ? Math.max(...allExecutedStages) : 0;

        let isDeviation = false;
        const missingPredecessors: string[] = [];

        if (highestExecutedStage > 1) {
          const reqPredecessors = CONSTRUCTION_STAGES[highestExecutedStage].predecessors;
          for (const pred of reqPredecessors) {
            const hasPred = completedStages.includes(pred) || stageLogsMap.has(pred);
            if (!hasPred) {
              isDeviation = true;
              missingPredecessors.push(CONSTRUCTION_STAGES[pred].name);
            }
          }
        }

        // Exclusive Colour Classification:
        // Rule 1: Display ONLY colour of latest successfully completed activity.
        // Rule 2: Sequence deviation -> SOLID RED (#EF4444) replaces activity colour. Takes absolute priority!
        // Rule 3: In-progress -> Retain previous successfully completed activity's colour (or Silver Grey Planned).
        let color = plannedColor;
        if (isDeviation) {
          color = '#EF4444'; // Solid Red (#EF4444)
        } else if (latestCompletedStage > 0) {
          color = CONSTRUCTION_STAGES[latestCompletedStage].colorHex;
        }

        const latestStageName = latestCompletedStage > 0 ? CONSTRUCTION_STAGES[latestCompletedStage].name : 'Planned';
        const inProgressStageName = (isInProgress && inProgressStage) ? CONSTRUCTION_STAGES[inProgressStage].name : undefined;

        const coords = getCoordinatesSlice(subFromM, subToM);
        const distinctLanes = Array.from(new Set(sliceLogs.map(l => l.lane).filter(Boolean))).join(', ') || 'MCW';
        const latestLogDate = sliceLogs[sliceLogs.length - 1]?.date || '';

        const statusCategory: RoadStatusCategory = latestCompletedStage > 0 ? 'completed' : 'eligible_scope';
        let statusLabel = 'Planned';
        let status: 'completed' | 'in_progress' | 'delayed' | 'planned' = 'planned';

        if (isDeviation) {
          status = 'delayed';
          statusLabel = `Sequence Deviation (${missingPredecessors.join(', ')} missing)`;
        } else if (isInProgress && inProgressStageName) {
          status = 'in_progress';
          statusLabel = `${inProgressStageName} (In Progress)`;
        } else if (latestCompletedStage > 0) {
          status = 'completed';
          statusLabel = `${latestStageName} (Completed)`;
        }

        segments.push({
          id: `${side.toLowerCase()}-seq-${subFromM}-${subToM}-${idx}`,
          fromChainageM: subFromM,
          toChainageM: subToM,
          fromChainageFmt: formatChainageM(subFromM, ''),
          toChainageFmt: formatChainageM(subToM, ''),
          lengthM: lenM,
          coordinates: coords,
          side: side as HighwaySide,
          activity: latestStageName,
          activityId: latestCompletedStage > 0 ? CONSTRUCTION_STAGES[latestCompletedStage].id : 'unexecuted',
          status,
          statusCategory,
          statusLabel,
          color,
          lane: distinctLanes,
          date: latestLogDate,
          isExclusion: false,
          isCompleted: latestCompletedStage > 0,
          logRecords: sliceLogs,
          sourceWorkbook: 'final_sheet.xlsx (Chainage Log(input))',
          label: `${statusLabel} (${side}): Ch. ${formatChainageM(subFromM, '')} – ${formatChainageM(subToM, '')} (${lenM}m)`,
          latestStage: latestCompletedStage,
          latestStageName,
          inProgressStage,
          inProgressStageName,
          isInProgress,
          isDeviation,
          missingPredecessors,
          deviationDescription: isDeviation ? `Sequence Deviation: Missing predecessor(s) ${missingPredecessors.join(', ')} before ${CONSTRUCTION_STAGES[highestExecutedStage].name}` : undefined,
          completedStages,
          isNotStarted: latestCompletedStage === 0,
        });
      }
    });
  });

  return segments;
}

/**
 * Builds geographical road segments using the unified Construction Execution Sequence.
 * Automatically evaluates all five construction activities simultaneously.
 */
export function buildGeoSegments(
  actualRows: ActualDPRRow[] = [],
  plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  _selectedActivity: string = 'milling', // Maintained for signature compatibility
  sideFilter: HighwaySide = 'Both',
  selectedDate: string | null = 'all',
  stateFilter: StateFilter = 'All',
  isLight: boolean = false
): RoadSegmentGeo[] {
  return buildConstructionSequenceSegments(
    actualRows,
    plannedRecords,
    stripDataset,
    sideFilter,
    selectedDate,
    stateFilter,
    isLight
  );
}

export interface Highway3DProgressSegment {
  id: string;
  fromChainage: number; // km
  toChainage: number;   // km
  fromChainageM: number;
  toChainageM: number;
  fromChainageFmt: string;
  toChainageFmt: string;
  lengthM: number;
  side: HighwaySide;
  lane: string;
  date: string;
  activity: string;
  activityId: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'dps' | 'under_construction' | 'himalayan';
  statusLabel: string;
  color: number;       // Three.js hex
  emissive: number;
  colorHex: string;
  isOutOfScope?: boolean;
  exclusionType?: 'dps' | 'under_construction' | 'himalayan';
  achievedQty: number;
  plannedQty: number;
  remainingQty: number;
  unit: string;
  progressPercent: number;
  widthM: number;
  depthM: number | null;
  depthMm?: number;
  isAnomaly: boolean;
  anomalyDescription: string;
  primaryRow?: ActualDPRRow;
  allRowsAtChainage?: ActualDPRRow[];
  plannedRecord?: PlannedRecord;
  startX: number;
  endX: number;
  centerZ: number;
  widthZ: number;
  // Unified Construction Sequence Fields:
  latestStage: number; // 0..5
  latestStageName: string;
  inProgressStage?: number;
  inProgressStageName?: string;
  isInProgress: boolean;
  isDeviation: boolean;
  missingPredecessors: string[];
  deviationDescription?: string;
  completedStages: number[];
  isNotStarted: boolean;
}

/**
 * Builds 3D Highway Road Segments directly from the unified Construction Execution Sequence.
 * Colors and intervals are mathematically identical to 2D Map segments.
 */
export function buildHighway3DProgressSegments(
  actualRows: ActualDPRRow[] = [],
  plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  selectedActivity: string = 'milling',
  sideFilter: HighwaySide = 'Both',
  selectedDate: string | null = 'all',
  kmToWorldX: (km: number) => number,
  isLight: boolean = false
): Highway3DProgressSegment[] {
  const dataset = stripDataset || (defaultStripData as unknown as StripChartDataset);
  if (!dataset || !dataset.intervals || dataset.intervals.length === 0) {
    return [];
  }

  const geoSegments = buildGeoSegments(
    actualRows,
    plannedRecords,
    dataset,
    selectedActivity,
    sideFilter,
    selectedDate,
    'All',
    isLight
  );

  const list: Highway3DProgressSegment[] = [];

  geoSegments.forEach((geo) => {
    const fromKm = geo.fromChainageM / 1000;
    const toKm = geo.toChainageM / 1000;
    const startX = kmToWorldX(fromKm);
    const endX = kmToWorldX(toKm);

    // Carriageway placement on Z axis:
    // LHS carriageway bed: centerZ = -5.25, widthZ = 7.5
    // RHS carriageway bed: centerZ = +5.25, widthZ = 7.5
    const centerZ = geo.side === 'LHS' ? -5.25 : 5.25;
    const widthZ = 7.5;

    const isOutOfScope = geo.isExclusion || geo.status === 'dps' || geo.status === 'under_construction' || geo.status === 'himalayan' || geo.statusCategory === 'dps' || geo.statusCategory === 'under_construction' || geo.statusCategory === 'himalayan';

    let threeColor = 0x94A3B8;
    let emissive = 0x000000;

    if (isOutOfScope) {
      threeColor = 0x000000;
      emissive = 0x000000;
    } else if (geo.isDeviation) {
      threeColor = 0xEF4444; // Solid Red (#EF4444) takes absolute priority
      emissive = 0x7F1D1D;
    } else if (geo.latestStage && geo.latestStage > 0) {
      threeColor = CONSTRUCTION_STAGES[geo.latestStage]?.colorThree || 0x64748B;
      if (geo.latestStage === 5) emissive = 0x065F46;
      else if (geo.latestStage === 4) emissive = 0x5B21B6;
      else if (geo.latestStage === 3) emissive = 0x1D4ED8;
      else if (geo.latestStage === 2) emissive = 0xB45309;
      else if (geo.latestStage === 1) emissive = 0x334155;
    } else {
      threeColor = 0xCBD5E1; // Planned: Silver Grey (0xCBD5E1)
      emissive = 0x000000;
    }

    // Match matching actual rows if any
    const matchingActuals = actualRows.filter(r => {
      if (geo.side !== 'Both' && r.side !== geo.side) return false;
      const rFromM = Math.min(r.fromChainage, r.toChainage) * 1000;
      const rToM = Math.max(r.fromChainage, r.toChainage) * 1000;
      return Math.max(rFromM, geo.fromChainageM) < Math.min(rToM, geo.toChainageM);
    });

    const primaryRow = matchingActuals[0];
    const achievedSum = matchingActuals.reduce((sum, r) => sum + r.achievedToday, 0);
    const plannedSum = matchingActuals.reduce((sum, r) => sum + (r.plannedToday || 0), 0) || Math.round(geo.lengthM * 3.5);
    const remainingSum = Math.max(0, plannedSum - achievedSum);
    const progressPercent = geo.latestStage === 5
      ? 100
      : geo.latestStage && geo.latestStage > 0
      ? Math.round((geo.latestStage / 5) * 100)
      : geo.isInProgress
      ? 15
      : 0;

    const hasAnomaly = matchingActuals.some(r => r.isAnomaly);
    const anomalyDesc = matchingActuals.find(r => r.isAnomaly)?.remarks ||
                        matchingActuals.find(r => r.isAnomaly)?.anomalyDescription || '';

    list.push({
      id: geo.id,
      fromChainage: fromKm,
      toChainage: toKm,
      fromChainageM: geo.fromChainageM,
      toChainageM: geo.toChainageM,
      fromChainageFmt: geo.fromChainageFmt,
      toChainageFmt: geo.toChainageFmt,
      lengthM: geo.lengthM,
      side: geo.side,
      lane: geo.lane || 'MCW',
      date: isOutOfScope ? 'Out of Scope' : (geo.date || (selectedDate && selectedDate !== 'all' ? selectedDate : 'Active Program')),
      activity: geo.activity,
      activityId: geo.activityId || 'sequence',
      status: geo.status as any,
      statusLabel: geo.statusLabel,
      color: threeColor,
      emissive,
      colorHex: isOutOfScope ? '' : (geo.isDeviation ? '#EF4444' : (geo.latestStage && geo.latestStage > 0 ? CONSTRUCTION_STAGES[geo.latestStage].colorHex : '#CBD5E1')),
      isOutOfScope,
      exclusionType: geo.exclusionType,
      achievedQty: isOutOfScope ? 0 : achievedSum,
      plannedQty: isOutOfScope ? 0 : plannedSum,
      remainingQty: isOutOfScope ? 0 : remainingSum,
      unit: isOutOfScope ? 'N/A' : (primaryRow?.unit || (geo.activity.toLowerCase().includes('cum') || geo.activity === 'DBM' ? 'Cum' : 'Sqm')),
      progressPercent: isOutOfScope ? 0 : progressPercent,
      widthM: primaryRow?.widthM || 3.5,
      depthM: primaryRow?.depthM || null,
      depthMm: primaryRow?.depthMm,
      isAnomaly: isOutOfScope ? false : hasAnomaly,
      anomalyDescription: isOutOfScope ? '' : anomalyDesc,
      primaryRow,
      allRowsAtChainage: matchingActuals,
      startX,
      endX,
      centerZ,
      widthZ,
      latestStage: geo.latestStage || 0,
      latestStageName: geo.latestStageName || 'Planned',
      inProgressStage: geo.inProgressStage,
      inProgressStageName: geo.inProgressStageName,
      isInProgress: !!geo.isInProgress,
      isDeviation: !!geo.isDeviation,
      missingPredecessors: geo.missingPredecessors || [],
      deviationDescription: geo.deviationDescription,
      completedStages: geo.completedStages || [],
      isNotStarted: !geo.latestStage || geo.latestStage === 0
    });
  });

  return list;
}

export interface StageAuditItem {
  stage: number;
  id: string;
  name: string;
  colorHex: string;
  status: 'completed' | 'partial' | 'pending';
  coveredM: number;
  coveragePercent: number;
}

export interface SectionExecutionAudit {
  sectionTitle: string;
  fromChainageM: number;
  toChainageM: number;
  lengthM: number;
  side: HighwaySide;
  isDeviation: boolean;
  deviationDescription?: string;
  causingActivity?: string;
  missingPredecessors: string[];
  completedActivities: StageAuditItem[];
  partialActivities: StageAuditItem[];
  pendingActivities: StageAuditItem[];
  allStages: StageAuditItem[];
  hasExecution: boolean;
}

/**
 * Computes precise activity execution audit for any highway chainage section from final_sheet.xlsx Chainage Log.
 * Evaluates the 5 sequential construction activities:
 * 1. Milling -> 2. Tack Coat (DBM) -> 3. DBM -> 4. Tack Coat (BC) -> 5. BC
 * Distinguishes Completed (full span), Partially Completed, and Pending (unexecuted) accurately.
 */
export function computeSectionExecutionAudit(
  fromM: number,
  toM: number,
  side: HighwaySide = 'Both',
  completedLogs: CompletedWorkSubInterval[] = []
): SectionExecutionAudit {
  const startM = Math.min(fromM, toM);
  const endM = Math.max(fromM, toM);
  const spanM = Math.max(1, endM - startM);

  const stageLogsMap = new Map<number, CompletedWorkSubInterval[]>();
  completedLogs.forEach(l => {
    if (!l || !isFinite(l.fromM) || !isFinite(l.toM) || l.toM <= l.fromM) return;
    if (side !== 'Both' && l.side !== 'BHS' && l.side !== side) return;
    if (l.achievedQty !== undefined && l.achievedQty <= 0) return;
    if (Math.max(l.fromM, startM) < Math.min(l.toM, endM)) {
      const stg = getActivityConstructionStage(l.activity, l.mappedActivityId);
      if (stg > 0) {
        if (!stageLogsMap.has(stg)) stageLogsMap.set(stg, []);
        stageLogsMap.get(stg)!.push(l);
      }
    }
  });

  const allStages: StageAuditItem[] = [];
  const completedActivities: StageAuditItem[] = [];
  const partialActivities: StageAuditItem[] = [];
  const pendingActivities: StageAuditItem[] = [];

  for (let s = 1; s <= 5; s++) {
    const stageDef = CONSTRUCTION_STAGES[s];
    const logs = stageLogsMap.get(s) || [];

    // Calculate covered span by merging overlapping intervals
    let coveredM = 0;
    if (logs.length > 0) {
      const intervals = logs.map(l => ({
        from: Math.max(l.fromM, startM),
        to: Math.min(l.toM, endM)
      })).filter(iv => iv.to > iv.from).sort((a, b) => a.from - b.from);

      if (intervals.length > 0) {
        const merged: { from: number; to: number }[] = [intervals[0]];
        for (let i = 1; i < intervals.length; i++) {
          const last = merged[merged.length - 1];
          const cur = intervals[i];
          if (cur.from <= last.to) {
            last.to = Math.max(last.to, cur.to);
          } else {
            merged.push(cur);
          }
        }
        coveredM = merged.reduce((sum, iv) => sum + (iv.to - iv.from), 0);
      }
    }

    const coveragePercent = Math.min(100, Math.round((coveredM / spanM) * 100));
    let status: 'completed' | 'partial' | 'pending' = 'pending';
    if (coveredM >= spanM - 1 || coveragePercent >= 98) {
      status = 'completed';
    } else if (coveredM > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }

    const item: StageAuditItem = {
      stage: s,
      id: stageDef.id,
      name: stageDef.name,
      colorHex: stageDef.colorHex,
      status,
      coveredM: Math.round(coveredM),
      coveragePercent
    };

    allStages.push(item);
    if (status === 'completed') completedActivities.push(item);
    else if (status === 'partial') partialActivities.push(item);
    else pendingActivities.push(item);
  }

  // Sequence Deviation Validation
  let isDeviation = false;
  let causingActivity: string | undefined = undefined;
  const missingPredecessors: string[] = [];

  for (let s = 2; s <= 5; s++) {
    const cur = allStages[s - 1];
    if (cur.coveredM > 0) {
      const preds = CONSTRUCTION_STAGES[s].predecessors;
      for (const p of preds) {
        const predStage = allStages[p - 1];
        if (predStage.status === 'pending') {
          isDeviation = true;
          if (!causingActivity) causingActivity = cur.name;
          if (!missingPredecessors.includes(predStage.name)) {
            missingPredecessors.push(predStage.name);
          }
        }
      }
    }
  }

  const deviationDescription = isDeviation && causingActivity
    ? `${causingActivity} executed without ${missingPredecessors.join(', ')}`
    : undefined;

  const sectionTitle = `Ch. ${formatChainageM(startM, '')} – ${formatChainageM(endM, '')}`;
  const hasExecution = completedActivities.length > 0 || partialActivities.length > 0;

  return {
    sectionTitle,
    fromChainageM: startM,
    toChainageM: endM,
    lengthM: spanM,
    side,
    isDeviation,
    deviationDescription,
    causingActivity,
    missingPredecessors,
    completedActivities,
    partialActivities,
    pendingActivities,
    allStages,
    hasExecution
  };
}
