import React, { useState, useEffect, useMemo } from 'react';
import {
  ActualDPRRow,
  PlannedRecord,
  DPRMetadata,
  QCTestLogItem,
  KPIAggregates,
  DailyProgressComparison,
  ProjectBaseline,
  ScheduleMilestones,
  SectionQuantityScope,
  ConsolidatedQuantityScope,
  CumulativeAchievedQuantities
} from './types/dpr';
import {
  loadDashboardData,
  computeBOQProgressMetrics,
  dmyToIso,
  DEFAULT_PROJECT_BASELINE,
  DEFAULT_SCHEDULE_MILESTONES,
  DEFAULT_SECTION_SCOPES,
  DEFAULT_CONSOLIDATED_SCOPE,
  DEFAULT_CUMULATIVE_ACHIEVED,
  getPhasedTargetForDate,
  getPhasedMillingTargetForDate,
  StretchWiseTemplateRow
} from './utils/excelParser';
import {
  FilterProvider,
  useFilters,
  rowMatchesGlobalFilter
} from './context/FilterContext';
import { HeaderFilterBar } from './components/dashboard/HeaderFilterBar';
import { TopHeader } from './components/layout/TopHeader';
import { KPICards } from './components/dashboard/KPICards';
import { LinearKPICards } from './components/dashboard/LinearKPICards';
import { StretchWiseSummaryModule } from './components/dashboard/StretchWiseSummaryModule';
import { PlannedVsActualChart } from './components/dashboard/PlannedVsActualChart';
import { SCurveForecastChart } from './components/dashboard/SCurveForecastChart';
import { SCurveActualChart } from './components/dashboard/SCurveActualChart';
import { ActivityCompletionBalance } from './components/dashboard/ActivityCompletionBalance';
import { LHSRHSProgressComparison } from './components/dashboard/LHSRHSProgressComparison';
import { LinearChainageStrip } from './components/dashboard/LinearChainageStrip';
import { Highway3DDigitalTwin } from './components/dashboard/Highway3DDigitalTwin';
import { GeographicalGISModule } from './components/gis/GeographicalGISModule';
import { StripChartDataset } from './types/stripChart';
import { DPRDataTable } from './components/dashboard/DPRDataTable';
import { DailyQuickInsight } from './components/dashboard/DailyQuickInsight';
import { ProjectOverviewModule } from './components/dashboard/ProjectOverviewModule';
import { FileUploadModal } from './components/ui/FileUploadModal';
import { QCRegisterModal } from './components/dashboard/QCRegisterModal';
import { ExecutiveSummaryModal } from './components/dashboard/ExecutiveSummaryModal';
import {
  loadAllStoredData,
  UploadMetadata,
  StoredPlannedData,
  StoredActualData
} from './utils/storage';
import { Loader2, CheckCircle2, Layers, BarChart3, Compass, FileSpreadsheet, Calendar, Sparkles } from 'lucide-react';
import { ModuleSeparator } from './components/dashboard/ModuleSeparator';

function DashboardContent() {
  const {
    filters,
    setDateRange,
    activeModule,
    setSelectedSingleDate,
    setSelectedActivities,
    selectAllActivities,
    toggleActivity
  } = useFilters();

  const [actualRows, setActualRows] = useState<ActualDPRRow[]>([]);
  const [plannedRecords, setPlannedRecords] = useState<PlannedRecord[]>([]);
  const [baseline, setBaseline] = useState<ProjectBaseline>(DEFAULT_PROJECT_BASELINE);
  const [metadata, setMetadata] = useState<DPRMetadata>({
    projectName: 'Muzaffarnagar - Haridwar Section, NH-334 (Ch. 130+560KM to 206+220KM)',
    contractor: 'M/s Atcons India Limited',
    concessionaire: 'NHIT Southern Projects private limited',
    pm: 'National Highways InvIT Project Managers Pvt. Ltd.',
    pmc: 'Cube Highways Technologies Pvt Ltd',
    independentEngineer: 'Chaitanya Projects Consultancy Limited in Association with Mahamarg Infra Consultants Pvt. Ltd',
    dprNo: 11,
    reportDate: '23.10.2026',
    weather: 'Clear',
    shift: 'Day & Night / 24 hrs',
    workStartDate: '13.10.2026 (Planned)',
    targetCompletionDate: '20.11.2026'
  });
  const [milestones, setMilestones] = useState<ScheduleMilestones>(DEFAULT_SCHEDULE_MILESTONES);
  const [sectionScopes, setSectionScopes] = useState<SectionQuantityScope[]>(DEFAULT_SECTION_SCOPES);
  const [consolidatedScope, setConsolidatedScope] = useState<ConsolidatedQuantityScope>(DEFAULT_CONSOLIDATED_SCOPE);
  const [cumulativeAchieved, setCumulativeAchieved] = useState<CumulativeAchievedQuantities>(DEFAULT_CUMULATIVE_ACHIEVED);
  const [qcLogs, setQcLogs] = useState<QCTestLogItem[]>([]);
  const [dataSource, setDataSource] = useState<'live_excel' | 'fallback' | 'indexeddb'>('live_excel');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uploadMeta, setUploadMeta] = useState<UploadMetadata | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Set official page title
  useEffect(() => {
    document.title = 'Muzaffarnagar - Haridwar Section, NH-334 (Ch. 130+560KM to 206+220KM)';
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Selected row for cross-component highlighting
  const [selectedRow, setSelectedRow] = useState<ActualDPRRow | null>(null);

  // Two-way synchronization state between Strip Chart and GIS Map
  const [mapSelectedChainage, setMapSelectedChainage] = useState<number | null>(null);
  const [stripTargetChainage, setStripTargetChainage] = useState<number | null>(null);
  const [sharedStripDataset, setSharedStripDataset] = useState<StripChartDataset | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isQCOpen, setIsQCOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Hydrate dashboard dynamically from final_sheet.xlsx (Single Source of Truth)
  const hydrateDashboard = async () => {
    setIsLoading(true);
    try {
      const defaultData = await loadDashboardData();
      setActualRows(defaultData.actual);
      setPlannedRecords(defaultData.planned);
      setBaseline(defaultData.baseline);
      setSectionScopes(defaultData.sectionScopes);
      setConsolidatedScope(defaultData.consolidatedScope);
      setMetadata(defaultData.metadata);
      setQcLogs(defaultData.qcLogs);
      setMilestones(defaultData.milestones);
      setCumulativeAchieved(defaultData.cumulativeAchieved);
      setDataSource(defaultData.source);
    } catch (e) {
      console.error('Failed to load final_sheet.xlsx, checking stored data:', e);
      try {
        const { plannedData, actualData } = await loadAllStoredData();
        if (plannedData && actualData) {
          setPlannedRecords(plannedData.plannedRecords);
          setBaseline(plannedData.baseline);
          setActualRows(actualData.actualRows);
          setMetadata(actualData.metadata);
          setQcLogs(actualData.qcLogs);
          setDataSource('indexeddb');
          return;
        }
      } catch {}
      const fallbackData = await loadDashboardData();
      setActualRows(fallbackData.actual);
      setPlannedRecords(fallbackData.planned);
      setBaseline(fallbackData.baseline);
      setMetadata(fallbackData.metadata);
      setQcLogs(fallbackData.qcLogs);
      setDataSource('fallback');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlannedUpdate = (data: StoredPlannedData) => {
    setPlannedRecords(data.plannedRecords);
    setBaseline(data.baseline);
    if (data.sectionScopes) setSectionScopes(data.sectionScopes);
    if (data.consolidatedScope) setConsolidatedScope(data.consolidatedScope);
    setDataSource('indexeddb');
    setUploadMeta(prev => ({
      ...prev,
      plannedFileName: data.filename || 'Revised Work program-R-1_05-11-2026.xlsx',
      plannedTimestamp: data.updatedAt,
      plannedRowCount: data.plannedRecords?.length
    }));
    showToast('Revised Work Program R1 baseline updated & persisted successfully', 'success');
  };

  const handleActualUpdate = (data: StoredActualData) => {
    setActualRows(data.actualRows);
    setMetadata(data.metadata);
    setQcLogs(data.qcLogs);
    if (data.milestones) setMilestones(data.milestones);
    if (data.cumulativeAchieved) setCumulativeAchieved(data.cumulativeAchieved);
    setDataSource('indexeddb');
    setUploadMeta(prev => ({
      ...prev,
      actualFileName: data.filename || 'Major_Maintenance_DPR.xlsx',
      actualTimestamp: data.updatedAt,
      actualRowCount: data.actualRows?.length,
      reportDate: data.metadata?.reportDate
    }));
    showToast('Actual DPR execution updated & persisted successfully', 'success');
  };

  useEffect(() => {
    hydrateDashboard();
  }, []);

  const handleReload = async () => {
    setIsLoading(true);
    try {
      const data = await loadDashboardData();
      setActualRows(data.actual);
      setPlannedRecords(data.planned);
      setBaseline(data.baseline);
      setSectionScopes(data.sectionScopes);
      setConsolidatedScope(data.consolidatedScope);
      setMetadata(data.metadata);
      setQcLogs(data.qcLogs);
      setMilestones(data.milestones);
      setCumulativeAchieved(data.cumulativeAchieved);
      setDataSource(data.source);
      showToast('Live Excel data synchronized', 'success');
    } catch (err) {
      console.error('Reload failed:', err);
      showToast('Failed to reload live Excel files', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Sorted unique dates present in actual DPR
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    actualRows.forEach(r => {
      if (r.date) dateSet.add(r.date);
    });
    return Array.from(dateSet).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });
  }, [actualRows]);

  // Update filter start/end if dates loaded
  useEffect(() => {
    if (availableDates.length > 0) {
      if (!filters.dateRange.start || !filters.dateRange.end) {
        setDateRange({
          start: availableDates[0],
          end: availableDates[availableDates.length - 1]
        });
      }
    }
  }, [availableDates, filters.dateRange.start, filters.dateRange.end, setDateRange]);

  // Filtered actual DPR rows based on global filter controls
  const filteredRows = useMemo(() => {
    return actualRows.filter(r => rowMatchesGlobalFilter(r, filters));
  }, [actualRows, filters]);

  // Selected date (As of date) for DPR and cumulative calculations
  const selectedDate = filters.selectedSingleDate || filters.dateRange.end || (availableDates[availableDates.length - 1] || '01.11.2026');
  const selectedIso = dmyToIso(selectedDate);

  // Authoritative BOQ and Linear progress metrics computed dynamically from final_sheet.xlsx
  const boqMetrics = useMemo(() => {
    return computeBOQProgressMetrics(actualRows, baseline, selectedDate, filters.side);
  }, [actualRows, baseline, selectedDate, filters.side]);

  // Cumulative rows up to and including selectedDate (matching side filter)
  const cumulativeRows = useMemo(() => {
    return actualRows.filter(r => {
      const rIso = r.isoDate || dmyToIso(r.date);
      const matchesDate = rIso !== '' && selectedIso !== '' && rIso <= selectedIso;
      const matchesSide = filters.side === 'Both' || r.side === filters.side || r.side === 'BHS';
      return matchesDate && matchesSide;
    });
  }, [actualRows, selectedIso, filters.side]);

  // Filtered rows matching date, activity, and chainage but retaining both LHS & RHS for side-wise comparison
  const filteredRowsBothSides = useMemo(() => {
    return actualRows.filter(r => rowMatchesGlobalFilter(r, { ...filters, side: 'Both' }));
  }, [actualRows, filters]);

  // Total anomalies in dataset
  const totalAnomaliesCount = useMemo(() => {
    return actualRows.filter(r => r.isAnomaly).length;
  }, [actualRows]);

  // Aggregate KPIs reactively against authoritative final_sheet.xlsx data
  const kpis: KPIAggregates = useMemo(() => {
    const isMillingSelected = filters.selectedActivities.includes('Milling');
    const isTackSelected = filters.selectedActivities.includes('Tackcoat');
    const isDbmSelected = filters.selectedActivities.includes('DBM');
    const isBcSelected = filters.selectedActivities.includes('BC');

    // Daily sparklines (cumulative progression over available dates)
    const millingSparkline: number[] = [];
    const tackcoatSparkline: number[] = [];
    const dbmSparkline: number[] = [];
    const bcSparkline: number[] = [];

    let cumMilling = 0;
    let cumTack = 0;
    let cumDbm = 0;
    let cumBc = 0;

    availableDates.forEach(date => {
      const dayRows = actualRows.filter(r => r.date === date && (filters.side === 'Both' || r.side === filters.side || r.side === 'BHS'));
      dayRows.forEach(r => {
        if (r.activity === 'Milling') cumMilling += r.achievedToday;
        if (r.activity === 'Tackcoat') cumTack += r.achievedToday;
        if (r.activity === 'DBM') cumDbm += r.achievedToday;
        if (r.activity === 'BC') cumBc += r.achievedToday;
      });
      millingSparkline.push(cumMilling);
      tackcoatSparkline.push(cumTack);
      dbmSparkline.push(cumDbm);
      bcSparkline.push(cumBc);
    });

    // Anomalies count
    const excessDepth = filteredRows.filter(r => r.anomalyCategory === 'milling_excess_depth').length;
    const offset = filteredRows.filter(r => r.anomalyCategory === 'offset').length;
    const excessQty = filteredRows.filter(r => r.anomalyCategory === 'excess_qty').length;
    const totalAnom = filteredRows.filter(r => r.isAnomaly).length;

    // Overall Adherence Score weighted strictly across currently selected activities
    let weightedSum = 0;
    let totalWeight = 0;
    if (isMillingSelected) {
      weightedSum += boqMetrics.milling.progressPercent * 0.35;
      totalWeight += 0.35;
    }
    if (isTackSelected) {
      weightedSum += boqMetrics.tackcoat.progressPercent * 0.20;
      totalWeight += 0.20;
    }
    if (isDbmSelected) {
      weightedSum += boqMetrics.dbm.progressPercent * 0.25;
      totalWeight += 0.25;
    }
    if (isBcSelected) {
      weightedSum += boqMetrics.bc.progressPercent * 0.20;
      totalWeight += 0.20;
    }
    const overallAdherence = totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 100;

    return {
      // 1. Milling
      millingAchieved: boqMetrics.milling.cumulativeAchieved,
      millingAchievedToday: boqMetrics.milling.achievedToday,
      millingCumulative: boqMetrics.milling.cumulativeAchieved,
      millingBalance: boqMetrics.milling.balanceQuantity,
      millingTarget: boqMetrics.milling.targetQuantity,
      millingVariance: boqMetrics.milling.cumulativeAchieved - boqMetrics.milling.targetQuantity,
      millingPercent: boqMetrics.milling.progressPercent,
      millingSparkline,
      millingCardMetric: boqMetrics.milling,

      // 2. Tackcoat
      tackcoatAchieved: boqMetrics.tackcoat.cumulativeAchieved,
      tackcoatAchievedToday: boqMetrics.tackcoat.achievedToday,
      tackcoatCumulative: boqMetrics.tackcoat.cumulativeAchieved,
      tackcoatBalance: boqMetrics.tackcoat.balanceQuantity,
      tackcoatTarget: boqMetrics.tackcoat.targetQuantity,
      tackcoatVariance: boqMetrics.tackcoat.cumulativeAchieved - boqMetrics.tackcoat.targetQuantity,
      tackcoatPercent: boqMetrics.tackcoat.progressPercent,
      tackcoatSparkline,
      tackcoatCardMetric: boqMetrics.tackcoat,

      // 3. DBM (Strictly in Cum)
      dbmAchieved: boqMetrics.dbm.cumulativeAchieved,
      dbmAchievedCum: boqMetrics.dbm.cumulativeAchieved,
      dbmAchievedTodayCum: boqMetrics.dbm.achievedToday,
      dbmCumulativeCum: boqMetrics.dbm.cumulativeAchieved,
      dbmBalanceCum: boqMetrics.dbm.balanceQuantity,
      dbmTarget: boqMetrics.dbm.targetQuantity,
      dbmTargetCum: boqMetrics.dbm.targetQuantity,
      dbmVariance: boqMetrics.dbm.cumulativeAchieved - boqMetrics.dbm.targetQuantity,
      dbmPercent: boqMetrics.dbm.progressPercent,
      dbmSparkline,
      dbmCardMetric: boqMetrics.dbm,

      // 4. BC (Strictly in Cum)
      bcAchieved: boqMetrics.bc.cumulativeAchieved,
      bcAchievedCum: boqMetrics.bc.cumulativeAchieved,
      bcAchievedTodayCum: boqMetrics.bc.achievedToday,
      bcCumulativeCum: boqMetrics.bc.cumulativeAchieved,
      bcBalanceCum: boqMetrics.bc.balanceQuantity,
      bcTarget: boqMetrics.bc.targetQuantity,
      bcTargetCum: boqMetrics.bc.targetQuantity,
      bcVariance: boqMetrics.bc.cumulativeAchieved - boqMetrics.bc.targetQuantity,
      bcPercent: boqMetrics.bc.progressPercent,
      bcSparkline,
      bcCardMetric: boqMetrics.bc,

      // Linear distance aggregates
      linearMetrics: boqMetrics.linearMetrics,

      overallAdherence,
      totalAnomaliesCount: totalAnom,
      excessQtyCount: excessQty,
      excessDepthCount: excessDepth,
      offsetCount: offset
    };
  }, [boqMetrics, actualRows, availableDates, filters.selectedActivities, filters.side, filteredRows]);

  // Grouped daily progress comparisons for Bar/Line visual
  const dailyComparisons: DailyProgressComparison[] = useMemo(() => {
    return availableDates.map(date => {
      const dayRows = actualRows.filter(r => r.date === date);
      let millingAchieved = 0;
      let tackcoatAchieved = 0;
      let dbmAchievedCum = 0;
      let bcAchievedCum = 0;

      dayRows.forEach(r => {
        if (r.activity === 'Milling') {
          millingAchieved += r.achievedToday;
        } else if (r.activity === 'Tackcoat') {
          tackcoatAchieved += r.achievedToday;
        } else if (r.activity === 'DBM') {
          dbmAchievedCum += r.achievedToday;
        } else if (r.activity === 'BC') {
          bcAchievedCum += r.achievedToday;
        }
      });

      const phasedDailyTargetMT = getPhasedTargetForDate(date, baseline.dailyPhases);
      const phasedDailyMillingSqm = getPhasedMillingTargetForDate(date, baseline.dailyPhases);
      const actualDbmMT = Number((dbmAchievedCum * 2.38).toFixed(2));
      const actualDbmCum = Number(dbmAchievedCum.toFixed(2));
      const phasedDailyTargetCum = Number((phasedDailyTargetMT / 2.38).toFixed(2));
      const tackcoatPlanned = Math.round(phasedDailyMillingSqm * 0.85);
      const rate = phasedDailyTargetCum > 0 ? Math.min(150, Math.round((actualDbmCum / phasedDailyTargetCum) * 100)) : 100;

      const [d, m] = date.split('.');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[Number(m) - 1] || 'Oct';
      const displayDate = `${d} ${monthName}`;

      return {
        date,
        displayDate,
        millingPlanned: phasedDailyMillingSqm,
        millingAchieved: Math.round(millingAchieved),
        tackcoatPlanned: tackcoatPlanned,
        tackcoatAchieved: Math.round(tackcoatAchieved),
        dbmPlanned: phasedDailyTargetCum,
        dbmAchieved: actualDbmCum,
        bcPlanned: 0,
        bcAchieved: Number(bcAchievedCum.toFixed(2)),
        totalPlannedWeighted: phasedDailyTargetMT,
        totalAchievedWeighted: actualDbmMT,
        adherenceRate: rate
      };
    });
  }, [availableDates, actualRows, baseline]);

  // Export full report action
  const handleExportFullReport = () => {
    const reportData = {
      project: metadata.projectName,
      contractor: metadata.contractor,
      pmc: metadata.pmc,
      dprNo: metadata.dprNo,
      reportDate: metadata.reportDate,
      kpis: {
        millingAchieved: kpis.millingAchieved,
        tackcoatAchieved: kpis.tackcoatAchieved,
        dbmAchieved: kpis.dbmAchieved,
        bcAchieved: kpis.bcAchieved,
        overallAdherence: kpis.overallAdherence,
        anomaliesCount: kpis.totalAnomaliesCount
      },
      filteredRowsCount: filteredRows.length
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NH334_DPR_Executive_Summary_${metadata.reportDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full-screen loading spinner during initial hydration
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0C0E] flex flex-col items-center justify-center p-4">
        <div className="relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#16181D]/90 border border-white/10 shadow-2xl backdrop-blur-xl max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">NH-334 DPR Executive Dashboard</h2>
            <p className="text-sm text-cyan-400 font-mono mt-1 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Hydrating Dashboard...
            </p>
            <p className="text-xs text-slate-500 mt-2 font-mono">
              Checking IndexedDB cache & corridor models
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* 1. Global Persistent 3-Tier Top Command Header & Unified Filter Sync */}
      <TopHeader
        metadata={metadata}
        dataSource={dataSource}
        availableDates={availableDates}
        anomaliesCount={totalAnomaliesCount}
        onReload={handleReload}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExport={handleExportFullReport}
        isLoading={isLoading}
      />

      {/* 1.5 Dedicated Module Separator & Engineering Status Rail (Single Authoritative Header) */}
      <ModuleSeparator
        filteredRowsCount={filteredRows.length}
        overallAdherence={kpis.overallAdherence}
      />

      {/* Main Content Workspace: Displays ONLY the Selected Module */}
      <main className="flex-1 px-4 lg:px-6 py-6 max-w-[1780px] w-full mx-auto space-y-6">
        
        {/* =========================================================================
            MODULE 1: PROJECT OVERVIEW (Only displayed when activeModule === 'overview')
        ========================================================================== */}
        {(activeModule === 'overview' || activeModule === 'all') && (
          <section
            id="module-overview"
            aria-label="Module 1: Project Overview"
            className="space-y-5 animate-fade-in"
          >
            {/* Project Overview & Schedule Milestone Module */}
            <ProjectOverviewModule
              milestones={milestones}
              sectionScopes={sectionScopes}
              consolidatedScope={consolidatedScope}
              cumulativeAchieved={cumulativeAchieved}
            />

            {/* Daily Quick Insight Timeline & Day Scrubber */}
            <DailyQuickInsight
              actualRows={actualRows}
              baseline={baseline}
              availableDates={availableDates}
              onSelectRow={row => setSelectedRow(row)}
            />
          </section>
        )}

        {/* =========================================================================
            MODULE 2: DAILY ANALYTICS (Only displayed when activeModule === 'analytics')
        ========================================================================== */}
        {(activeModule === 'analytics' || activeModule === 'all') && (
          <section
            id="module-analytics"
            aria-label="Module 2: Daily Analytics"
            className="space-y-5 animate-fade-in"
          >
            {/* Row 1: Physical Linear Progress & Chainage Length KPI Cards */}
            <LinearKPICards
              actualRows={actualRows}
              baseline={baseline}
              selectedActivities={filters.selectedActivities}
              side={filters.side}
              selectedDate={selectedDate}
              availableDates={availableDates}
              boqMetrics={boqMetrics}
              onDateChange={(d) => setSelectedSingleDate(d)}
              onActivitySelect={(act) => {
                if (act === 'All') {
                  selectAllActivities();
                } else {
                  toggleActivity(act, true);
                }
              }}
            />

            {/* Row 2: Volumetric KPI Summary Cards (BoQ Quantities & Material Volumes) */}
            <KPICards kpis={kpis} selectedActivities={filters.selectedActivities} />

            {/* Row 3: Daily Execution Visuals (Daily Planned vs Actual MT & Cumulative Execution S-Curve To-Date) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="min-h-[380px]">
                <PlannedVsActualChart
                  data={dailyComparisons}
                  selectedActivities={filters.selectedActivities}
                />
              </div>
              <div className="min-h-[380px]">
                <SCurveActualChart
                  actualRows={filteredRows}
                  milestones={milestones}
                  baseline={baseline}
                  cumulativeAchieved={cumulativeAchieved}
                  dailyComparisons={dailyComparisons}
                  availableDates={availableDates}
                />
              </div>
            </div>

            {/* Row 4: Executive Scope & Carriageway Comparison Visuals */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="min-h-[380px]">
                <ActivityCompletionBalance
                  actualRows={cumulativeRows}
                  baseline={baseline}
                  selectedActivities={filters.selectedActivities}
                  side={filters.side}
                />
              </div>
              <div className="min-h-[380px]">
                <LHSRHSProgressComparison
                  actualRows={cumulativeRows}
                  baseline={baseline}
                  selectedActivities={filters.selectedActivities}
                  globalSide={filters.side}
                />
              </div>
            </div>

            {/* Row 5: Long-Term Contractual Baseline S-Curve & Trendline Pace Forecast */}
            <div className="w-full min-h-[380px]">
              <SCurveForecastChart
                actualRows={filteredRows}
                milestones={milestones}
                baseline={baseline}
                cumulativeAchieved={cumulativeAchieved}
              />
            </div>
          </section>
        )}

        {/* =========================================================================
            MODULE 3: SPATIAL & STRIP MAP (Only displayed when activeModule === 'spatial')
        ========================================================================== */}
        {(activeModule === 'spatial' || activeModule === 'all') && (
          <section
            id="module-spatial"
            aria-label="Module 3: Spatial & Strip Map"
            className="space-y-6 animate-fade-in"
          >
            {/* 1. Master Linear Highway Progression Strip Chart (Strictly ON TOP) */}
            <LinearChainageStrip
              rows={filteredRows}
              minChainage={filters.chainageBounds.from}
              maxChainage={filters.chainageBounds.to}
              baseline={baseline}
              selectedActivities={filters.selectedActivities}
              onSelectRow={row => setSelectedRow(row)}
              plannedRecords={plannedRecords}
              reportDate={filters.selectedSingleDate || filters.dateRange.end || metadata.reportDate || '23.10.2026'}
              onSelectChainage={chM => setMapSelectedChainage(chM)}
              targetChainageM={stripTargetChainage}
              onStripDatasetLoaded={ds => setSharedStripDataset(ds)}
            />

            {/* 2. NH-334 Geographical GIS & Highway Digital Twin (Directly BELOW on same page) */}
            <GeographicalGISModule
              actualRows={filteredRows}
              plannedRecords={plannedRecords}
              stripDataset={sharedStripDataset}
              selectedChainageM={mapSelectedChainage}
              onSelectChainage={chM => {
                setMapSelectedChainage(chM);
                setStripTargetChainage(chM);
              }}
              onHighlightStripChart={chM => {
                setStripTargetChainage(chM);
              }}
              availableDates={availableDates}
              qcLogs={qcLogs}
              selectedRow={selectedRow}
              onSelectRow={row => setSelectedRow(row)}
            />
          </section>
        )}

        {/* =========================================================================
            MODULE 4: CHAINAGE LOGS & DPR (Only displayed when activeModule === 'logs')
        ========================================================================== */}
        {(activeModule === 'logs' || activeModule === 'all') && (
          <section
            id="module-logs"
            aria-label="Module 4: Chainage Logs & DPR"
            className="space-y-5 animate-fade-in"
          >
            {/* Searchable DPR Chainage Data Grid with Anomaly Alerts & CSV Export */}
            <DPRDataTable
              rows={filteredRows}
              selectedRowId={selectedRow?.id}
              onSelectRow={row => setSelectedRow(row)}
            />
          </section>
        )}
      </main>

      {/* Executive Footer */}
      <footer className="px-6 py-4 border-t border-white/[0.06] bg-[#0B0C0E] text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3 mt-8">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Muzaffarnagar - Haridwar Section, NH-334 (Ch. 130+560KM to 206+220KM)</span>
          <span>•</span>
          <span>Chainage Ch. 130+560 to Km 206+220 BHS</span>
          <span>•</span>
          <span className="text-cyan-400 font-mono">DPR #{metadata.dprNo} ({metadata.reportDate})</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>PMC: {metadata.pmc}</span>
          <span>•</span>
          <span>Concessionaire: {metadata.concessionaire}</span>
          <span>•</span>
          <span className="text-emerald-400">System Status: Operational</span>
        </div>
      </footer>

      {/* Dual Excel Uploader Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDone={() => {
          showToast('Dashboard synchronized with latest uploaded workbooks', 'success');
        }}
        uploadMeta={uploadMeta}
        onPlannedUpdate={handlePlannedUpdate}
        onActualUpdate={handleActualUpdate}
      />

      {/* Quality Control Modal */}
      <QCRegisterModal
        isOpen={isQCOpen}
        onClose={() => setIsQCOpen(false)}
        logs={qcLogs}
      />

      {/* Executive Summary Modal */}
      <ExecutiveSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        metadata={metadata}
        kpis={kpis}
      />

      {/* Floating Action Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#16181D] border border-cyan-500/40 text-cyan-300 shadow-2xl shadow-black/80 font-mono text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <FilterProvider>
      <DashboardContent />
    </FilterProvider>
  );
}

export default App;
