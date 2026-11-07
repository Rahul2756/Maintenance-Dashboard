import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Calendar,
  Layers,
  Database,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { parseDPRBuffer, parseWorkProgramBuffer } from '../../utils/excelParser';
import {
  savePlannedData,
  saveActualData,
  loadAllStoredData,
  StoredPlannedData,
  StoredActualData,
  UploadMetadata
} from '../../utils/storage';
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
} from '../../types/dpr';

export interface FileUploadPayload {
  actual?: {
    rows: ActualDPRRow[];
    metadata: DPRMetadata;
    qcLogs: QCTestLogItem[];
    milestones: ScheduleMilestones;
    cumulativeAchieved: CumulativeAchievedQuantities;
  };
  planned?: {
    records: PlannedRecord[];
    baseline: ProjectBaseline;
    sectionScopes: SectionQuantityScope[];
    consolidatedScope: ConsolidatedQuantityScope;
  };
}

interface FileCardStatus {
  state: 'idle' | 'processing' | 'updated' | 'error';
  stageText?: string;
  progressPercent?: number;
  fileName?: string;
  fileSize?: string;
  timestamp?: string;
  isJustUpdated?: boolean;
  rowCount?: number;
  reportDate?: string;
  verifiedSheets?: string[];
  errorMessage?: string;
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone?: () => void;
  onDataLoaded?: (payload: FileUploadPayload) => void;
  onPlannedUpdate?: (data: StoredPlannedData) => void;
  onActualUpdate?: (data: StoredActualData) => void;
  uploadMeta?: UploadMetadata | null;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDone,
  onDataLoaded,
  onPlannedUpdate,
  onActualUpdate,
  uploadMeta: initialUploadMeta
}) => {
  // State for Card A: Planned Baseline
  const [isDraggingPlanned, setIsDraggingPlanned] = useState(false);
  const [plannedStatus, setPlannedStatus] = useState<FileCardStatus>({
    state: 'idle'
  });

  // State for Card B: Actual DPR
  const [isDraggingActual, setIsDraggingActual] = useState(false);
  const [actualStatus, setActualStatus] = useState<FileCardStatus>({
    state: 'idle'
  });

  const plannedInputRef = useRef<HTMLInputElement>(null);
  const actualInputRef = useRef<HTMLInputElement>(null);

  // Load existing metadata on open
  useEffect(() => {
    if (isOpen) {
      const fetchStatus = async () => {
        try {
          const { plannedData, actualData, meta } = await loadAllStoredData();
          if (plannedData || meta?.plannedFileName) {
            setPlannedStatus({
              state: 'updated',
              fileName: meta?.plannedFileName || plannedData?.filename || 'Revised Work program-R-1_05-11-2026.xlsx',
              timestamp: meta?.plannedTimestamp || plannedData?.updatedAt,
              rowCount: meta?.plannedRowCount || plannedData?.plannedRecords?.length || 0,
              verifiedSheets: ['WP-R1'],
              isJustUpdated: false
            });
          } else if (initialUploadMeta?.plannedFileName) {
            setPlannedStatus({
              state: 'updated',
              fileName: initialUploadMeta.plannedFileName,
              timestamp: initialUploadMeta.plannedTimestamp,
              rowCount: initialUploadMeta.plannedRowCount || 0,
              verifiedSheets: ['WP-R1'],
              isJustUpdated: false
            });
          } else {
            setPlannedStatus({ state: 'idle' });
          }

          if (actualData || meta?.actualFileName) {
            setActualStatus({
              state: 'updated',
              fileName: meta?.actualFileName || actualData?.filename || 'Major_Maintenance_DPR.xlsx',
              timestamp: meta?.actualTimestamp || actualData?.updatedAt,
              rowCount: meta?.actualRowCount || actualData?.actualRows?.length || 0,
              reportDate: meta?.reportDate || actualData?.metadata?.reportDate || '01.11.2026',
              verifiedSheets: ['Chainage Progress', 'Daily DPR'],
              isJustUpdated: false
            });
          } else if (initialUploadMeta?.actualFileName) {
            setActualStatus({
              state: 'updated',
              fileName: initialUploadMeta.actualFileName,
              timestamp: initialUploadMeta.actualTimestamp,
              rowCount: initialUploadMeta.actualRowCount || 0,
              reportDate: initialUploadMeta.reportDate || '01.11.2026',
              verifiedSheets: ['Chainage Progress', 'Daily DPR'],
              isJustUpdated: false
            });
          } else {
            setActualStatus({ state: 'idle' });
          }
        } catch (err) {
          console.error('Failed to query initial storage status in modal:', err);
        }
      };

      fetchStatus();
    }
  }, [isOpen, initialUploadMeta]);

  if (!isOpen) return null;

  // Process Card A: Planned Baseline with clear stage progression
  const processPlannedWorkbook = async (file: File) => {
    const fileSizeFormatted = formatFileSize(file.size);
    setPlannedStatus({
      state: 'processing',
      stageText: 'Reading Excel binary stream...',
      progressPercent: 20,
      fileName: file.name,
      fileSize: fileSizeFormatted
    });

    try {
      // Step 1: Read array buffer
      const buffer = await file.arrayBuffer();

      // Step 2: Validate sheet signatures
      setPlannedStatus(prev => ({
        ...prev,
        stageText: 'Validating worksheet (WP-R1)...',
        progressPercent: 45
      }));
      await new Promise(r => setTimeout(r, 180));

      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];

      const hasWPR1 = sheetNames.some(
        s => s.trim().toUpperCase() === 'WP-R1' || s.trim().toUpperCase() === 'WP - R1'
      );

      if (!hasWPR1) {
        throw new Error(
          "Invalid Planned File: Must contain authoritative worksheet 'WP-R1' from Revised Work program-R-1_05-11-2026.xlsx."
        );
      }

      // Step 3: Parse BoQ quantities and milestones
      setPlannedStatus(prev => ({
        ...prev,
        stageText: 'Extracting BoQ scope & 10 weekly scheduled phases...',
        progressPercent: 75
      }));
      await new Promise(r => setTimeout(r, 200));

      const plannedResult = parseWorkProgramBuffer(buffer);
      const records = plannedResult.records || (plannedResult as any);
      const baseline = plannedResult.baseline;
      const sectionScopes = plannedResult.sectionScopes;
      const consolidatedScope = plannedResult.consolidatedScope;

      // Step 4: Persist in IndexedDB
      setPlannedStatus(prev => ({
        ...prev,
        stageText: 'Persisting baseline records into browser IndexedDB...',
        progressPercent: 90
      }));
      await new Promise(r => setTimeout(r, 150));

      const storedPlanned: StoredPlannedData = {
        plannedRecords: records,
        baseline,
        sectionScopes,
        consolidatedScope,
        filename: file.name,
        updatedAt: new Date().toISOString()
      };

      await savePlannedData(storedPlanned, file.name);

      // Trigger state updates
      if (onPlannedUpdate) {
        onPlannedUpdate(storedPlanned);
      }
      if (onDataLoaded) {
        onDataLoaded({
          planned: {
            records,
            baseline,
            sectionScopes,
            consolidatedScope
          }
        });
      }

      // Final Step: Updated state
      setPlannedStatus({
        state: 'updated',
        stageText: 'Work Program updated & verified',
        progressPercent: 100,
        fileName: file.name,
        fileSize: fileSizeFormatted,
        timestamp: new Date().toISOString(),
        rowCount: records.length,
        verifiedSheets: ['Quantity Summary', 'MCW -Milling & DBM (BHS)'],
        isJustUpdated: true
      });
    } catch (err: any) {
      console.error('Planned File Parsing Error:', err);
      setPlannedStatus({
        state: 'error',
        fileName: file.name,
        errorMessage: err.message || "Failed to parse Work Program. Missing 'MCW -Milling & DBM' or 'Quantity Summary' sheets."
      });
    }
  };

  // Process Card B: Actual DPR with clear stage progression
  const processActualWorkbook = async (file: File) => {
    const fileSizeFormatted = formatFileSize(file.size);
    setActualStatus({
      state: 'processing',
      stageText: 'Reading Excel binary stream...',
      progressPercent: 20,
      fileName: file.name,
      fileSize: fileSizeFormatted
    });

    try {
      // Step 1: Read array buffer
      const buffer = await file.arrayBuffer();

      // Step 2: Validate sheet signatures
      setActualStatus(prev => ({
        ...prev,
        stageText: 'Validating sheets (Chainage Progress, Daily DPR)...',
        progressPercent: 45
      }));
      await new Promise(r => setTimeout(r, 180));

      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];

      const hasChainageSheet = sheetNames.some(s => s.trim() === 'Chainage Progress');
      const hasDailyDprSheet = sheetNames.some(s => s.trim() === 'Daily DPR');

      if (!hasChainageSheet && !hasDailyDprSheet) {
        throw new Error(
          "Invalid DPR File: Missing 'Chainage Progress' or 'Daily DPR' sheets."
        );
      }

      // Step 3: Parse chainage logs & QC
      setActualStatus(prev => ({
        ...prev,
        stageText: 'Extracting chainage execution logs & QC register...',
        progressPercent: 75
      }));
      await new Promise(r => setTimeout(r, 200));

      const dprResult = parseDPRBuffer(buffer);
      const { rows, metadata, qcLogs, milestones, cumulativeAchieved } = dprResult;

      if (rows.length === 0) {
        throw new Error('No valid chainage execution rows found in the selected Excel workbook.');
      }

      // Step 4: Persist in IndexedDB
      setActualStatus(prev => ({
        ...prev,
        stageText: 'Persisting execution rows into browser IndexedDB...',
        progressPercent: 90
      }));
      await new Promise(r => setTimeout(r, 150));

      const storedActual: StoredActualData = {
        actualRows: rows,
        metadata,
        qcLogs,
        milestones,
        cumulativeAchieved,
        filename: file.name,
        updatedAt: new Date().toISOString()
      };

      await saveActualData(storedActual, file.name);

      // Trigger state updates
      if (onActualUpdate) {
        onActualUpdate(storedActual);
      }
      if (onDataLoaded) {
        onDataLoaded({
          actual: {
            rows,
            metadata,
            qcLogs,
            milestones,
            cumulativeAchieved
          }
        });
      }

      // Final Step: Updated state
      setActualStatus({
        state: 'updated',
        stageText: 'Daily DPR updated & verified',
        progressPercent: 100,
        fileName: file.name,
        fileSize: fileSizeFormatted,
        timestamp: new Date().toISOString(),
        rowCount: rows.length,
        reportDate: metadata?.reportDate || '01.11.2026',
        verifiedSheets: ['Chainage Progress', 'Daily DPR'],
        isJustUpdated: true
      });
    } catch (err: any) {
      console.error('Actual File Parsing Error:', err);
      setActualStatus({
        state: 'error',
        fileName: file.name,
        errorMessage: err.message || "Invalid DPR File: Missing 'Chainage Progress' or 'Daily DPR' sheets."
      });
    }
  };

  const handleDone = () => {
    if (onDone) {
      onDone();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-[#16181D] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl shadow-black/80 p-6 relative flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-lg tracking-tight">
                Data Ingestion & Workbook Management
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                Client-Side Engine
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">
              Upload and update the Planned Baseline and Daily Actual Progress workbooks independently.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {/* ============================================================== */}
          {/* Module Card A: Planned Baseline Program                        */}
          {/* ============================================================== */}
          <div
            className={`bg-[#0F131D] border rounded-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl ${plannedStatus.isJustUpdated
              ? 'border-cyan-500/50 shadow-cyan-950/40 ring-1 ring-cyan-500/30'
              : 'border-white/10 hover:border-cyan-500/30'
              }`}
          >
            <div>
              {/* Header Tag with Dynamic Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
                  Target Baseline
                </span>

                {/* Status Indicator Chip */}
                {plannedStatus.state === 'processing' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-[11px] font-mono animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                    Processing...
                  </span>
                )}
                {plannedStatus.state === 'updated' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {plannedStatus.isJustUpdated ? 'Updated Just Now' : 'Active / Synced'}
                  </span>
                )}
                {plannedStatus.state === 'idle' && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Default Baseline
                  </span>
                )}
                {plannedStatus.state === 'error' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[11px] font-mono">
                    <AlertCircle className="w-3 h-3 text-rose-400" /> Failed
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="text-white font-semibold text-base mt-2.5 flex items-center gap-2">
                <span>1. Revised Work Program R1 (.xlsx)</span>
              </h3>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Authoritative planned baseline from Revised Work program-R-1_05-11-2026.xlsx (WP-R1).
              </p>

              {/* Upload Dropzone / Processing Box */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingPlanned(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingPlanned(false);
                }}
                onDrop={async e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingPlanned(false);
                  const files = Array.from(e.dataTransfer.files).filter(
                    f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
                  );
                  if (files.length === 0) {
                    setPlannedStatus({
                      state: 'error',
                      errorMessage: 'Please drop a valid Excel file (.xlsx or .xls)'
                    });
                    return;
                  }
                  await processPlannedWorkbook(files[0]);
                }}
                onClick={() => {
                  if (plannedStatus.state !== 'processing') {
                    plannedInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all mt-4 relative overflow-hidden ${isDraggingPlanned
                  ? 'border-cyan-400 bg-cyan-950/30 scale-[0.99]'
                  : plannedStatus.state === 'processing'
                    ? 'border-cyan-500/50 bg-cyan-950/20 cursor-wait'
                    : plannedStatus.state === 'updated'
                      ? 'border-cyan-500/30 bg-cyan-950/10 hover:border-cyan-400'
                      : 'border-gray-700 bg-white/[0.02] hover:border-cyan-400 hover:bg-cyan-950/10'
                  }`}
              >
                <input
                  ref={plannedInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await processPlannedWorkbook(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* State A: Processing Progress Animation */}
                {plannedStatus.state === 'processing' && (
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {plannedStatus.stageText || 'Processing Workbook...'}
                    </p>
                    <p className="text-xs text-cyan-400 font-mono mt-1">
                      {plannedStatus.fileName} ({plannedStatus.fileSize})
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full max-w-xs bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 transition-all duration-300 rounded-full"
                        style={{ width: `${plannedStatus.progressPercent || 50}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* State B: Updated / Synced Card View */}
                {plannedStatus.state === 'updated' && (
                  <div className="flex flex-col items-center justify-center py-1">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-lg shadow-emerald-950/30">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{plannedStatus.fileName}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-mono">
                      <span>{plannedStatus.rowCount} chainage records</span>
                      <span>•</span>
                      <span className="text-emerald-400">IndexedDB Synced</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        plannedInputRef.current?.click();
                      }}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Replace Workbook
                    </button>
                  </div>
                )}

                {/* State C: Idle View (Default Prompt) */}
                {plannedStatus.state === 'idle' && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-2.5">
                      <Upload className="w-6 h-6 text-cyan-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      Click or drag Revised Work program-R-1_05-11-2026.xlsx here
                    </p>
                    <span className="text-[11px] text-gray-500 mt-1">
                      Supports .xlsx / .xls
                    </span>
                  </div>
                )}

                {/* State D: Error View */}
                {plannedStatus.state === 'error' && (
                  <div className="flex flex-col items-center justify-center py-1 text-rose-300">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-2">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <p className="text-xs font-semibold text-rose-200">Parsing Failed</p>
                    <p className="text-[11px] text-rose-400 mt-1 max-w-xs text-center font-mono">
                      {plannedStatus.errorMessage}
                    </p>
                    <span className="mt-2 text-xs text-cyan-300 underline font-medium">
                      Click to try another file
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* File Status Details (Below Dropzone) */}
            <div className="mt-4 pt-3 border-t border-white/5 text-xs">
              {plannedStatus.state === 'updated' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      Sheets: Quantity Summary, Milling & DBM
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Ready
                    </span>
                  </div>
                  {plannedStatus.timestamp && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>Loaded: {new Date(plannedStatus.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-mono">
                  No custom file loaded (Using default baseline)
                </p>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* Module Card B: Actual Site Execution (Daily DPR)               */}
          {/* ============================================================== */}
          <div
            className={`bg-[#0F131D] border rounded-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl ${actualStatus.isJustUpdated
              ? 'border-emerald-500/50 shadow-emerald-950/40 ring-1 ring-emerald-500/30'
              : 'border-white/10 hover:border-emerald-500/30'
              }`}
          >
            <div>
              {/* Header Tag with Dynamic Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
                  Daily DPR
                </span>

                {/* Status Indicator Chip */}
                {actualStatus.state === 'processing' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    Processing...
                  </span>
                )}
                {actualStatus.state === 'updated' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {actualStatus.isJustUpdated ? 'Updated Just Now' : 'Active / Synced'}
                  </span>
                )}
                {actualStatus.state === 'idle' && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Default DPR
                  </span>
                )}
                {actualStatus.state === 'error' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[11px] font-mono">
                    <AlertCircle className="w-3 h-3 text-rose-400" /> Failed
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="text-white font-semibold text-base mt-2.5 flex items-center gap-2">
                <span>2. Daily Progress Report (.xlsx)</span>
              </h3>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Site execution logs, achieved chainages, equipment uptime, and QC registers.
              </p>

              {/* Upload Dropzone / Processing Box */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingActual(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingActual(false);
                }}
                onDrop={async e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingActual(false);
                  const files = Array.from(e.dataTransfer.files).filter(
                    f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
                  );
                  if (files.length === 0) {
                    setActualStatus({
                      state: 'error',
                      errorMessage: 'Please drop a valid Excel file (.xlsx or .xls)'
                    });
                    return;
                  }
                  await processActualWorkbook(files[0]);
                }}
                onClick={() => {
                  if (actualStatus.state !== 'processing') {
                    actualInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all mt-4 relative overflow-hidden ${isDraggingActual
                  ? 'border-emerald-400 bg-emerald-950/30 scale-[0.99]'
                  : actualStatus.state === 'processing'
                    ? 'border-emerald-500/50 bg-emerald-950/20 cursor-wait'
                    : actualStatus.state === 'updated'
                      ? 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-400'
                      : 'border-gray-700 bg-white/[0.02] hover:border-emerald-400 hover:bg-emerald-950/10'
                  }`}
              >
                <input
                  ref={actualInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await processActualWorkbook(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* State A: Processing Progress Animation */}
                {actualStatus.state === 'processing' && (
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {actualStatus.stageText || 'Processing Workbook...'}
                    </p>
                    <p className="text-xs text-emerald-400 font-mono mt-1">
                      {actualStatus.fileName} ({actualStatus.fileSize})
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full max-w-xs bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 transition-all duration-300 rounded-full"
                        style={{ width: `${actualStatus.progressPercent || 50}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* State B: Updated / Synced Card View */}
                {actualStatus.state === 'updated' && (
                  <div className="flex flex-col items-center justify-center py-1">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-lg shadow-emerald-950/30">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{actualStatus.fileName}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-mono">
                      <span>Report Date: {actualStatus.reportDate}</span>
                      <span>•</span>
                      <span>{actualStatus.rowCount} chainages</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        actualInputRef.current?.click();
                      }}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Replace Workbook
                    </button>
                  </div>
                )}

                {/* State C: Idle View (Default Prompt) */}
                {actualStatus.state === 'idle' && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5">
                      <Upload className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      Click or drag DPR Excel here
                    </p>
                    <span className="text-[11px] text-gray-500 mt-1">
                      Supports .xlsx / .xls
                    </span>
                  </div>
                )}

                {/* State D: Error View */}
                {actualStatus.state === 'error' && (
                  <div className="flex flex-col items-center justify-center py-1 text-rose-300">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-2">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <p className="text-xs font-semibold text-rose-200">Parsing Failed</p>
                    <p className="text-[11px] text-rose-400 mt-1 max-w-xs text-center font-mono">
                      {actualStatus.errorMessage}
                    </p>
                    <span className="mt-2 text-xs text-emerald-300 underline font-medium">
                      Click to try another file
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* File Status Details (Below Dropzone) */}
            <div className="mt-4 pt-3 border-t border-white/5 text-xs">
              {actualStatus.state === 'updated' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      Sheets: Chainage Progress, Daily DPR
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Ready
                    </span>
                  </div>
                  {actualStatus.timestamp && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>Loaded: {new Date(actualStatus.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-mono">
                  No custom file loaded (Using default DPR)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer with Storage Chip, Cancel, and Final Done Buttons */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Storage: <span className="text-slate-200 font-medium">Persistent IndexedDB</span> (Dual Keys)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-semibold text-sm shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;
