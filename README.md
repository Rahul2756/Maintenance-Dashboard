# NH-334 Highway Maintenance DPR Executive Dashboard
### Muzaffarnagar – Haridwar Section (Roorkee to Haridwar, Ch. 130+560 to Km 206+220 BHS)

Executive Daily Progress Report (DPR) monitoring platform built with React 18, TypeScript, Tailwind CSS, Lucide icons, and ECharts / Recharts.

---

## 🌟 Key Architecture & Features

### 1. "Vaulto" Matte Obsidian Executive Design System
- **Base Background**: Deep matte obsidian `#0B0C0E` / `#121316`
- **Glassmorphic Cards**: `rgba(22, 24, 29, 0.85)` with `backdrop-blur-md` and subtle borders `border-white/5`
- **Typography**: Inter with JetBrains Mono / tabular figures for all chainages, measurements, and timestamps
- **Color Indicators**:
  - 🟢 **Emerald**: Standard tolerance, milestone completion, targets met
  - 🟡 **Amber**: Pacing warnings, lateral offset deviations (4m to 5.3m)
  - 🔴 **Crimson**: Critical anomalies, excess milling depth (>50mm up to 90mm)
  - 🔵 **Cyan**: Milling & pavement surfacing

### 2. High-Precision Excel Ingestion & Normalization
- **Chainage Normalization**: Automatic `/ 1000` conversion of raw integers (e.g. `189230` ➔ `189.230 km` / `Ch. 189+230`)
- **Planned Work Program**: Ingestion of `Work Program.xlsx` ('MCW -Milling & DBM (BHS)')
- **Actual DPR Execution**: Ingestion of `Major_Maintenance_Daily_Progress_Report.23.10.2026.xlsx` ('Chainage Progress', 'Daily DPR', 'QC Test Log')
- **Automatic Fallback Engine**: If Excel files are offline or relocated, the dashboard seamlessly boots with built-in NH-334 high-fidelity corridor data (14.10.2026 – 23.10.2026)

### 3. Dashboard Visual Layout
1. **Global Header & Unified Filter Bar**: Side toggle (`LHS`, `RHS`, `ALL`), Activity multi-select (`Milling`, `Tackcoat`, `DBM`), Date Range selector, Chainage bounds (`189.230` to `204.000 km`), Anomaly Filter, and Excel reload/upload triggers.
2. **KPI Summary Cards (Row 1)**:
   - **Milling Progress**: 34,117.1 Sqm achieved vs benchmark, variance sparkline
   - **Tackcoat Progress**: 28,813.6 Sqm achieved vs benchmark, sync rate
   - **DBM Volume**: 1,451.25 Cum achieved (3,454 MT @ 2.38 density)
   - **Schedule Adherence Gauge**: Circular radial progress with daily execution pace index
3. **Advanced Visuals Grid (Row 2 - 2 Columns)**:
   - **Planned vs Actual Progress**: Grouped bars with target adherence spline line and activity switcher (Combined / Milling / Tackcoat / DBM)
   - **Depth Variance & Anomaly Scatter**: Highway chainage (x) vs Executed depth/width (y) bubble plot with highlighted anomalies (>50mm depth & offsets)
4. **Linear Chainage Progression Strip Map (Row 3)**:
   - Gantt-style 1D spatial highway corridor track (189.000 to 204.000 km)
   - 3 stacked physical lanes for Milling, Tackcoat, and DBM
   - Segment hover tooltips with exact chainage spans and glowing anomaly callout pins
5. **Detailed DPR Logs & Anomaly Data Grid (Row 4)**:
   - Searchable, sortable, paginated data table
   - Strict 3-decimal chainage notation (`189.230 km` and `Ch. 189+230`)
   - Anomaly badges for excess depth (>50mm) and width offsets
   - Instant CSV export of filtered data

---

## 🚀 Quick Start

From the root directory or inside `nh334-dpr-dashboard`:

```bash
# Start local development server
npm run dev

# Or from root:
npm --prefix nh334-dpr-dashboard run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
```
Builds cleanly with zero TypeScript errors into `nh334-dpr-dashboard/dist`.
