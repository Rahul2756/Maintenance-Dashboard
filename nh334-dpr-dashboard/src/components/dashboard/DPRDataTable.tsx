import React, { useState, useMemo } from 'react';
import { ActualDPRRow, ActivityType } from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Table,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter
} from 'lucide-react';
import { formatChainageKm, formatChainagePlus } from '../../utils/excelParser';
import { useTheme } from '../../context/ThemeContext';

interface DPRDataTableProps {
  rows: ActualDPRRow[];
  dateRange?: { start: string; end: string };
  selectedRowId?: string | null;
  onSelectRow?: (row: ActualDPRRow) => void;
}

type SortField =
  | 'date'
  | 'fromChainage'
  | 'toChainage'
  | 'activity'
  | 'lane'
  | 'lengthM'
  | 'widthM'
  | 'depthM'
  | 'achievedToday'
  | 'cumulativeAchieved'
  | 'isAnomaly';

export const DPRDataTable: React.FC<DPRDataTableProps> = ({
  rows,
  dateRange,
  selectedRowId,
  onSelectRow
}) => {
  const { isLight } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [activityFilter, setActivityFilter] = useState<'ALL' | ActivityType>('ALL');
  const [anomaliesOnly, setAnomaliesOnly] = useState<boolean>(false);

  // Filter and search
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (activityFilter !== 'ALL' && r.activity !== activityFilter) return false;
      if (anomaliesOnly && !r.isAnomaly) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        r.date.toLowerCase().includes(term) ||
        r.activity.toLowerCase().includes(term) ||
        r.lane.toLowerCase().includes(term) ||
        r.fromChainage.toFixed(3).includes(term) ||
        r.toChainage.toFixed(3).includes(term) ||
        r.remarks.toLowerCase().includes(term) ||
        r.anomalyDescription.toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm, activityFilter, anomaliesOnly]);

  // Sort
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle date sorting (DD.MM.YYYY)
      if (sortField === 'date') {
        const [ad, am, ay] = a.date.split('.').map(Number);
        const [bd, bm, by] = b.date.split('.').map(Number);
        const dateA = new Date(ay, am - 1, ad).getTime();
        const dateB = new Date(by, bm - 1, bd).getTime();
        return sortAsc ? dateA - dateB : dateB - dateA;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = aVal || 0;
      bVal = bVal || 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [filteredRows, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-1 opacity-60" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 inline ml-1" />
    );
  };

  const exportTableCSV = () => {
    const headers = [
      'Date',
      'From Chainage (km)',
      'To Chainage (km)',
      'Side',
      'Lane',
      'Activity',
      'Length (m)',
      'Width (m)',
      'Depth (mm)',
      'Achieved Today',
      'Unit',
      'Cumulative Achieved',
      'Is Anomaly',
      'Remarks'
    ];

    const csvRows = sortedRows.map(r => [
      r.date,
      r.fromChainage.toFixed(3),
      r.toChainage.toFixed(3),
      r.side,
      r.lane,
      r.activity,
      r.lengthM,
      r.widthM,
      r.depthMm || (r.depthM ? Math.round(r.depthM * 1000) : '-'),
      r.achievedToday,
      r.unit,
      r.cumulativeAchieved,
      r.isAnomaly ? 'YES' : 'NO',
      `"${r.remarks.replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NH334_DPR_Chainage_Progress_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full overflow-hidden">
      {/* Table Toolbar */}
      <CardHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search chainage, lane, remarks..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#121316] text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-xl border border-white/10 focus:border-cyan-500/50 focus:outline-none w-48 sm:w-64"
              />
            </div>

            <Button
              variant="secondary"
              size="xs"
              onClick={exportTableCSV}
              icon={<Download className="w-3 h-3 text-cyan-400" />}
            >
              CSV
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle icon={<Table className="w-4 h-4 text-cyan-400" />}>
            Detailed DPR Chainage Logs & Anomaly Data Grid
          </CardTitle>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
            {sortedRows.length} entries
          </span>
          {dateRange?.start && dateRange?.end && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
              {dateRange.start === dateRange.end ? `Date: ${dateRange.start}` : `Range: ${dateRange.start} → ${dateRange.end}`}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Normalized 3-decimal chainages (189.xxx km), executed dimensions, and quality remarks
        </p>
      </CardHeader>

      {/* Filter Tabs */}
      <div className="px-5 py-2 border-b border-white/[0.04] bg-[#121316]/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-medium mr-1">Filter:</span>
          {(['ALL', 'Milling', 'Tackcoat', 'DBM'] as const).map(f => (
            <button
              key={f}
              onClick={() => {
                setActivityFilter(f);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activityFilter === f
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f === 'ALL' ? 'All Activities' : f}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setAnomaliesOnly(!anomaliesOnly);
            setCurrentPage(1);
          }}
          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            anomaliesOnly
              ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 glow-crimson'
              : 'bg-[#181B22] text-slate-400 border-white/10 hover:text-rose-300'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          <span>Show Anomalies Only ({rows.filter(r => r.isAnomaly).length})</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#121316]/90 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px] tracking-wider select-none">
            <tr>
              <th
                onClick={() => handleSort('date')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
              >
                Date {renderSortIcon('date')}
              </th>
              <th
                onClick={() => handleSort('fromChainage')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
              >
                From Chainage {renderSortIcon('fromChainage')}
              </th>
              <th
                onClick={() => handleSort('toChainage')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
              >
                To Chainage {renderSortIcon('toChainage')}
              </th>
              <th className="py-3 px-3 font-semibold">Side</th>
              <th className="py-3 px-3 font-semibold">Lane</th>
              <th
                onClick={() => handleSort('activity')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
              >
                Activity {renderSortIcon('activity')}
              </th>
              <th
                onClick={() => handleSort('lengthM')}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-white"
              >
                Length (m) {renderSortIcon('lengthM')}
              </th>
              <th
                onClick={() => handleSort('widthM')}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-white"
              >
                Width (m) {renderSortIcon('widthM')}
              </th>
              <th className="py-3 px-3 font-semibold text-right">Depth</th>
              <th
                onClick={() => handleSort('achievedToday')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white"
              >
                Achieved Today {renderSortIcon('achievedToday')}
              </th>
              <th
                onClick={() => handleSort('cumulativeAchieved')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white"
              >
                Cumulative {renderSortIcon('cumulativeAchieved')}
              </th>
              <th
                onClick={() => handleSort('isAnomaly')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
              >
                Status & Remarks {renderSortIcon('isAnomaly')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500 font-mono">
                  {dateRange?.start && dateRange?.end
                    ? `No execution records available for the selected date range (${dateRange.start} → ${dateRange.end}) and active filters.`
                    : 'No execution records found matching your filter criteria.'}
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const isSelected = selectedRowId === r.id;

                let rowBg = isLight
                  ? 'odd:bg-white even:bg-[#F9FBFC] hover:bg-[#F0F7F3]'
                  : 'hover:bg-white/[0.03]';
                if (r.isAnomaly) {
                  rowBg = isLight
                    ? 'bg-rose-50/70 hover:bg-rose-50'
                    : 'bg-rose-950/20 hover:bg-rose-950/30';
                }
                if (isSelected) {
                  rowBg = isLight
                    ? 'bg-[#DDF5EA] ring-1 ring-[#07966D]/40'
                    : 'bg-cyan-950/40 ring-1 ring-cyan-500/40';
                }

                return (
                  <tr
                    key={r.id || idx}
                    onClick={() => onSelectRow && onSelectRow(r)}
                    className={`transition-colors cursor-pointer ${rowBg}`}
                  >
                    {/* Date */}
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                      {r.date}
                    </td>

                    {/* From Chainage */}
                    <td className="py-2.5 px-4 font-mono text-cyan-300 font-semibold whitespace-nowrap">
                      <span className="text-white">{formatChainageKm(r.fromChainage)}</span>
                      <span className="text-slate-500 text-[10px] ml-1.5 block">
                        {formatChainagePlus(r.fromChainage)}
                      </span>
                    </td>

                    {/* To Chainage */}
                    <td className="py-2.5 px-4 font-mono text-cyan-300 font-semibold whitespace-nowrap">
                      <span className="text-white">{formatChainageKm(r.toChainage)}</span>
                      <span className="text-slate-500 text-[10px] ml-1.5 block">
                        {formatChainagePlus(r.toChainage)}
                      </span>
                    </td>

                    {/* Side */}
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {r.side}
                      </span>
                    </td>

                    {/* Lane */}
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {r.lane}
                    </td>

                    {/* Activity */}
                    <td className="py-2.5 px-4">
                      <Badge
                        variant={
                          r.activity === 'Milling'
                            ? 'cyan'
                            : r.activity === 'Tackcoat'
                            ? 'amber'
                            : 'emerald'
                        }
                        size="xs"
                        className="font-mono"
                      >
                        {r.activity}
                      </Badge>
                    </td>

                    {/* Length */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      {r.lengthM}
                    </td>

                    {/* Width */}
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={
                          r.widthM > 4.5
                            ? 'text-amber-400 font-bold bg-amber-500/10 px-1 py-0.5 rounded'
                            : 'text-slate-200'
                        }
                      >
                        {r.widthM.toFixed(1)}
                      </span>
                    </td>

                    {/* Depth */}
                    <td className="py-2.5 px-3 text-right font-mono">
                      {r.depthMm && r.depthMm > 55 ? (
                        <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                          {r.depthMm}mm ⚠
                        </span>
                      ) : r.depthMm ? (
                        <span className="text-slate-300">{r.depthMm}mm</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Achieved Today */}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {r.achievedToday.toLocaleString()}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">{r.unit}</span>
                    </td>

                    {/* Cumulative Achieved */}
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300 whitespace-nowrap">
                      {r.cumulativeAchieved.toLocaleString()}
                    </td>

                    {/* Status & Remarks */}
                    <td className="py-2.5 px-4 max-w-xs">
                      {r.isAnomaly ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="crimson" size="xs" pulse className="font-semibold">
                            {r.anomalyCategory === 'milling_excess_depth'
                              ? 'Milling Depth > 50mm'
                              : r.anomalyCategory === 'offset'
                              ? 'Offset Deviation'
                              : 'Excess Qty'}
                          </Badge>
                          <span className="text-[11px] text-rose-300/90 italic truncate">
                            {r.remarks || r.anomalyDescription}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400/90 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {r.remarks || 'Standard Tol.'}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-white/[0.06] bg-[#121316]/80 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#1A1D24] text-slate-200 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={12}>12</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>records per page</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono text-xs">
            Page <span className="text-white font-bold">{currentPage}</span> of{' '}
            <span className="text-white font-bold">{totalPages}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-[#1A1D24] text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-[#1A1D24] text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};
