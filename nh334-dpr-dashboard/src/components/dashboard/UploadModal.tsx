import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseDPRBuffer, parseRevisedWorkProgramBuffer } from '../../utils/excelParser';
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

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: {
    actual?: ActualDPRRow[];
    planned?: PlannedRecord[];
    metadata?: DPRMetadata;
    qcLogs?: QCTestLogItem[];
    baseline?: ProjectBaseline;
    milestones?: ScheduleMilestones;
    sectionScopes?: SectionQuantityScope[];
    consolidatedScope?: ConsolidatedQuantityScope;
    cumulativeAchieved?: CumulativeAchievedQuantities;
  }) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const filename = file.name.toLowerCase();

      if (filename.includes('work') || filename.includes('program') || filename.includes('wp-r1')) {
        const plannedResult = parseRevisedWorkProgramBuffer(buffer);
        const planned = plannedResult.records || plannedResult;
        const baseline = plannedResult.baseline;
        const sectionScopes = plannedResult.sectionScopes;
        const consolidatedScope = plannedResult.consolidatedScope;
        onDataLoaded({ planned, baseline, sectionScopes, consolidatedScope });
        setStatusMessage(`Successfully loaded ${planned.length} planned schedule records and baseline targets from ${file.name}!`);
      } else {
        const { rows, metadata, qcLogs, milestones, cumulativeAchieved } = parseDPRBuffer(buffer);
        if (rows.length === 0) {
          throw new Error('No valid chainage execution rows found in the selected Excel workbook.');
        }
        onDataLoaded({ actual: rows, metadata, qcLogs, milestones, cumulativeAchieved });
        setStatusMessage(`Successfully ingested ${rows.length} DPR site execution rows & QC logs from ${file.name}!`);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(err.message || 'Failed to parse Excel workbook. Please check file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Site Progress Report Excel"
      subtitle="Select or drop a new Major Maintenance DPR or Revised Work Program workbook"
      maxWidth="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20 shadow-lg'
              : 'border-white/15 bg-[#121316]/50 hover:border-cyan-500/40 hover:bg-[#121316]'
          }`}
          onClick={() => document.getElementById('excel-file-input')?.click()}
        >
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              Click to select or drag & drop Excel workbook
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx files (Major_Maintenance_Daily_Progress_Report or Revised Work program-R-1_05-11-2026.xlsx)
            </p>
          </div>
          <Badge variant="cyan" size="xs">
            Client-Side Instant Parsing
          </Badge>
        </div>

        {isProcessing && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
            <span>Parsing Excel sheets, chainages, and quality logs...</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            Recognized Sheets & Columns:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
            <li><strong className="text-slate-300">Chainage Progress:</strong> Date, From/To Chainage, Activity, Length, Width, Depth, Achieved Today</li>
            <li><strong className="text-slate-300">Daily DPR:</strong> Concessionaire, Contractor, PMC, DPR No, Planned vs Achieved Totals</li>
            <li><strong className="text-slate-300">Revised Work Program:</strong> Stretch, Activity, Chainage From/To, Side, 10 Weekly Phases</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
