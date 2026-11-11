import * as XLSX from 'xlsx';
import {
  StripChartDataset,
  ChainageInterval,
  ActivityDefinition,
  StripCell,
  WorkZoneAnnotation,
  CellStatus,
  WorkZoneType,
  CompletedWorkSubInterval,
  SubIntervalFill,
  DataConflictRecord,
} from '../types/stripChart';
import defaultStripData from '../data/stripChartData.json';

let cachedDataset: StripChartDataset | null = null;

export function parseChainage(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).trim();
  if (str.includes('+')) {
    const parts = str.split('+');
    const km = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return km * 1000 + m;
  }
  return parseInt(str, 10) || 0;
}

export function formatChainage(metres: number): string {
  const km = Math.floor(metres / 1000);
  const m = Math.abs(metres % 1000);
  return `${km}+${String(m).padStart(3, '0')}`;
}

export function getCellStatus(cell: any): CellStatus {
  if (!cell) return 'eligible_scope';
  const val = cell.v ? String(cell.v).trim().toLowerCase() : '';
  const fg = cell.s && cell.s.fgColor;

  if (val.includes('dps') || (fg && fg.theme === 0 && fg.tint !== undefined)) {
    return 'dps';
  }
  if (val.includes('construction') || (fg && (fg.rgb === '948A54' || fg.theme === 2))) {
    return 'under_construction';
  }
  if (val.includes('himalayan') || (fg && (fg.rgb === 'FCD5B5' || fg.theme === 9))) {
    return 'himalayan';
  }
  return 'eligible_scope';
}

export function excelDateToStr(serial: unknown): string {
  if (!serial) return '';
  if (typeof serial === 'string') {
    // If already in DD-Mon-YYYY or DD.MM.YYYY format
    if (serial.includes('-') || serial.includes('.')) return serial;
    const num = Number(serial);
    if (isNaN(num)) return serial;
    serial = num;
  }
  if (typeof serial === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + serial * 86400000);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = monthNames[d.getUTCMonth()];
    const yr = d.getUTCFullYear();
    return `${day}-${mon}-${yr}`;
  }
  return String(serial);
}

export function mapToStripActivity(act: string): string | null {
  const a = (act || '').toLowerCase().trim();
  if (a.includes('milling')) return 'milling_dbm';
  if (a === 'dbm') return 'dbm';
  if (a === 'bc' || a.includes('bc (fw)') || a.includes('bc -')) return 'bc_fw';
  if (a.includes('glass') || a.includes('crack') || a.includes('grid')) return 'composite_glass_grid';
  if (a.includes('earthen') || a.includes('shoulder')) return 'earthen_shoulder';
  if (a.includes('marking')) return 'road_marking';
  return null;
}

export function unionIntervals(list: { fromM: number; toM: number }[]): { fromM: number; toM: number }[] {
  const valid = (list || []).filter(
    i => i && typeof i.fromM === 'number' && typeof i.toM === 'number' && isFinite(i.fromM) && isFinite(i.toM) && i.toM > i.fromM
  );
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => a.fromM - b.fromM);
  const res: { fromM: number; toM: number }[] = [{ fromM: sorted[0].fromM, toM: sorted[0].toM }];
  for (let i = 1; i < sorted.length; i++) {
    const last = res[res.length - 1];
    const cur = sorted[i];
    if (cur.fromM <= last.toM) {
      last.toM = Math.max(last.toM, cur.toM);
    } else {
      res.push({ fromM: cur.fromM, toM: cur.toM });
    }
  }
  return res;
}

export function parseStripChartWorkbook(wb: XLSX.WorkBook, finalWb?: XLSX.WorkBook): StripChartDataset {
  const sheetName = wb.SheetNames.find(n => n.includes('Strip Chart') || n.includes('MH Strip')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    return defaultStripData as unknown as StripChartDataset;
  }

  const title = ws['A1'] ? String(ws['A1'].v).trim() : 'Muzaffarnagar to Haridwar (MH) Project Strip Chart KM Wise';
  const span = ws['A2'] ? String(ws['A2'].v).trim() : '130+560 to 206+200';

  const lhsActivityDefs: ActivityDefinition[] = [
    { id: 'road_marking', name: 'Road Marking', row: 2 },
    { id: 'earthen_shoulder', name: 'Earthen Shoulder', row: 3 },
    { id: 'bc_fw', name: 'BC (FW)', row: 4 },
    { id: 'composite_glass_grid', name: 'Composite Glass Grid/Crack Sealing', row: 5 },
    { id: 'dbm', name: 'DBM', row: 6 },
    { id: 'milling_dbm', name: 'Milling DBM', row: 7 },
  ];

  const rhsActivityDefs: ActivityDefinition[] = [
    { id: 'milling_dbm', name: 'Milling DBM', row: 12 },
    { id: 'dbm', name: 'DBM', row: 13 },
    { id: 'composite_glass_grid', name: 'Composite Glass Grid/Crack Sealing', row: 14 },
    { id: 'bc_fw', name: 'BC (FW)', row: 15 },
    { id: 'earthen_shoulder', name: 'Earthen Shoulder', row: 16 },
    { id: 'road_marking', name: 'Road Marking', row: 17 },
  ];

  const intervals: ChainageInterval[] = [];
  for (let c = 3; c <= 97; c++) {
    const fromCell = ws[XLSX.utils.encode_cell({ r: 10, c })];
    const toCell = ws[XLSX.utils.encode_cell({ r: 9, c })];
    const lenLhsCell = ws[XLSX.utils.encode_cell({ r: 8, c })];
    const lenRhsCell = ws[XLSX.utils.encode_cell({ r: 11, c })];

    if (!fromCell && !toCell && !lenLhsCell) break;

    const fromM = parseChainage(fromCell?.v);
    const toM = parseChainage(toCell?.v);
    const lengthM = Number(lenLhsCell?.v) || (toM - fromM);
    const lengthRHS = Number(lenRhsCell?.v) || lengthM;

    intervals.push({
      index: c - 3,
      col: c,
      colLetter: XLSX.utils.encode_col(c),
      fromChainage: formatChainage(fromM),
      toChainage: formatChainage(toM),
      fromM,
      toM,
      lengthM,
      lengthRHS,
      calculatedLengthM: toM - fromM,
      hasLengthMismatch: lengthM !== (toM - fromM),
    });
  }

  const lhsCells: Record<string, StripCell[]> = {};
  const rhsCells: Record<string, StripCell[]> = {};

  lhsActivityDefs.forEach(act => {
    lhsCells[act.id] = intervals.map(inter => {
      const addr = XLSX.utils.encode_cell({ r: act.row, c: inter.col });
      const cell = ws[addr];
      return {
        status: getCellStatus(cell),
        text: cell && cell.v ? String(cell.v).trim() : null,
        cellAddr: addr,
      };
    });
  });

  rhsActivityDefs.forEach(act => {
    rhsCells[act.id] = intervals.map(inter => {
      const addr = XLSX.utils.encode_cell({ r: act.row, c: inter.col });
      const cell = ws[addr];
      return {
        status: getCellStatus(cell),
        text: cell && cell.v ? String(cell.v).trim() : null,
        cellAddr: addr,
      };
    });
  });

  const extractZones = (side: 'LHS' | 'RHS', startR: number, endR: number): WorkZoneAnnotation[] => {
    const zones: WorkZoneAnnotation[] = [];
    let cur: WorkZoneAnnotation | null = null;

    for (let idx = 0; idx < intervals.length; idx++) {
      const inter = intervals[idx];
      let colStatus: CellStatus = 'eligible_scope';
      let label = '';

      for (let r = startR; r <= endR; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: inter.col });
        const cell = ws[addr];
        const status = getCellStatus(cell);
        if (status !== 'eligible_scope') {
          colStatus = status;
          if (cell && cell.v && !label) label = String(cell.v).trim();
        }
      }

      const isSpecial = colStatus === 'dps' || colStatus === 'under_construction' || colStatus === 'himalayan';

      if (isSpecial) {
        if (cur && cur.status === colStatus && idx === cur.endIndex + 1) {
          cur.endIndex = idx;
          cur.toM = inter.toM;
          cur.toChainage = inter.toChainage;
          cur.totalLengthM += (side === 'LHS' ? inter.lengthM : (inter.lengthRHS || inter.lengthM));
          cur.intervalCount += 1;
          cur.endCol = inter.colLetter;
          if (label && !cur.label) cur.label = label;
        } else {
          if (cur) zones.push(cur);
          let defaultLabel = 'Special Work Zone';
          if (colStatus === 'dps') defaultLabel = 'Work Done by DPS';
          else if (colStatus === 'under_construction') defaultLabel = 'Under Construction';
          else if (colStatus === 'himalayan') defaultLabel = 'Himalayan';

          cur = {
            id: `${side.toLowerCase()}-${colStatus}-${idx}`,
            side,
            status: colStatus,
            type: colStatus.toUpperCase() as WorkZoneType,
            label: label || defaultLabel,
            startIndex: idx,
            endIndex: idx,
            fromM: inter.fromM,
            toM: inter.toM,
            fromChainage: inter.fromChainage,
            toChainage: inter.toChainage,
            totalLengthM: (side === 'LHS' ? inter.lengthM : (inter.lengthRHS || inter.lengthM)),
            intervalCount: 1,
            startCol: inter.colLetter,
            endCol: inter.colLetter,
          };
        }
      } else {
        if (cur) {
          zones.push(cur);
          cur = null;
        }
      }
    }
    if (cur) zones.push(cur);
    return zones;
  };

  const lhsWorkZones = extractZones('LHS', 2, 7);
  const rhsWorkZones = extractZones('RHS', 12, 17);

  // Parse Chainage Log from finalWb if available
  const completedLogs: CompletedWorkSubInterval[] = [];
  const conflicts: DataConflictRecord[] = [];
  const unmatchedSet = new Set<string>();
  const dateSet = new Set<string>();

  if (finalWb) {
    const wsLog = finalWb.Sheets['Chainage Log(input)'] || finalWb.Sheets[finalWb.SheetNames.find(n => n.includes('Chainage Log')) || ''];
    if (wsLog && wsLog['!ref']) {
      const logRange = XLSX.utils.decode_range(wsLog['!ref']);
      for (let r = 4; r <= logRange.e.r; r++) {
        const dateCell = wsLog[XLSX.utils.encode_cell({ r, c: 0 })];
        const fromCell = wsLog[XLSX.utils.encode_cell({ r, c: 1 })];
        const toCell = wsLog[XLSX.utils.encode_cell({ r, c: 2 })];
        const sideCell = wsLog[XLSX.utils.encode_cell({ r, c: 3 })];
        const laneCell = wsLog[XLSX.utils.encode_cell({ r, c: 4 })];
        const actCell = wsLog[XLSX.utils.encode_cell({ r, c: 5 })];
        const unitCell = wsLog[XLSX.utils.encode_cell({ r, c: 7 })];
        const lenCell = wsLog[XLSX.utils.encode_cell({ r, c: 11 })];
        const achCell = wsLog[XLSX.utils.encode_cell({ r, c: 14 })];

        if (!fromCell && !toCell && !actCell && !dateCell) continue;
        if (!fromCell && !toCell) continue;

        const rawFrom = parseChainage(fromCell?.v);
        const rawTo = parseChainage(toCell?.v);
        if (!isFinite(rawFrom) || !isFinite(rawTo) || (rawFrom === 0 && rawTo === 0)) continue;

        const fromM = Math.min(rawFrom, rawTo);
        const toM = Math.max(rawFrom, rawTo);
        if (toM <= fromM) continue;

        const lenM = Number(lenCell && Number(lenCell.v) > 0 ? lenCell.v : toM - fromM);
        const rawAct = actCell ? String(actCell.v).trim() : '';
        const mappedAct = mapToStripActivity(rawAct);

        if (!mappedAct) {
          unmatchedSet.add(rawAct);
        }

        const rawSide = sideCell ? String(sideCell.v).trim().toUpperCase() : 'LHS';
        const side: 'LHS' | 'RHS' | 'BHS' = rawSide === 'RHS' ? 'RHS' : rawSide === 'BHS' ? 'BHS' : 'LHS';
        const lane = laneCell ? String(laneCell.v).trim() : 'F/L';
        const dateStr = excelDateToStr(dateCell ? dateCell.v : null);
        if (dateStr) dateSet.add(dateStr);

        // Check conflicts against exclusions
        const sideExclusions = side === 'LHS' ? lhsWorkZones : (side === 'RHS' ? rhsWorkZones : [...lhsWorkZones, ...rhsWorkZones]);
        let hasConflict = false;
        let conflictType: 'dps' | 'under_construction' | 'himalayan' | undefined = undefined;
        let conflictReason: string | undefined = undefined;
        let overlapM = 0;

        for (const ex of sideExclusions) {
          const ovStart = Math.max(fromM, ex.fromM);
          const ovEnd = Math.min(toM, ex.toM);
          if (ovStart < ovEnd) {
            hasConflict = true;
            conflictType = ex.status as 'dps' | 'under_construction' | 'himalayan';
            overlapM = ovEnd - ovStart;
            conflictReason = `Overlaps ${ex.side} ${ex.label} (${formatChainage(ex.fromM)} to ${formatChainage(ex.toM)}) by ${overlapM}m`;
            conflicts.push({
              excelRow: r + 1,
              date: dateStr,
              side,
              activity: rawAct,
              workRange: `${formatChainage(fromM)} to ${formatChainage(toM)}`,
              exclusionType: conflictType,
              exclusionSide: ex.side,
              exclusionRange: `${formatChainage(ex.fromM)} to ${formatChainage(ex.toM)}`,
              overlapM,
            });
            break;
          }
        }

        completedLogs.push({
          id: `log-${r + 1}`,
          logRowIndex: r + 1,
          date: dateStr,
          fromM,
          toM,
          lengthM: lenM,
          activity: rawAct,
          mappedActivityId: mappedAct || 'unmatched',
          side,
          lane,
          achievedQty: achCell ? Number(achCell.v) : 0,
          unit: unitCell ? String(unitCell.v).trim() : '',
          hasConflict,
          conflictType,
          conflictReason,
          overlapM,
        });
      }
    }
  }

  // Sort available dates chronologically
  const availableDates = Array.from(dateSet).sort((a, b) => {
    const parseD = (s: string) => {
      const parts = s.split('-');
      if (parts.length === 3) {
        const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(parts[1]);
        return new Date(Number(parts[2]), mon, Number(parts[0])).getTime();
      }
      return 0;
    };
    return parseD(a) - parseD(b);
  });

  const dataset: StripChartDataset = {
    metadata: {
      title,
      chainageSpanText: span,
      startChainage: intervals[0]?.fromChainage || '130+560',
      endChainage: intervals[intervals.length - 1]?.toChainage || '206+200',
      startM: intervals[0]?.fromM || 130560,
      endM: intervals[intervals.length - 1]?.toM || 206200,
      totalLengthM: intervals.reduce((s, i) => s + i.lengthM, 0),
      totalIntervals: intervals.length,
    },
    lhsActivities: lhsActivityDefs,
    rhsActivities: rhsActivityDefs,
    intervals,
    lhsCells,
    rhsCells,
    lhsWorkZones,
    rhsWorkZones,
    completedLogs,
    availableDates,
    unmatchedActivities: Array.from(unmatchedSet),
    conflicts,
  };

  cachedDataset = dataset;
  return dataset;
}

export async function fetchOrLoadStripChartDataset(): Promise<StripChartDataset> {
  if (cachedDataset && cachedDataset.completedLogs && cachedDataset.completedLogs.length > 0) {
    return cachedDataset;
  }

  let stripWb: XLSX.WorkBook | null = null;
  let finalWb: XLSX.WorkBook | null = null;

  try {
    // 1. Fetch Source A: Strip Chart Format workbook
    const stripUrls = [
      '/data/MH Project Strip Chart KM wise - Format.xlsx',
      '/data/MH Project Strip chart KM wise  - Format.xlsx',
    ];

    for (const url of stripUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          stripWb = XLSX.read(buffer, { cellStyles: true });
          break;
        }
      } catch {
        // Continue
      }
    }

    // 2. Fetch Source B: final_sheet.xlsx
    const finalUrls = [
      '/data/Final_sheet_10-11-2026.xlsx',
      '/data/final_sheet.xlsx',
      '/data/Final_sheet.xlsx',
    ];

    for (const url of finalUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          finalWb = XLSX.read(buffer, { cellStyles: true });
          break;
        }
      } catch {
        // Continue
      }
    }

    if (stripWb) {
      const dataset = parseStripChartWorkbook(stripWb, finalWb || undefined);
      return dataset;
    }
  } catch (err) {
    console.warn('Failed to fetch Excel workbooks, using authoritative static fallback:', err);
  }

  // Authoritative fallback generated directly from reference workbooks
  cachedDataset = defaultStripData as unknown as StripChartDataset;
  return cachedDataset;
}

export function computeSubFills(
  interval: ChainageInterval,
  side: 'LHS' | 'RHS',
  activityId: string,
  logs: CompletedWorkSubInterval[],
  exclusions: WorkZoneAnnotation[],
  selectedDate: string | null
): SubIntervalFill[] {
  const intSpan = interval.toM - interval.fromM || 1;

  // Priority 1-3: Fixed exclusion check
  const ex = exclusions.find(e => interval.fromM >= e.fromM && interval.toM <= e.toM);
  const isExclusion = !!ex;

  if (isExclusion) {
    return [{
      startPct: 0,
      widthPct: 100,
      fromM: interval.fromM,
      toM: interval.toM,
      lengthM: interval.lengthM,
      isCompleted: false,
      isExclusion: true,
      exclusionType: ex.status as 'dps' | 'under_construction' | 'himalayan',
      logRecords: [],
    }];
  }

  // Priority 4: Completed work from logs
  const activeLogs = logs.filter(l => {
    if (l.mappedActivityId !== activityId) return false;
    if (l.side !== 'BHS' && l.side !== side) return false;
    if (selectedDate && selectedDate !== 'all' && l.date !== selectedDate) return false;
    return Math.max(l.fromM, interval.fromM) < Math.min(l.toM, interval.toM);
  });

  if (activeLogs.length === 0) {
    return [{
      startPct: 0,
      widthPct: 100,
      fromM: interval.fromM,
      toM: interval.toM,
      lengthM: interval.lengthM,
      isCompleted: false,
      isExclusion: false,
      logRecords: [],
    }];
  }

  // Union matching completed sub-intervals within [interval.fromM, interval.toM]
  const clamped = activeLogs
    .map(l => ({
      fromM: Math.max(l.fromM, interval.fromM),
      toM: Math.min(l.toM, interval.toM),
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

  // Build contiguous proportional slices
  const fills: SubIntervalFill[] = [];
  let curM = interval.fromM;

  merged.forEach(m => {
    if (m.fromM > curM) {
      const wPct = ((m.fromM - curM) / intSpan) * 100;
      const sPct = ((curM - interval.fromM) / intSpan) * 100;
      fills.push({
        startPct: sPct,
        widthPct: wPct,
        fromM: curM,
        toM: m.fromM,
        lengthM: m.fromM - curM,
        isCompleted: false,
        isExclusion: false,
        logRecords: [],
      });
    }

    const wPct = ((m.toM - m.fromM) / intSpan) * 100;
    const sPct = ((m.fromM - interval.fromM) / intSpan) * 100;
    fills.push({
      startPct: sPct,
      widthPct: wPct,
      fromM: m.fromM,
      toM: m.toM,
      lengthM: m.toM - m.fromM,
      isCompleted: true,
      isExclusion: false,
      logRecords: m.logs,
    });
    curM = m.toM;
  });

  if (curM < interval.toM) {
    const wPct = ((interval.toM - curM) / intSpan) * 100;
    const sPct = ((curM - interval.fromM) / intSpan) * 100;
    fills.push({
      startPct: sPct,
      widthPct: wPct,
      fromM: curM,
      toM: interval.toM,
      lengthM: interval.toM - curM,
      isCompleted: false,
      isExclusion: false,
      logRecords: [],
    });
  }

  return fills;
}
