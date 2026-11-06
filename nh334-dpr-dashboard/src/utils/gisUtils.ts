import gpsData from '../data/nh334GpsAlignment.json';
import { GpsPoint, Landmark, RoadSegmentGeo } from '../types/gis';
import { ActualDPRRow, PlannedRecord, HighwaySide } from '../types/dpr';
import { StripChartDataset, WorkZoneAnnotation } from '../types/stripChart';

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

export const STATUS_COLORS = {
  completed: '#10B981',       // Emerald
  in_progress: '#F59E0B',     // Amber
  delayed: '#EF4444',         // Red
  planned: '#06B6D4',         // Cyan
  dps: '#6366F1',             // Indigo
  under_construction: '#F97316', // Orange
  himalayan: '#E11D48'        // Rose
};

export const ACTIVITY_COLORS: Record<string, string> = {
  'Milling': '#F59E0B',
  'Milling DBM': '#F59E0B',
  'Tackcoat': '#38BDF8',
  'Tack Coat': '#38BDF8',
  'DBM': '#10B981',
  'BC': '#818CF8',
  'BC (FW)': '#818CF8',
  'Road Marking': '#F8FAFC',
  'Earthen Shoulder': '#D97706',
  'Composite Glass Grid / Crack Sealing': '#A855F7',
  'All': '#06B6D4'
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
  const m = Math.round(chainageM % 1000);
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
 */
export function getCoordinatesSlice(fromM: number, toM: number): [number, number][] {
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
  return coords;
}

/**
 * Finds closest highway chainage and distance in meters to a given lat/lon.
 */
export function getChainageAtCoordinates(lat: number, lon: number): {
  chainageM: number;
  chainageFmt: string;
  distanceM: number;
  nearestLandmark?: string;
} {
  let closestDistSq = Infinity;
  let closestIdx = 0;

  for (let i = 0; i < GPS_POINTS.length; i++) {
    const p = GPS_POINTS[i];
    const dLat = p.lat - lat;
    const dLon = (p.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closestIdx = i;
    }
  }

  const pClosest = GPS_POINTS[closestIdx];
  const distanceM = Math.sqrt(closestDistSq) * 111319.5; // ~meters per degree

  // Find nearest landmark
  let nearestLandmark: string | undefined;
  let landmarkDist = Infinity;
  for (const lm of NH334_LANDMARKS) {
    const diff = Math.abs(lm.chainageM - pClosest.chainageM);
    if (diff < landmarkDist && diff <= 5000) {
      landmarkDist = diff;
      nearestLandmark = lm.name;
    }
  }

  return {
    chainageM: pClosest.chainageM,
    chainageFmt: pClosest.chainageFmt,
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

  // Always include project start
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

  // Regular intervals (e.g. 135+000, 140+000, 145+000...)
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

  // Always include project end
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
 * Builds geographical road segments matching the active DPR rows, Work Program, and Excel strip chart.
 */
export function buildGeoSegments(
  actualRows: ActualDPRRow[] = [],
  _plannedRecords: PlannedRecord[] = [],
  stripDataset: StripChartDataset | null = null,
  selectedActivity: string = 'All',
  sideFilter: HighwaySide = 'Both',
  statusFilter: string = 'all'
): RoadSegmentGeo[] {
  const segments: RoadSegmentGeo[] = [];

  // 1. If we have actual DPR execution records, map them to geocoded highway segments
  actualRows.forEach((row, idx) => {
    // Activity filter
    if (selectedActivity !== 'All' && row.activity.toLowerCase() !== selectedActivity.toLowerCase()) {
      return;
    }
    // Side filter
    if (sideFilter !== 'Both' && sideFilter !== 'ALL' && row.side !== sideFilter) {
      return;
    }

    const fromM = row.rawFromChainage || Math.round((row.fromChainage || 0) * 1000);
    const toM = row.rawToChainage || Math.round((row.toChainage || 0) * 1000);
    if (!fromM || !toM || fromM >= toM) return;

    // Status: executed rows are completed
    const status: RoadSegmentGeo['status'] = 'completed';
    if (statusFilter !== 'all' && statusFilter !== status) return;

    const coords = getCoordinatesSlice(fromM, toM);
    const color = STATUS_COLORS[status];

    segments.push({
      id: `actual-${row.id || idx}-${row.activity}-${fromM}-${toM}`,
      fromChainageM: fromM,
      toChainageM: toM,
      fromChainageFmt: formatChainageM(fromM, ''),
      toChainageFmt: formatChainageM(toM, ''),
      lengthM: row.lengthM || (toM - fromM),
      coordinates: coords,
      side: row.side,
      activity: row.activity,
      status,
      color,
      actualRow: row,
      label: `${row.activity} (${row.side}): ${row.achievedToday || ''} ${row.unit || ''}`
    });
  });

  // 2. If stripDataset has workZone annotations (Work Done by DPS, Under Construction, Himalayan), add them as prominent overlays
  if (stripDataset) {
    const allWorkZones: WorkZoneAnnotation[] = [
      ...(stripDataset.lhsWorkZones || []),
      ...(stripDataset.rhsWorkZones || [])
    ];

    allWorkZones.forEach((wz) => {
      const fromM = wz.fromM || parseChainageStrToM(wz.fromChainage);
      const toM = wz.toM || parseChainageStrToM(wz.toChainage);
      if (!fromM || !toM || fromM >= toM) return;

      if (sideFilter !== 'Both' && sideFilter !== 'ALL' && wz.side !== sideFilter) {
        return;
      }

      let status: RoadSegmentGeo['status'] = 'dps';
      let color = STATUS_COLORS.dps;
      const type = (wz.type || wz.label || '').toLowerCase();
      if (type.includes('himalayan')) {
        status = 'himalayan';
        color = STATUS_COLORS.himalayan;
      } else if (type.includes('construction')) {
        status = 'under_construction';
        color = STATUS_COLORS.under_construction;
      }

      const coords = getCoordinatesSlice(fromM, toM);

      segments.push({
        id: `workzone-${wz.id}-${fromM}-${toM}`,
        fromChainageM: fromM,
        toChainageM: toM,
        fromChainageFmt: wz.fromChainage,
        toChainageFmt: wz.toChainage,
        lengthM: wz.totalLengthM || (toM - fromM),
        coordinates: coords,
        side: wz.side as HighwaySide,
        activity: 'All',
        status,
        color,
        label: `${wz.label} (${wz.side}): Ch. ${wz.fromChainage} - ${wz.toChainage}`
      });
    });
  }

  // 3. Fallback / Base Corridor scope if no segments match
  if (segments.length === 0) {
    const startM = CORRIDOR_EXTENT.projectStartM;
    const endM = CORRIDOR_EXTENT.projectEndM;
    segments.push({
      id: 'base-corridor-extent',
      fromChainageM: startM,
      toChainageM: endM,
      fromChainageFmt: '130+560',
      toChainageFmt: '206+220',
      lengthM: endM - startM,
      coordinates: getCoordinatesSlice(startM, endM),
      side: 'Both' as HighwaySide,
      activity: 'All',
      status: 'planned',
      color: STATUS_COLORS.planned,
      label: 'NH-334 Project Corridor Scope (Ch. 130+560 to 206+220)'
    });
  }

  return segments;
}
