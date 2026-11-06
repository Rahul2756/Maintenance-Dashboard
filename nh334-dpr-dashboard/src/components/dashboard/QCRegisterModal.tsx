import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { QCTestLogItem } from '../../types/dpr';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck } from 'lucide-react';

interface QCRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: QCTestLogItem[];
}

export const QCRegisterModal: React.FC<QCRegisterModalProps> = ({
  isOpen,
  onClose,
  logs
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quality Control & Compliance Register"
      subtitle="MoRTH Table 900-4 & Project Quality Assurance Plan (QAP) Verification"
      maxWidth="4xl"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* KPI Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[#121316] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Total QC Tests</span>
              <p className="text-lg font-bold text-white font-mono">{logs.length} logged</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121316] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">MoRTH Compliance</span>
              <p className="text-lg font-bold text-emerald-300 font-mono">
                {logs.length > 0
                  ? (
                      (logs.filter(l => l.status === 'Pass' || l.status === 'Ok').length / logs.length) *
                      100
                    ).toFixed(1)
                  : 100}
                %
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121316] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Active NCRs</span>
              <p className="text-lg font-bold text-rose-300 font-mono">
                {logs.filter(l => l.status === 'Fail').length} Issued
              </p>
            </div>
          </div>
        </div>

        {/* Tests Table */}
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#121316]/60">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#121316] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3">Test Name</th>
                <th className="py-2.5 px-3">Location / Plant</th>
                <th className="py-2.5 px-3">Required Criteria</th>
                <th className="py-2.5 px-3">Observed Result</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Remarks / NCR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {logs.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 text-slate-200">{item.date}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {item.material}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-white">{item.testName}</td>
                  <td className="py-2.5 px-3 text-slate-400">{item.location}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.criteria}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-300">
                    {String(item.result)}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      variant={item.status === 'Fail' ? 'crimson' : 'emerald'}
                      size="xs"
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                    {item.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
