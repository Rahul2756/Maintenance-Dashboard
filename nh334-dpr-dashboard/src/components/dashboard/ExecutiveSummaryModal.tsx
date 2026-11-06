import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DPRMetadata, KPIAggregates } from '../../types/dpr';
import { Building2, HardHat, Calendar, Sun, Clock, FileText } from 'lucide-react';

interface ExecutiveSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: DPRMetadata;
  kpis: KPIAggregates;
}

export const ExecutiveSummaryModal: React.FC<ExecutiveSummaryModalProps> = ({
  isOpen,
  onClose,
  metadata,
  kpis
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Progress Report (DPR) – Executive Overview"
      subtitle={`${metadata.projectName} | Roorkee to Haridwar Section (Ch. 130+560 to Km 206+220 BHS)`}
      maxWidth="4xl"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Dismiss
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Project Meta Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Contract Stakeholders
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400">Concessionaire:</span>
                <span className="text-white font-medium text-right">{metadata.concessionaire}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400">Contractor:</span>
                <span className="text-white font-medium text-right">{metadata.contractor}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400">PMC / Consultant:</span>
                <span className="text-cyan-300 font-medium text-right">{metadata.pmc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Independent Engineer:</span>
                <span className="text-slate-300 text-right max-w-xs">{metadata.independentEngineer}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Operational Parameters
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400 font-sans">Report Date:</span>
                <span className="text-white font-bold">{metadata.reportDate}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400 font-sans">DPR Number:</span>
                <span className="text-cyan-300 font-bold">DPR #{metadata.dprNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400 font-sans">Weather Conditions:</span>
                <span className="text-white font-sans flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  {metadata.weather}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-slate-400 font-sans">Shift Schedule:</span>
                <span className="text-white font-sans flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  {metadata.shift}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Work Period:</span>
                <span className="text-slate-300">{metadata.workStartDate} to {metadata.targetCompletionDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Quantity Progress Matrix */}
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#121316]/70">
          <div className="px-4 py-3 bg-[#121316] border-b border-white/[0.08] flex items-center justify-between">
            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              Execution Quantity Summary
            </h5>
            <span className="text-[11px] font-mono text-slate-400">
              Corridor Length: 75.66 Km BHS
            </span>
          </div>

          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#16181D] border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-sans font-semibold">Indicator Activity</th>
                <th className="py-2.5 px-4">Unit</th>
                <th className="py-2.5 px-4 text-right">Target Benchmark</th>
                <th className="py-2.5 px-4 text-right">Cumulative Achieved</th>
                <th className="py-2.5 px-4 text-right">Progress %</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                  Milling
                </td>
                <td className="py-3 px-4 text-slate-400">sqm</td>
                <td className="py-3 px-4 text-right text-slate-300">{kpis.millingTarget.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-cyan-300">{kpis.millingAchieved.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-white">{kpis.millingPercent.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right">
                  <Badge variant={kpis.millingPercent >= 90 ? 'emerald' : 'cyan'} size="xs">
                    On Track
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                  TackCoat
                </td>
                <td className="py-3 px-4 text-slate-400">sqm</td>
                <td className="py-3 px-4 text-right text-slate-300">{kpis.tackcoatTarget.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-amber-300">{kpis.tackcoatAchieved.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-white">{kpis.tackcoatPercent.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right">
                  <Badge variant={kpis.tackcoatPercent >= 80 ? 'emerald' : 'amber'} size="xs">
                    Aligned
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                  DBM (Dense Bituminous Macadam)
                </td>
                <td className="py-3 px-4 text-slate-400">MT</td>
                <td className="py-3 px-4 text-right text-slate-300">{kpis.dbmTarget.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-300">{kpis.dbmAchieved.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-white">{kpis.dbmPercent.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right">
                  <Badge variant="emerald" size="xs">
                    Plant Operational
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
