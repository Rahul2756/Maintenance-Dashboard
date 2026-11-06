import * as XLSX from 'xlsx';
import {
  StripChartDataset,
  ChainageInterval,
  ActivityDefinition,
  StripCell,
  WorkZoneAnnotation,
  CellStatus,
  WorkZoneType,
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
  if (!cell || !cell.s || !cell.s.fgColor) return 'planned';
  const fg = cell.s.fgColor;
  if (fg.rgb === '92D050') return 'completed';
  if (fg.theme === 0 && fg.tint !== undefined) return 'dps';
  if (fg.rgb === '948A54') return 'under_construction';
  if (fg.rgb === 'FCD5B5') return 'himalayan';
  return 'planned';
}

export function parseStripChartWorkbook(wb: XLSX.WorkBook): StripChartDataset {
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

  const extractZones = (side: 'LHS' | 'RHS', topRow: number): WorkZoneAnnotation[] => {
    const zones: WorkZoneAnnotation[] = [];
    let cur: WorkZoneAnnotation | null = null;

    for (let idx = 0; idx < intervals.length; idx++) {
      const inter = intervals[idx];
      const addr = XLSX.utils.encode_cell({ r: topRow, c: inter.col });
      const cell = ws[addr];
      const status = getCellStatus(cell);
      const text = cell && cell.v ? String(cell.v).trim() : null;

      const isSpecial = status === 'dps' || status === 'under_construction' || status === 'himalayan';

      if (isSpecial) {
        if (cur && cur.status === status && idx === cur.endIndex + 1) {
          cur.endIndex = idx;
          cur.toM = inter.toM;
          cur.toChainage = inter.toChainage;
          cur.totalLengthM += inter.lengthM;
          cur.intervalCount += 1;
          cur.endCol = inter.colLetter;
          if (text && !cur.label) cur.label = text;
        } else {
          if (cur) zones.push(cur);
          let defaultLabel = 'Special Work Zone';
          if (status === 'dps') defaultLabel = 'Work Done by DPS';
          else if (status === 'under_construction') defaultLabel = 'Under Construction';
          else if (status === 'himalayan') defaultLabel = 'Himalayan';

          cur = {
            id: `${side.toLowerCase()}-${status}-${idx}`,
            side,
            status,
            type: status.toUpperCase() as WorkZoneType,
            label: text || defaultLabel,
            startIndex: idx,
            endIndex: idx,
            fromM: inter.fromM,
            toM: inter.toM,
            fromChainage: inter.fromChainage,
            toChainage: inter.toChainage,
            totalLengthM: inter.lengthM,
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

  const lhsWorkZones = extractZones('LHS', 2);
  const rhsWorkZones = extractZones('RHS', 12);

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
  };

  cachedDataset = dataset;
  return dataset;
}

export async function fetchOrLoadStripChartDataset(): Promise<StripChartDataset> {
  if (cachedDataset) {
    return cachedDataset;
  }

  try {
    const urlsToTry = [
      '/data/MH Project Strip Chart KM wise - Format.xlsx',
      '/data/MH Project Strip chart KM wise  - Format.xlsx',
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          const wb = XLSX.read(buffer, { cellStyles: true });
          const dataset = parseStripChartWorkbook(wb);
          return dataset;
        }
      } catch {
        // Continue to fallback
      }
    }
  } catch (err) {
    console.warn('Failed to fetch Excel workbook, using authoritative static fallback:', err);
  }

  // Authoritative fallback generated directly from the reference workbook
  cachedDataset = defaultStripData as unknown as StripChartDataset;
  return cachedDataset;
}

