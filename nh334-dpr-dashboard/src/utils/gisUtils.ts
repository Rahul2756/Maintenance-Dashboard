import gpsData from '../data/nh334GpsAlignment.json';
import defaultStripData from '../data/stripChartData.json';
import { GpsPoint, Landmark, RoadSegmentGeo } from '../types/gis';
import { ActualDPRRow, PlannedRecord, HighwaySide } from '../types/dpr';
import { StripChartDataset, WorkZoneAnnotation, CompletedWorkSubInterval, RoadStatusCategory } from '../types/stripChart';

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

// Exact colors matching the Highway Strip Chart taxonomy
export const STATUS_COLORS = {
  completed: '#10B981',           // Emerald Green (Completed by Our Team)
  dps: '#8B5CF6',                 // Purple / Indigo (Work Done by DPS)
  under_construction: '#D97706',  // Amber / Warm Gold (Under Construction)
  himalayan: '#EC4899',           // Pink / Rose (Himalayan)
  eligible_scope: '#0284C7',      // Sky Blue (Remaining Eligible Scope)
  in_progress: '#F59E0B',
  delayed: '#EF4444',
  planned: '#0284C7',
};

export const STRIP_ACTIVITIES = [
  { id: 'all', name: 'All Activities' },
  { id: 'road_marking', name: 'Road Marking' },
  { id: 'earthen_shoulder', name: 'Earthen Shoulder' },
  { id: 'bc_fw', name: 'BC (FW)' },
  { id: 'composite_glass_grid', name: 'Composite Glass Grid/Crack Sealing' },
  { id: 'dbm', name: 'DBM' },
  { id: 'milling_dbm', name: 'Milling DBM' },
];

export const ACTIVITY_COLORS: Record<string, string> = {
  'Milling': '#F59E0B',
  'Milling DBM': '#F59E0B',
  'milling_dbm': '#F59E0B',
  'Tackcoat': '#38BDF8',
  'Tack Coat': '#38BDF8',
  'DBM': '#10B981',
  'dbm': '#10B981',
  'BC': '#818CF8',
  'BC (FW)': '#818CF8',
  'bc_fw': '#818CF8',
  'Road Marking': '#F8FAFC',
  'road_marking': '#F8FAFC',
  'Earthen Shoulder': '#D97706',
  'earthen_shoulder': '#D97706',
  'Composite Glass Grid / Crack Sealing': '#A855F7',
  'composite_glass_grid': '#A855F7',
  'All': '#06B6D4',
  'all': '#06B6D4',
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
function normalizeActMatch(actName: string, filterAct: string): boolean {
  if (filterAct === 'All' || filterAct === 'all') return true;
  const f = filterAct.toLowerCase();
  const a = actName.toLowerCase();
  if (f.includes('milling') && a.includes('milling')) return true;
  if (f.includes('dbm') && a.includes('dbm') && !f.includes('milling') && !a.includes('milling') && !f.includes('tack') && !a.includes('tack')) return true;
  if ((f === 'bc' || f.includes('bc')) && (a === 'bc' || a.includes('bc')) && !f.includes('tack') && !a.includes('tack')) return true;
  if ((f.includes('tack') || f.includes('tackcoat')) && (a.includes('tack') || a.includes('tackcoat'))) return true;
  if ((f.includes('glass') || f.includes('grid')) && (a.includes('glass') || a.includes('grid'))) return true;
  if (f.includes('earthen') && a.includes('earthen')) return true;
  if (f.includes('marking') && a.includes('marking')) return true;
  return a === f;
}

/**
 * Builds geographical road segments matching the exact 5 status categories:
 * DPS (Purple), Under Construction (Orange), Himalayan (Magenta), Completed (Green), Eligible Scope (Cyan).
 */
export function buildGeoSegments(
  actualRows: ActualDPRRow[] = [],
  _plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  selectedActivity: string = 'all', // 'all' or activity id like 'milling_dbm', 'dbm', 'bc_fw'...
  sideFilter: HighwaySide = 'Both',  // 'Both' | 'LHS' | 'RHS'
  selectedDate: string | null = 'all' // 'all' or specific date e.g. '01-Nov-2026'
): RoadSegmentGeo[] {
  const dataset = stripDataset || (defaultStripData as unknown as StripChartDataset);
  if (!dataset || !dataset.intervals || dataset.intervals.length === 0) {
    return [];
  }

  const {
    intervals = [],
    lhsWorkZones = [],
    rhsWorkZones = [],
    completedLogs = [],
  } = dataset;

  const segments: RoadSegmentGeo[] = [];

  // Determine which carriageway sides to process
  const sidesToProcess: ('LHS' | 'RHS')[] = 
    sideFilter === 'LHS' ? ['LHS'] : sideFilter === 'RHS' ? ['RHS'] : ['LHS', 'RHS'];

  // Normalize activity filter
  const normActId = selectedActivity.trim().toLowerCase();
  const isAllActivities = normActId === 'all' || normActId === 'all activities';

  sidesToProcess.forEach((side) => {
    const workZones = side === 'LHS' ? lhsWorkZones : rhsWorkZones;

    intervals.forEach((inter) => {
      // -----------------------------------------------------------------------
      // Priority 1-3: Fixed Exclusions Check
      // -----------------------------------------------------------------------
      const ex = (workZones || []).find(
        w => inter.fromM >= w.fromM && inter.toM <= w.toM
      );

      if (ex) {
        const cat = ex.status as 'dps' | 'under_construction' | 'himalayan';
        let statusLabel = 'Special Work Zone';
        if (cat === 'dps') statusLabel = 'Work Done by DPS';
        else if (cat === 'under_construction') statusLabel = 'Under Construction';
        else if (cat === 'himalayan') statusLabel = 'Himalayan';

        const coords = getCoordinatesSlice(inter.fromM, inter.toM);
        const lenM = inter.toM - inter.fromM;

        segments.push({
          id: `${side.toLowerCase()}-${cat}-${inter.fromM}-${inter.toM}`,
          fromChainageM: inter.fromM,
          toChainageM: inter.toM,
          fromChainageFmt: formatChainageM(inter.fromM, ''),
          toChainageFmt: formatChainageM(inter.toM, ''),
          lengthM: lenM,
          coordinates: coords,
          side: side as HighwaySide,
          activity: 'Fixed Exclusion',
          activityId: 'exclusion',
          status: cat,
          statusCategory: cat,
          statusLabel,
          color: STATUS_COLORS[cat] || '#8B5CF6',
          isExclusion: true,
          exclusionType: cat,
          isCompleted: false,
          lane: 'MCW',
          sourceWorkbook: 'MH Project Strip chart KM wise - Format.xlsx (MH Strip Chart)',
          label: `${statusLabel} (${side}): Ch. ${formatChainageM(inter.fromM, '')} – ${formatChainageM(inter.toM, '')} (${lenM}m)`,
        });
        return;
      }

      // -----------------------------------------------------------------------
      // Priority 4 & 5: Eligible Scope (Completed vs Remaining)
      // -----------------------------------------------------------------------
      const activeLogs = (completedLogs || []).filter(l => {
        if (!l || !isFinite(l.fromM) || !isFinite(l.toM) || l.toM <= l.fromM) return false;
        // Activity filter
        if (!isAllActivities && l.mappedActivityId !== normActId) return false;
        // Side filter
        if (l.side !== 'BHS' && l.side !== side) return false;
        // Date filter
        if (selectedDate && selectedDate !== 'all' && l.date !== selectedDate) return false;
        // Interval intersection
        return Math.max(l.fromM, inter.fromM) < Math.min(l.toM, inter.toM);
      });

      if (activeLogs.length === 0) {
        // Entire interval is uncompleted eligible scope
        const coords = getCoordinatesSlice(inter.fromM, inter.toM);
        const lenM = inter.toM - inter.fromM;

        segments.push({
          id: `${side.toLowerCase()}-eligible-${inter.fromM}-${inter.toM}`,
          fromChainageM: inter.fromM,
          toChainageM: inter.toM,
          fromChainageFmt: formatChainageM(inter.fromM, ''),
          toChainageFmt: formatChainageM(inter.toM, ''),
          lengthM: lenM,
          coordinates: coords,
          side: side as HighwaySide,
          activity: isAllActivities ? 'Eligible Maintenance Scope' : (STRIP_ACTIVITIES.find(a => a.id === normActId)?.name || normActId),
          activityId: normActId,
          status: 'eligible_scope',
          statusCategory: 'eligible_scope',
          statusLabel: 'Remaining Eligible Scope',
          color: STATUS_COLORS.eligible_scope,
          isExclusion: false,
          isCompleted: false,
          lane: 'MCW',
          sourceWorkbook: 'final_sheet.xlsx (Scope & Work Program)',
          label: `Remaining Eligible Scope (${side}): Ch. ${formatChainageM(inter.fromM, '')} – ${formatChainageM(inter.toM, '')} (${lenM}m)`,
        });
      } else {
        // Merge overlapping completed logs within this interval
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
          // Uncompleted gap before completed slice
          if (m.fromM > curM) {
            const gapLen = m.fromM - curM;
            const gapCoords = getCoordinatesSlice(curM, m.fromM);
            segments.push({
              id: `${side.toLowerCase()}-eligible-${curM}-${m.fromM}`,
              fromChainageM: curM,
              toChainageM: m.fromM,
              fromChainageFmt: formatChainageM(curM, ''),
              toChainageFmt: formatChainageM(m.fromM, ''),
              lengthM: gapLen,
              coordinates: gapCoords,
              side: side as HighwaySide,
              activity: isAllActivities ? 'Eligible Maintenance Scope' : (STRIP_ACTIVITIES.find(a => a.id === normActId)?.name || normActId),
              activityId: normActId,
              status: 'eligible_scope',
              statusCategory: 'eligible_scope',
              statusLabel: 'Remaining Eligible Scope',
              color: STATUS_COLORS.eligible_scope,
              isExclusion: false,
              isCompleted: false,
              lane: 'MCW',
              sourceWorkbook: 'final_sheet.xlsx (Scope & Work Program)',
              label: `Remaining Eligible Scope (${side}): Ch. ${formatChainageM(curM, '')} – ${formatChainageM(m.fromM, '')} (${gapLen}m)`,
            });
          }

          // Completed slice
          const compLen = m.toM - m.fromM;
          const compCoords = getCoordinatesSlice(m.fromM, m.toM);
          const hasConflict = m.logs.some(l => l.hasConflict);
          const distinctActivities = Array.from(new Set(m.logs.map(l => l.activity))).join(', ');
          const distinctLanes = Array.from(new Set(m.logs.map(l => l.lane))).join(', ');
          const latestLogDate = m.logs[m.logs.length - 1]?.date || 'Recent';

          segments.push({
            id: `${side.toLowerCase()}-completed-${m.fromM}-${m.toM}-${mIdx}`,
            fromChainageM: m.fromM,
            toChainageM: m.toM,
            fromChainageFmt: formatChainageM(m.fromM, ''),
            toChainageFmt: formatChainageM(m.toM, ''),
            lengthM: compLen,
            coordinates: compCoords,
            side: side as HighwaySide,
            activity: distinctActivities || 'Completed Maintenance',
            activityId: normActId,
            status: 'completed',
            statusCategory: 'completed',
            statusLabel: 'Completed by Our Team',
            color: STATUS_COLORS.completed,
            isExclusion: false,
            isCompleted: true,
            hasConflict,
            conflictReason: m.logs.find(l => l.conflictReason)?.conflictReason,
            lane: distinctLanes || 'MCW',
            date: latestLogDate,
            logRecords: m.logs,
            sourceWorkbook: 'final_sheet.xlsx (Chainage Log(input))',
            label: `Completed (${side} • ${distinctActivities}): Ch. ${formatChainageM(m.fromM, '')} – ${formatChainageM(m.toM, '')} (${compLen}m)`,
          });

          curM = m.toM;
        });

        // Remaining gap after last completed slice in this interval
        if (curM < inter.toM) {
          const tailLen = inter.toM - curM;
          const tailCoords = getCoordinatesSlice(curM, inter.toM);
          segments.push({
            id: `${side.toLowerCase()}-eligible-${curM}-${inter.toM}`,
            fromChainageM: curM,
            toChainageM: inter.toM,
            fromChainageFmt: formatChainageM(curM, ''),
            toChainageFmt: formatChainageM(inter.toM, ''),
            lengthM: tailLen,
            coordinates: tailCoords,
            side: side as HighwaySide,
            activity: isAllActivities ? 'Eligible Maintenance Scope' : (STRIP_ACTIVITIES.find(a => a.id === normActId)?.name || normActId),
            activityId: normActId,
            status: 'eligible_scope',
            statusCategory: 'eligible_scope',
            statusLabel: 'Remaining Eligible Scope',
            color: STATUS_COLORS.eligible_scope,
            isExclusion: false,
            isCompleted: false,
            lane: 'MCW',
            sourceWorkbook: 'final_sheet.xlsx (Scope & Work Program)',
            label: `Remaining Eligible Scope (${side}): Ch. ${formatChainageM(curM, '')} – ${formatChainageM(inter.toM, '')} (${tailLen}m)`,
          });
        }
      }
    });
  });

  return segments;
}
