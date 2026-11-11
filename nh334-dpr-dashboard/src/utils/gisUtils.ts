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

export const ACTIVITY_COLORS: Record<string, string> = {
  'Milling': '#F59E0B',
  'milling': '#F59E0B',
  'Tack Coat (DBM)': '#38BDF8',
  'tack_coat_dbm': '#38BDF8',
  'DBM': '#10B981',
  'dbm': '#10B981',
  'Tack Coat (BC)': '#06B6D4',
  'tack_coat_bc': '#06B6D4',
  'BC': '#818CF8',
  'bc': '#818CF8',
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
 * Builds geographical road segments matching the 4 progress status categories:
 * Completed (Green), In Progress (Cyan), Planned (Blue), Delayed (Red).
 */
export function buildGeoSegments(
  actualRows: ActualDPRRow[] = [],
  _plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  selectedActivity: string = 'milling', // default to 'milling'
  sideFilter: HighwaySide = 'Both',  // 'Both' | 'LHS' | 'RHS'
  selectedDate: string | null = 'all', // 'all' or specific date e.g. '01-Nov-2026'
  stateFilter: StateFilter = 'All'
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

  const segments: RoadSegmentGeo[] = [];

  // Determine which carriageway sides to process
  const sidesToProcess: ('LHS' | 'RHS')[] = 
    sideFilter === 'LHS' ? ['LHS'] : sideFilter === 'RHS' ? ['RHS'] : ['LHS', 'RHS'];

  // Normalize activity filter
  const normActId = selectedActivity.trim().toLowerCase();
  const currentActivityObj = STRIP_ACTIVITIES.find(a => a.id === normActId) || STRIP_ACTIVITIES[0];
  const activeActivityName = currentActivityObj?.name || 'Milling';

  const reportDateMs = (selectedDate && selectedDate !== 'all')
    ? parseDateStrToMs(selectedDate)
    : parseDateStrToMs('05-Nov-2026');

  // Filter logs matching the selected activity
  const matchedLogs = (completedLogs || []).filter(l => {
    if (!l || !isFinite(l.fromM) || !isFinite(l.toM) || l.toM <= l.fromM) return false;
    return normalizeActMatch(l.activity, normActId) || l.mappedActivityId === normActId;
  });

  const wpSourceName = reportDateMs >= parseDateStrToMs('02-Nov-2026')
    ? 'Revised Work program-R-1_05-11-2026.xlsx (WP-R1)'
    : 'Work Program.xlsx (Work Program)';

  sidesToProcess.forEach((side) => {
    const workZones = side === 'LHS' ? (dataset.lhsWorkZones || []) : (dataset.rhsWorkZones || []);

    intervals.forEach((inter) => {
      // Check if this interval is an Out-of-Scope zone from Strip Chart:
      // (Work Done by DPS, Under Construction, Himalayan)
      const oosZone = workZones.find(z => {
        const typeUpper = (z.type || z.status || '').toUpperCase();
        const isOOS = typeUpper.includes('DPS') || typeUpper.includes('UNDER_CONSTRUCTION') || typeUpper.includes('HIMALAYAN');
        return isOOS && Math.max(z.fromM, inter.fromM) < Math.min(z.toM, inter.toM);
      });

      if (oosZone) {
        // Out of Scope: kept in "no fill" format (blank road, no color overlay)
        const oosType = (oosZone.status === 'dps' || (oosZone.type || '').toUpperCase().includes('DPS'))
          ? 'dps'
          : (oosZone.status === 'under_construction' || (oosZone.type || '').toUpperCase().includes('UNDER_CONSTRUCTION'))
          ? 'under_construction'
          : 'himalayan';
        const coords = getCoordinatesSlice(inter.fromM, inter.toM);
        const lenM = inter.toM - inter.fromM;

        segments.push({
          id: `${side.toLowerCase()}-${oosType}-${inter.fromM}-${inter.toM}`,
          fromChainageM: inter.fromM,
          toChainageM: inter.toM,
          fromChainageFmt: formatChainageM(inter.fromM, ''),
          toChainageFmt: formatChainageM(inter.toM, ''),
          lengthM: lenM,
          coordinates: coords,
          side: side as HighwaySide,
          activity: activeActivityName,
          activityId: normActId,
          status: oosType as any,
          statusCategory: oosType as any,
          statusLabel: oosZone.label || (oosType === 'dps' ? 'Work Done by DPS' : oosType === 'under_construction' ? 'Under Construction' : 'Himalayan'),
          color: '', // no fill / blank
          isExclusion: true,
          exclusionType: oosType as any,
          isCompleted: false,
          lane: 'MCW',
          sourceWorkbook: 'final_sheet.xlsx (Strip Chart Work Zones)',
          label: `Out of Scope - ${oosZone.label} (${side}): Ch. ${formatChainageM(inter.fromM, '')} – ${formatChainageM(inter.toM, '')} (${lenM}m)`,
        });
        return;
      }

      // Find logs overlapping this interval and executed on or before reportDate
      const activeLogs = matchedLogs.filter(l => {
        if (l.side !== 'BHS' && l.side !== side) return false;
        const logMs = parseDateStrToMs(l.date);
        if (logMs > reportDateMs) return false;
        return Math.max(l.fromM, inter.fromM) < Math.min(l.toM, inter.toM);
      });

      if (activeLogs.length === 0) {
        // Entire interval has no execution: determine whether overdue/delayed or future planned
        const isDelayed = isStretchPlannedOnOrBefore(inter.fromM, inter.toM, side, normActId, reportDateMs);
        const status: 'delayed' | 'planned' = isDelayed ? 'delayed' : 'planned';
        const statusLabel = isDelayed ? 'Delayed' : 'Planned';
        const color = isDelayed ? STATUS_COLORS.delayed : STATUS_COLORS.planned;
        const coords = getCoordinatesSlice(inter.fromM, inter.toM);
        const lenM = inter.toM - inter.fromM;

        segments.push({
          id: `${side.toLowerCase()}-${status}-${inter.fromM}-${inter.toM}`,
          fromChainageM: inter.fromM,
          toChainageM: inter.toM,
          fromChainageFmt: formatChainageM(inter.fromM, ''),
          toChainageFmt: formatChainageM(inter.toM, ''),
          lengthM: lenM,
          coordinates: coords,
          side: side as HighwaySide,
          activity: activeActivityName,
          activityId: normActId,
          status,
          statusCategory: 'eligible_scope',
          statusLabel,
          color,
          isExclusion: false,
          isCompleted: false,
          lane: 'MCW',
          sourceWorkbook: wpSourceName,
          label: `${statusLabel} (${side}): Ch. ${formatChainageM(inter.fromM, '')} – ${formatChainageM(inter.toM, '')} (${lenM}m)`,
        });
      } else {
        // Interval has execution logs
        const clamped = activeLogs
          .map(l => ({
            fromM: Math.max(l.fromM, inter.fromM),
            toM: Math.min(l.toM, inter.toM),
            log: l,
          }))
          .sort((a, b) => a.fromM - b.fromM);

        const merged: { fromM: number; toM: number; logs: CompletedWorkSubInterval[] }[] = [];
        clamped.forEach(c => {
          if (merged.length === 0) {
            merged.push({ fromM: c.fromM, toM: c.toM, logs: [c.log] });
          } else {
            const last = merged[merged.length - 1];
            if (c.fromM <= last.toM) {
              last.toM = Math.max(last.toM, c.toM);
              last.logs.push(c.log);
            } else {
              merged.push({ fromM: c.fromM, toM: c.toM, logs: [c.log] });
            }
          }
        });

        let curM = inter.fromM;
        merged.forEach((m, mIdx) => {
          // Uncompleted gap before executed slice
          if (m.fromM > curM) {
            const gapLen = m.fromM - curM;
            const gapCoords = getCoordinatesSlice(curM, m.fromM);
            const isDelayed = isStretchPlannedOnOrBefore(curM, m.fromM, side, normActId, reportDateMs);
            const status: 'delayed' | 'planned' = isDelayed ? 'delayed' : 'planned';
            const statusLabel = isDelayed ? 'Delayed' : 'Planned';
            const color = isDelayed ? STATUS_COLORS.delayed : STATUS_COLORS.planned;

            segments.push({
              id: `${side.toLowerCase()}-${status}-${curM}-${m.fromM}`,
              fromChainageM: curM,
              toChainageM: m.fromM,
              fromChainageFmt: formatChainageM(curM, ''),
              toChainageFmt: formatChainageM(m.fromM, ''),
              lengthM: gapLen,
              coordinates: gapCoords,
              side: side as HighwaySide,
              activity: activeActivityName,
              activityId: normActId,
              status,
              statusCategory: 'eligible_scope',
              statusLabel,
              color,
              isExclusion: false,
              isCompleted: false,
              lane: 'MCW',
              sourceWorkbook: wpSourceName,
              label: `${statusLabel} (${side}): Ch. ${formatChainageM(curM, '')} – ${formatChainageM(m.fromM, '')} (${gapLen}m)`,
            });
          }

          // Executed slice: determine completed vs in_progress
          const compLen = m.toM - m.fromM;
          const compCoords = getCoordinatesSlice(m.fromM, m.toM);
          const hasConflict = m.logs.some(l => l.hasConflict);
          const distinctActivities = Array.from(new Set(m.logs.map(l => l.activity))).join(', ') || activeActivityName;
          const distinctLanes = Array.from(new Set(m.logs.map(l => l.lane))).join(', ');
          const latestLogDate = m.logs[m.logs.length - 1]?.date || '';
          const isTodayLog = selectedDate && selectedDate !== 'all' && latestLogDate === selectedDate;
          const status: 'in_progress' | 'completed' = isTodayLog ? 'in_progress' : 'completed';
          const statusLabel = isTodayLog ? 'In Progress' : 'Completed';
          const color = isTodayLog ? STATUS_COLORS.in_progress : STATUS_COLORS.completed;

          segments.push({
            id: `${side.toLowerCase()}-${status}-${m.fromM}-${m.toM}-${mIdx}`,
            fromChainageM: m.fromM,
            toChainageM: m.toM,
            fromChainageFmt: formatChainageM(m.fromM, ''),
            toChainageFmt: formatChainageM(m.toM, ''),
            lengthM: compLen,
            coordinates: compCoords,
            side: side as HighwaySide,
            activity: distinctActivities,
            activityId: normActId,
            status,
            statusCategory: 'completed',
            statusLabel,
            color,
            isExclusion: false,
            isCompleted: true,
            hasConflict,
            conflictReason: m.logs.find(l => l.conflictReason)?.conflictReason,
            lane: distinctLanes || 'MCW',
            date: latestLogDate,
            logRecords: m.logs,
            sourceWorkbook: 'final_sheet.xlsx (Chainage Log(input))',
            label: `${statusLabel} (${side} • ${distinctActivities}): Ch. ${formatChainageM(m.fromM, '')} – ${formatChainageM(m.toM, '')} (${compLen}m)`,
          });

          curM = m.toM;
        });

        // Remaining gap after last executed slice in this interval
        if (curM < inter.toM) {
          const tailLen = inter.toM - curM;
          const tailCoords = getCoordinatesSlice(curM, inter.toM);
          const isDelayed = isStretchPlannedOnOrBefore(curM, inter.toM, side, normActId, reportDateMs);
          const status: 'delayed' | 'planned' = isDelayed ? 'delayed' : 'planned';
          const statusLabel = isDelayed ? 'Delayed' : 'Planned';
          const color = isDelayed ? STATUS_COLORS.delayed : STATUS_COLORS.planned;

          segments.push({
            id: `${side.toLowerCase()}-${status}-${curM}-${inter.toM}`,
            fromChainageM: curM,
            toChainageM: inter.toM,
            fromChainageFmt: formatChainageM(curM, ''),
            toChainageFmt: formatChainageM(inter.toM, ''),
            lengthM: tailLen,
            coordinates: tailCoords,
            side: side as HighwaySide,
            activity: activeActivityName,
            activityId: normActId,
            status,
            statusCategory: 'eligible_scope',
            statusLabel,
            color,
            isExclusion: false,
            isCompleted: false,
            lane: 'MCW',
            sourceWorkbook: wpSourceName,
            label: `${statusLabel} (${side}): Ch. ${formatChainageM(curM, '')} – ${formatChainageM(inter.toM, '')} (${tailLen}m)`,
          });
        }
      }
    });
  });

  return segments;
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
}

/**
 * Builds 3D Highway Road Segments directly from the Strip Chart dataset and Work Program logic.
 * In-scope segments are colored with one of the four exact statuses:
 * Completed (Green), In Progress (Cyan), Planned (Blue), Delayed (Red).
 * Out-of-scope segments (Work by DPS, Under Construction, Himalayan) are kept in "no fill" format.
 */
export function buildHighway3DProgressSegments(
  actualRows: ActualDPRRow[] = [],
  plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  selectedActivity: string = 'milling',
  sideFilter: HighwaySide = 'Both',
  selectedDate: string | null = 'all',
  kmToWorldX: (km: number) => number
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
    selectedDate
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

    // Status colors:
    let threeColor = 0x10B981;
    let emissive = 0x065F46;
    if (isOutOfScope) {
      threeColor = 0x000000;
      emissive = 0x000000;
    } else if (geo.status === 'in_progress') {
      threeColor = 0x06B6D4;
      emissive = 0x0891B2;
    } else if (geo.status === 'planned') {
      threeColor = 0x3B82F6;
      emissive = 0x1D4ED8;
    } else if (geo.status === 'delayed') {
      threeColor = 0xEF4444;
      emissive = 0x991B1B;
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
    const progressPercent = geo.status === 'completed'
      ? 100
      : geo.status === 'in_progress'
      ? Math.max(30, plannedSum > 0 ? Math.min(95, Math.round((achievedSum / plannedSum) * 100)) : 50)
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
      activityId: geo.activityId || 'milling',
      status: geo.status as any,
      statusLabel: geo.statusLabel,
      color: threeColor,
      emissive,
      colorHex: isOutOfScope ? '' : geo.color,
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
      widthZ
    });
  });

  return list;
}
