import { get, set, del } from 'idb-keyval';
import {
  ActualDPRRow,
  PlannedRecord,
  DPRMetadata,
  QCTestLogItem,
  ProjectBaseline,
  ScheduleMilestones,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities
} from '../types/dpr';

export interface StoredPlannedData {
  plannedRecords: PlannedRecord[];
  baseline: ProjectBaseline;
  sectionScopes: SectionQuantityScope[];
  consolidatedScope: ConsolidatedQuantityScope;
  filename?: string;
  updatedAt: string;
}

export interface StoredActualData {
  actualRows: ActualDPRRow[];
  metadata: DPRMetadata;
  qcLogs: QCTestLogItem[];
  milestones: ScheduleMilestones;
  cumulativeAchieved: CumulativeAchievedQuantities;
  filename?: string;
  updatedAt: string;
}

export interface UploadMetadata {
  plannedFileName?: string;
  plannedTimestamp?: string;
  plannedRowCount?: number;
  actualFileName?: string;
  actualTimestamp?: string;
  actualRowCount?: number;
  reportDate?: string;
}

export interface StoredDashboardPayload {
  planned?: StoredPlannedData;
  actual?: StoredActualData;
  meta?: UploadMetadata;
}

export const KEY_PLANNED_DATA = 'nh334_planned_baseline';
export const KEY_ACTUAL_DATA = 'nh334_actual_dpr';
export const KEY_UPLOAD_METADATA = 'nh334_files_meta';

// Backward compatibility keys (checked if new keys are not present)
const LEGACY_KEY_PLANNED = 'nh334_dashboard_planned_v1';
const LEGACY_KEY_ACTUAL = 'nh334_dashboard_actual_v1';

/**
 * Saves planned baseline work program into IndexedDB with independent key
 */
export async function savePlannedData(
  parsedPlannedJSON: Partial<StoredPlannedData>,
  fileName: string
): Promise<void> {
  try {
    const existing = (await get<StoredPlannedData>(KEY_PLANNED_DATA)) || ({} as StoredPlannedData);
    const updatedPlanned: StoredPlannedData = {
      ...existing,
      ...parsedPlannedJSON,
      filename: fileName,
      updatedAt: new Date().toISOString()
    } as StoredPlannedData;

    await set(KEY_PLANNED_DATA, updatedPlanned);

    // Update upload metadata
    const existingMeta = (await get<UploadMetadata>(KEY_UPLOAD_METADATA)) || {};
    const updatedMeta: UploadMetadata = {
      ...existingMeta,
      plannedFileName: fileName,
      plannedTimestamp: new Date().toISOString(),
      plannedRowCount: updatedPlanned.plannedRecords?.length || 0
    };
    await set(KEY_UPLOAD_METADATA, updatedMeta);
  } catch (err) {
    console.error('Error saving planned data to IndexedDB:', err);
    throw err;
  }
}

/**
 * Saves actual DPR execution data into IndexedDB with independent key
 */
export async function saveActualData(
  parsedActualJSON: Partial<StoredActualData>,
  fileName: string
): Promise<void> {
  try {
    const existing = (await get<StoredActualData>(KEY_ACTUAL_DATA)) || ({} as StoredActualData);
    const updatedActual: StoredActualData = {
      ...existing,
      ...parsedActualJSON,
      filename: fileName,
      updatedAt: new Date().toISOString()
    } as StoredActualData;

    await set(KEY_ACTUAL_DATA, updatedActual);

    // Update upload metadata
    const existingMeta = (await get<UploadMetadata>(KEY_UPLOAD_METADATA)) || {};
    const updatedMeta: UploadMetadata = {
      ...existingMeta,
      actualFileName: fileName,
      actualTimestamp: new Date().toISOString(),
      actualRowCount: updatedActual.actualRows?.length || 0,
      reportDate: updatedActual.metadata?.reportDate
    };
    await set(KEY_UPLOAD_METADATA, updatedMeta);
  } catch (err) {
    console.error('Error saving actual data to IndexedDB:', err);
    throw err;
  }
}

/**
 * Loads all stored data and upload metadata from IndexedDB
 */
export async function loadAllStoredData(): Promise<{
  plannedData: StoredPlannedData | null;
  actualData: StoredActualData | null;
  meta: UploadMetadata | null;
}> {
  try {
    let [planned, actual, meta] = await Promise.all([
      get<StoredPlannedData>(KEY_PLANNED_DATA),
      get<StoredActualData>(KEY_ACTUAL_DATA),
      get<UploadMetadata>(KEY_UPLOAD_METADATA)
    ]);

    // Check legacy keys for migration if needed
    if (!planned) {
      planned = await get<StoredPlannedData>(LEGACY_KEY_PLANNED);
    }
    if (!actual) {
      actual = await get<StoredActualData>(LEGACY_KEY_ACTUAL);
    }

    // STRICT PERMANENT SOURCE LOCK:
    // Only accept Revised Work program-R-1_05-11-2026.xlsx.
    // Discard any older cached planned data (e.g. Work Program.xlsx) so live WP-R1 is loaded.
    if (planned && planned.filename && !planned.filename.includes('Revised Work program-R-1_05-11-2026')) {
      console.warn('Discarding legacy planned cache from older workbook:', planned.filename);
      planned = undefined;
    }

    return {
      plannedData: planned || null,
      actualData: actual || null,
      meta: meta || null
    };
  } catch (err) {
    console.error('Error loading stored data from IndexedDB:', err);
    return {
      plannedData: null,
      actualData: null,
      meta: null
    };
  }
}

/**
 * Legacy wrapper function for saveDashboardState
 */
export async function saveDashboardState(
  plannedData?: Partial<StoredPlannedData> | null,
  actualData?: Partial<StoredActualData> | null
): Promise<void> {
  if (plannedData) {
    await savePlannedData(plannedData, plannedData.filename || 'Revised Work program-R-1_05-11-2026.xlsx');
  }
  if (actualData) {
    await saveActualData(actualData, actualData.filename || 'Major_Maintenance_Daily_Progress_Report.xlsx');
  }
}

/**
 * Legacy wrapper function for loadDashboardState
 */
export async function loadDashboardState(): Promise<StoredDashboardPayload | null> {
  const result = await loadAllStoredData();
  if (!result.plannedData && !result.actualData) {
    return null;
  }
  return {
    planned: result.plannedData || undefined,
    actual: result.actualData || undefined,
    meta: result.meta || undefined
  };
}

/**
 * Clears all cached dashboard data from IndexedDB
 */
export async function clearDashboardState(): Promise<void> {
  try {
    await Promise.all([
      del(KEY_PLANNED_DATA),
      del(KEY_ACTUAL_DATA),
      del(KEY_UPLOAD_METADATA),
      del(LEGACY_KEY_PLANNED),
      del(LEGACY_KEY_ACTUAL)
    ]);
  } catch (err) {
    console.error('Error clearing dashboard state in IndexedDB:', err);
    throw err;
  }
}
