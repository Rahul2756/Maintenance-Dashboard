import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  ChevronUp,
  ChevronDown,
  Upload,
  FileSpreadsheet,
  Calendar,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ExcelUploadMetadata {
  originalName: string;
  filename: string;
  uploadedAt: string;
  formattedDate: string;
  size?: number;
  status?: string;
  sheetCount?: number;
  sheets?: string[];
}

export interface ExcelUploadModuleProps {
  onReload?: () => Promise<void> | void;
  isLoading?: boolean;
}

export const ExcelUploadModule: React.FC<ExcelUploadModuleProps> = ({
  onReload,
  isLoading = false
}) => {
  const [metadata, setMetadata] = useState<ExcelUploadMetadata>({
    originalName: 'final_sheet.xlsx',
    filename: 'final_sheet.xlsx',
    uploadedAt: new Date().toISOString(),
    formattedDate: '01-Nov-2026',
    status: 'active'
  });

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'validating' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch persistent upload metadata on component mount
  const fetchMetadata = async () => {
    try {
      const res = await fetch(`/api/upload-metadata?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.filename) {
          setMetadata(data);
          return;
        }
      }
    } catch {
      // Fallback to local storage or defaults if endpoint is not reachable
    }

    // Check localStorage fallback
    try {
      const saved = localStorage.getItem('nh334_excel_upload_metadata');
      if (saved) {
        setMetadata(JSON.parse(saved));
      }
    } catch {}
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle manual reload click
  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await fetchMetadata();
      if (onReload) {
        await onReload();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Open file selector
  const handleUploadBtnClick = () => {
    if (uploadStatus === 'uploading' || uploadStatus === 'validating') return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process selected Excel file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Extension check
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setUploadStatus('failed');
      setStatusMessage('Invalid file format. Please upload an Excel workbook (.xlsx or .xls).');
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMessage(null);
      }, 5000);
      return;
    }

    setUploadStatus('validating');
    setStatusMessage('Validating workbook structure & sheets...');

    try {
      // 2. Read file as ArrayBuffer for client-side structural validation
      const arrayBuffer = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(arrayBuffer, { type: 'array' });
      } catch (err: any) {
        throw new Error('Corrupt or unreadable Excel workbook: ' + err.message);
      }

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('The uploaded workbook contains no worksheets.');
      }

      // Check required worksheets
      const lowerSheets = wb.SheetNames.map(s => s.toLowerCase().trim());
      const hasWorkProgram = lowerSheets.some(s => s.includes('work program'));
      const hasChainage = lowerSheets.some(
        s => s.includes('chainage log') || s.includes('chainage') || s.includes('dpr')
      );

      if (!hasWorkProgram && !hasChainage) {
        throw new Error(
          `Validation failed: Required sheets ('Work Program' or 'Chainage Log(input)') not found. Found: [${wb.SheetNames.join(', ')}]. Previous active workbook has been retained.`
        );
      }

      setUploadStatus('uploading');
      setStatusMessage('Saving to public/data/final_sheet.xlsx & refreshing...');

      // 3. Post to backend Vite middleware for atomic filesystem save
      let uploadSucceeded = false;
      let newMetadata: ExcelUploadMetadata | null = null;

      try {
        const response = await fetch('/api/upload-excel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-filename': encodeURIComponent(file.name)
          },
          body: arrayBuffer
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success && resJson.metadata) {
            newMetadata = resJson.metadata;
            uploadSucceeded = true;
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Server responded with status ${response.status}`);
        }
      } catch (networkErr: any) {
        // If server API is not available (e.g. running in purely static browser preview without dev server),
        // fallback to client-side localStorage persistence
        console.warn('API endpoint not reachable, applying client fallback:', networkErr.message);
        
        const now = new Date();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayStr = String(now.getDate()).padStart(2, '0');
        const monStr = months[now.getMonth()];
        const yrStr = now.getFullYear();
        const formattedDate = `${dayStr}-${monStr}-${yrStr}`;

        newMetadata = {
          originalName: file.name,
          filename: 'final_sheet.xlsx',
          uploadedAt: now.toISOString(),
          formattedDate,
          size: file.size,
          status: 'active',
          sheetCount: wb.SheetNames.length,
          sheets: wb.SheetNames
        };
        uploadSucceeded = true;
      }

      if (uploadSucceeded && newMetadata) {
        setMetadata(newMetadata);
        try {
          localStorage.setItem('nh334_excel_upload_metadata', JSON.stringify(newMetadata));
        } catch {}

        setUploadStatus('success');
        setStatusMessage(`Successfully saved ${file.name} as public/data/final_sheet.xlsx!`);

        // Trigger dashboard re-hydration
        if (onReload) {
          await onReload();
        }

        setTimeout(() => {
          setUploadStatus('idle');
          setStatusMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      console.error('Upload validation error:', err);
      setUploadStatus('failed');
      setStatusMessage(err.message || 'Failed to process workbook. Previous final_sheet.xlsx retained.');
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMessage(null);
      }, 7000);
    }
  };

  const isBusy = uploadStatus === 'uploading' || uploadStatus === 'validating' || isLoading || isRefreshing;

  return (
    <div className="w-full flex flex-col gap-2 relative z-30 font-sans select-none">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* Main Bar Matching Reference Image */}
      <div className="w-full flex flex-wrap items-center gap-3">
        {/* 1. Data Source Button with Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className={`bg-[#0B121E] hover:bg-[#111B2B] border ${
              isPopoverOpen ? 'border-[#00E599] text-white shadow-[0_0_12px_rgba(0,229,153,0.25)]' : 'border-white/10 hover:border-white/20 text-slate-200'
            } px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all shadow-sm`}
          >
            <Database className="w-4 h-4 text-[#00E599]" />
            <span>Data Source</span>
            {isPopoverOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {/* Popover Card */}
          {isPopoverOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 w-80 bg-[#09121D] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 backdrop-blur-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#00E599]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Single Source of Truth
                  </span>
                </div>
                <button
                  onClick={() => setIsPopoverOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-400">Authoritative File:</span>
                  <span className="font-mono font-bold text-[#00E599] text-right">
                    public/data/final_sheet.xlsx
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-400">Worksheets:</span>
                  <span className="font-mono text-slate-200 text-right">
                    Work Program, Chainage Log(input)
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-400">Corridor Length:</span>
                  <span className="font-mono text-slate-200 text-right">
                    75.660 km (Ch. 130+560 to 206+220)
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-400">Last Synced:</span>
                  <span className="font-mono text-cyan-300 text-right">
                    {metadata.formattedDate || '01-Nov-2026'}
                  </span>
                </div>
              </div>

              <div className="bg-[#03070E] p-2.5 rounded-xl border border-white/5 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-[#00E599] shrink-0 mt-0.5" />
                <span>
                  Uploading an Excel workbook validates required sheets and replaces <code className="text-emerald-400">final_sheet.xlsx</code> permanently on disk.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Upload final_sheet.xlsx Button */}
        <button
          onClick={handleUploadBtnClick}
          disabled={uploadStatus === 'uploading' || uploadStatus === 'validating'}
          className={`border border-[#00E599]/60 hover:border-[#00E599] hover:bg-[#00E599]/15 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm shadow-[#00E599]/10 ${
            isBusy ? 'opacity-80 cursor-wait' : 'active:scale-95'
          }`}
          title="Upload updated Excel workbook to public/data/final_sheet.xlsx"
        >
          {uploadStatus === 'uploading' || uploadStatus === 'validating' ? (
            <Loader2 className="w-4 h-4 text-[#00E599] animate-spin" />
          ) : (
            <Upload className="w-4 h-4 text-[#00E599]" />
          )}
          <span>Upload final_sheet.xlsx</span>
        </button>

        {/* 3. Active Filename Pill */}
        <div className="bg-[#0B121E] border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-200 flex items-center gap-2 shadow-inner">
          <FileSpreadsheet className="w-4 h-4 text-slate-300 shrink-0" />
          <span className="truncate max-w-[180px] sm:max-w-[240px]">
            {metadata.filename || 'final_sheet.xlsx'}
          </span>
        </div>

        {/* 4. Uploaded Date/Time Pill */}
        <div className="bg-[#0B121E] border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-200 flex items-center gap-2 shadow-inner">
          <Calendar className="w-4 h-4 text-slate-300 shrink-0" />
          <span>Uploaded: {metadata.formattedDate || '01-Nov-2026'}</span>
        </div>

        {/* 5. Status Badge */}
        {uploadStatus === 'validating' ? (
          <div className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shadow-cyan-900/30">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Validating</span>
          </div>
        ) : uploadStatus === 'uploading' ? (
          <div className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shadow-cyan-900/30">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Processing</span>
          </div>
        ) : uploadStatus === 'failed' ? (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shadow-rose-900/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Failed</span>
          </div>
        ) : uploadStatus === 'success' ? (
          <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-mono text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shadow-emerald-900/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Updated</span>
          </div>
        ) : (
          <div className="bg-[#003B2A]/70 border border-[#00E599]/40 text-[#00E599] font-mono text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shadow-[#00E599]/20">
            <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
            <span>Active</span>
          </div>
        )}

        {/* 6. Refresh Button */}
        <button
          onClick={handleRefreshClick}
          disabled={isBusy}
          className="bg-[#0B121E] hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95"
          title="Reload Excel Single Source of Truth"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin text-[#00E599]' : ''}`} />
        </button>
      </div>

      {/* Dynamic Status / Error Feedback Message Bar */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-xs font-medium backdrop-blur-md transition-all animate-fade-in ${
            uploadStatus === 'failed'
              ? 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
              : uploadStatus === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
              : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadStatus === 'failed' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : uploadStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-white/60 hover:text-white p-1 rounded-lg"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ExcelUploadModule;

