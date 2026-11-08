import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ActualDPRRow,
  PlannedRecord,
  HighwaySide,
  ActivityType,
  QCTestLogItem,
  DashboardFilters
} from '../../types/dpr';
import { formatChainagePlus, formatChainageKm, normalizeChainage } from '../../utils/excelParser';
import {
  Compass,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Truck,
  Flame,
  Rocket,
  ShieldCheck,
  ChevronRight,
  X,
  Gauge,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';

export type ViewMode = 'Overall' | 'Activity' | 'Planned' | 'Actual' | 'Delayed' | 'Remaining';
export type CameraMode = '3D' | 'Plan' | 'Driver';

export interface Highway3DDigitalTwinProps {
  actualRows: ActualDPRRow[];
  plannedRecords: PlannedRecord[];
  selectedRow: ActualDPRRow | null;
  onSelectRow: (row: ActualDPRRow | null) => void;
  minChainage?: number;
  maxChainage?: number;
  availableDates: string[];
  qcLogs?: QCTestLogItem[];
  globalFilters?: DashboardFilters;
  onFilterChange?: (filters: DashboardFilters) => void;
}

// Normalized internal road segment for 3D modeling
interface RoadSegmentData {
  id: string;
  fromChainage: number; // e.g. 189.500
  toChainage: number;   // e.g. 190.220
  lengthM: number;
  side: HighwaySide;
  lane: string;
  date: string;
  activity: ActivityType;
  primaryRow: ActualDPRRow;
  allRowsAtChainage: ActualDPRRow[];
  plannedRecord?: PlannedRecord;
  achievedQty: number;
  plannedQty: number;
  remainingQty: number;
  unit: string;
  progressPercent: number;
  widthM: number;
  depthM: number | null;
  depthMm?: number;
  isAnomaly: boolean;
  anomalyDescription: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'not_started';
  // 3D placement coordinates
  startX: number;
  endX: number;
  centerZ: number;
  widthZ: number;
}

interface ProjectedMarker {
  id: string;
  chainage: number;
  label: string;
  type: 'major' | 'intermediate' | 'selected' | 'anomaly';
  x: number; // screen pixel X
  y: number; // screen pixel Y
  worldX: number;
  worldZ: number;
  visible: boolean;
}

export const Highway3DDigitalTwin: React.FC<Highway3DDigitalTwinProps> = ({
  actualRows,
  plannedRecords,
  selectedRow,
  onSelectRow,
  minChainage = 189.230,
  maxChainage = 204.000,
  availableDates,
  qcLogs = [],
  globalFilters,
  onFilterChange
}) => {
  // Container & Canvas references
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Highway Meshes tracking
  const segmentMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const selectionBoxMeshRef = useRef<THREE.LineSegments | null>(null);
  const selectionPinMeshRef = useRef<THREE.Group | null>(null);

  // Coordinate scaling: 1 km = 100 Three.js units (1m = 0.1 units)
  const SCALE_PER_KM = 100;
  const corridorLengthKm = maxChainage - minChainage || 15;
  const corridorLengthWorld = corridorLengthKm * SCALE_PER_KM;

  const kmToWorldX = useCallback((km: number) => {
    return (km - minChainage) * SCALE_PER_KM - corridorLengthWorld / 2;
  }, [minChainage, corridorLengthWorld]);

  const worldXToKm = useCallback((worldX: number) => {
    return minChainage + (worldX + corridorLengthWorld / 2) / SCALE_PER_KM;
  }, [minChainage, corridorLengthWorld]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('Overall');
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<'ALL' | ActivityType>('ALL');
  const [cameraMode, setCameraMode] = useState<CameraMode>('3D');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFlyoverActive, setIsFlyoverActive] = useState(false);
  const flyoverProgressRef = useRef(0);
  const [flyoverSpeed, setFlyoverSpeed] = useState(1);

  // Driver mode state
  const driverPositionRef = useRef(kmToWorldX(189.500));
  const [driverChainage, setDriverChainage] = useState(189.500);

  // Search input state
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Hover and selection state
  const [hoveredSegment, setHoveredSegment] = useState<RoadSegmentData | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentData | null>(null);
  const [inspectorActiveActivity, setInspectorActiveActivity] = useState<ActivityType>('Milling');

  // Chainage Tour Playback state (moves slowly from starting chainage to ending chainage)
  const [currentTourChainage, setCurrentTourChainage] = useState<number>(minChainage);
  const currentTourChainageRef = useRef<number>(minChainage);
  const [isPlayingChainageTour, setIsPlayingChainageTour] = useState<boolean>(false);
  const isPlayingChainageTourRef = useRef<boolean>(false);
  const [chainageTourSpeed, setChainageTourSpeed] = useState<number>(1); // 1x, 1.5x, 2x, 2.5x, 3x
  const chainageTourSpeedRef = useRef<number>(1);

  // Sync refs when state changes
  useEffect(() => {
    isPlayingChainageTourRef.current = isPlayingChainageTour;
  }, [isPlayingChainageTour]);

  useEffect(() => {
    chainageTourSpeedRef.current = chainageTourSpeed;
  }, [chainageTourSpeed]);

  // Screen-space projected markers for large, ultra-clear labels
  const [projectedMarkers, setProjectedMarkers] = useState<ProjectedMarker[]>([]);

  // Current active date (all DPR execution data up to latest reporting date)
  const activeTimelineDate = availableDates[availableDates.length - 1] || '01.11.2026';

  // Helper date comparator
  const isDateOnOrBefore = (targetDate: string, comparisonDate: string) => {
    if (!targetDate || !comparisonDate) return true;
    const [td, tm, ty] = targetDate.split('.').map(Number);
    const [cd, cm, cy] = comparisonDate.split('.').map(Number);
    const tTime = new Date(ty, tm - 1, td).getTime();
    const cTime = new Date(cy, cm - 1, cd).getTime();
    return tTime <= cTime;
  };

  // 1. Process Raw DPR and Planned Records into 3D Segments
  const roadSegments: RoadSegmentData[] = useMemo(() => {
    const list: RoadSegmentData[] = [];
    const map = new Map<string, ActualDPRRow[]>();

    // Group actual rows by chainage span
    actualRows.forEach(row => {
      const key = `${row.fromChainage.toFixed(3)}-${row.toChainage.toFixed(3)}-${row.side}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });

    map.forEach((rowsAtSpan) => {
      const primary = rowsAtSpan[0];
      const fromKm = Math.min(primary.fromChainage, primary.toChainage);
      const toKm = Math.max(primary.fromChainage, primary.toChainage);

      // Find matching planned record if exists
      const planned = plannedRecords.find(
        p => Math.abs(p.chainageFrom - fromKm) < 0.2 || Math.abs(p.chainageTo - toKm) < 0.2
      );

      // Check anomalies
      const hasAnomaly = rowsAtSpan.some(r => r.isAnomaly);
      const anomalyDesc = rowsAtSpan.find(r => r.isAnomaly)?.remarks || 
                          rowsAtSpan.find(r => r.isAnomaly)?.anomalyDescription || '';

      // Determine lane placement on road (Z axis)
      // Carriageway layout:
      // LHS Fast Lane (F/L): Z = -2.75, width = 3.5m
      // LHS Slow Lane (S/L): Z = -6.25, width = 3.5m
      // LHS Both Lanes (F/L & S/L): Z = -4.5, width = 7.0m
      let centerZ = -2.75;
      let widthZ = 3.5;
      const laneStr = (primary.lane || '').toUpperCase();
      if (laneStr.includes('F/L') && laneStr.includes('S/L')) {
        centerZ = -4.5;
        widthZ = 7.0;
      } else if (laneStr.includes('S/L')) {
        centerZ = -6.25;
        widthZ = 3.5;
      } else {
        centerZ = -2.75;
        widthZ = 3.5;
      }

      // If RHS
      if (primary.side === 'RHS') {
        centerZ = Math.abs(centerZ);
      }

      // Calculate execution status
      const plannedSum = rowsAtSpan.reduce((sum, r) => sum + (r.plannedToday || 0), 0) || 
                         (planned ? planned.millingAreaSqm : 1000);
      const achievedSum = rowsAtSpan.reduce((sum, r) => sum + r.achievedToday, 0);
      const remainingSum = Math.max(0, plannedSum - achievedSum);
      const progressPct = plannedSum > 0 ? Math.min(100, Math.round((achievedSum / plannedSum) * 100)) : 100;

      let status: 'completed' | 'in_progress' | 'delayed' | 'planned' | 'not_started' = 'in_progress';
      if (progressPct >= 99) status = 'completed';
      else if (progressPct > 0) status = 'in_progress';
      else status = 'not_started';

      list.push({
        id: primary.id || `${fromKm}-${toKm}`,
        fromChainage: fromKm,
        toChainage: toKm,
        lengthM: primary.lengthM || Math.round((toKm - fromKm) * 1000),
        side: primary.side,
        lane: primary.lane || 'F/L',
        date: primary.date,
        activity: primary.activity,
        primaryRow: primary,
        allRowsAtChainage: rowsAtSpan,
        plannedRecord: planned,
        achievedQty: achievedSum,
        plannedQty: plannedSum,
        remainingQty: remainingSum,
        unit: primary.unit,
        progressPercent: progressPct,
        widthM: primary.widthM || 3.5,
        depthM: primary.depthM,
        depthMm: primary.depthMm,
        isAnomaly: hasAnomaly,
        anomalyDescription: anomalyDesc,
        status,
        startX: kmToWorldX(fromKm),
        endX: kmToWorldX(toKm),
        centerZ,
        widthZ
      });
    });

    return list;
  }, [actualRows, plannedRecords, kmToWorldX]);

  // Sync selectedSegment when external selectedRow prop changes
  useEffect(() => {
    if (selectedRow) {
      const match = roadSegments.find(
        s => s.fromChainage <= selectedRow.fromChainage && s.toChainage >= selectedRow.toChainage
      ) || roadSegments.find(s => s.id === selectedRow.id);

      if (match) {
        setSelectedSegment(match);
        setInspectorActiveActivity(selectedRow.activity);
        // Smoothly focus camera towards this chainage
        smoothFlyToChainage((match.fromChainage + match.toChainage) / 2);
      }
    }
  }, [selectedRow, roadSegments]);

  // Color evaluation function based on ViewMode and timeline
  const getSegmentColor = useCallback((seg: RoadSegmentData) => {
    // Check if work was executed on or before the timeline scrub date
    const isExecutedByDate = isDateOnOrBefore(seg.date, activeTimelineDate);

    if (!isExecutedByDate) {
      // Historical view: not yet executed on this date
      return { color: 0x222630, emissive: 0x000000, opacity: 0.45 };
    }

    if (viewMode === 'Overall') {
      if (seg.isAnomaly) {
        return { color: 0xf43f5e, emissive: 0xbe123c, opacity: 0.95 }; // Glowing Crimson
      }
      if (seg.status === 'completed') {
        return { color: 0x10b981, emissive: 0x065f46, opacity: 0.95 }; // Emerald
      }
      if (seg.status === 'in_progress') {
        return { color: 0x06b6d4, emissive: 0x0e7490, opacity: 0.9 };  // Cyan
      }
      return { color: 0x3b82f6, emissive: 0x1d4ed8, opacity: 0.85 }; // Planned Blue
    }

    if (viewMode === 'Activity') {
      if (selectedActivityFilter !== 'ALL' && seg.activity !== selectedActivityFilter) {
        return { color: 0x1e2129, emissive: 0x000000, opacity: 0.25 }; // Dimmed out
      }
      if (seg.activity === 'Milling') {
        return { color: 0x00e5ff, emissive: 0x00838f, opacity: 0.95 }; // Vibrant Cyan
      }
      if (seg.activity === 'Tackcoat') {
        return { color: 0xf59e0b, emissive: 0xb45309, opacity: 0.95 }; // Amber
      }
      if (seg.activity === 'DBM') {
        return { color: 0x10b981, emissive: 0x047857, opacity: 0.95 }; // Emerald
      }
    }

    if (viewMode === 'Planned') {
      return { color: 0x3b82f6, emissive: 0x1e40af, opacity: 0.9 }; // Cobalt Blue
    }

    if (viewMode === 'Actual') {
      if (seg.isAnomaly) return { color: 0xf43f5e, emissive: 0x9f1239, opacity: 0.95 };
      return { color: 0x10b981, emissive: 0x065f46, opacity: 0.95 };
    }

    if (viewMode === 'Delayed') {
      // If planned completion was before active date but not completed
      const isDelayed = seg.progressPercent < 80;
      if (isDelayed) {
        return { color: 0xf97316, emissive: 0xc2410c, opacity: 0.95 }; // Warning Orange
      }
      return { color: 0x222630, emissive: 0x000000, opacity: 0.35 };
    }

    if (viewMode === 'Remaining') {
      if (seg.remainingQty > 0) {
        return { color: 0x8b5cf6, emissive: 0x5b21b6, opacity: 0.95 }; // Purple
      }
      return { color: 0x222630, emissive: 0x000000, opacity: 0.3 };
    }

    return { color: 0x10b981, emissive: 0x000000, opacity: 0.9 };
  }, [viewMode, selectedActivityFilter, activeTimelineDate]);

  // Smooth camera animation target helper
  const cameraTargetRef = useRef<{
    pos: THREE.Vector3;
    look: THREE.Vector3;
    alpha: number;
    active: boolean;
  }>({
    pos: new THREE.Vector3(-40, 32, 45),
    look: new THREE.Vector3(0, 0, 0),
    alpha: 0,
    active: false
  });

  const smoothFlyTo = (targetPos: THREE.Vector3, lookPos: THREE.Vector3) => {
    if (!cameraRef.current) return;
    cameraTargetRef.current = {
      pos: targetPos.clone(),
      look: lookPos.clone(),
      alpha: 0,
      active: true
    };
  };

  const smoothFlyToChainage = (km: number) => {
    const wx = kmToWorldX(km);
    if (cameraMode === 'Plan') {
      smoothFlyTo(new THREE.Vector3(wx, 85, 0), new THREE.Vector3(wx, 0, 0));
    } else if (cameraMode === 'Driver') {
      // Third Person Perspective (TPP): elevated 6.8m and pulled back 22m for wide corridor perspective
      smoothFlyTo(new THREE.Vector3(wx - 22, 6.8, -3.8), new THREE.Vector3(wx + 38, 1.2, -3.8));
    } else {
      // 3D Isometric View: spacious zoomed-out perspective
      smoothFlyTo(new THREE.Vector3(wx - 42, 30, 42), new THREE.Vector3(wx, 0, 0));
    }
  };

  // 2. Initialize Three.js Scene, Highway Geometry & Lighting
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c0e);
    scene.fog = new THREE.FogExp2(0x0b0c0e, 0.0012);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    camera.position.set(-50, 35, 55);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going underground
    controls.minDistance = 5;
    controls.maxDistance = 600;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // LIGHTING
    // Ambient soft fill
    const ambientLight = new THREE.AmbientLight(0xdde5ed, 0.75);
    scene.add(ambientLight);

    // Primary directional sunlight with shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(60, 110, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 500;
    const d = 300;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Subtle blue horizon light
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.4);
    scene.add(hemiLight);

    // --- HIGHWAY 3D MODELING ---

    // 1. Engineering Terrain Base Grid
    const gridHelper = new THREE.GridHelper(corridorLengthWorld + 100, 150, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.15;
    scene.add(gridHelper);

    // 2. Continuous Highway Embankment / Subbase
    const embankmentGeo = new THREE.BoxGeometry(corridorLengthWorld + 20, 0.4, 26);
    const embankmentMat = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.95,
      metalness: 0.1
    });
    const embankmentMesh = new THREE.Mesh(embankmentGeo, embankmentMat);
    embankmentMesh.position.set(0, -0.2, 0);
    embankmentMesh.receiveShadow = true;
    scene.add(embankmentMesh);

    // 3. Highway Asphalt Carriageways (LHS & RHS)
    // Left Carriageway (LHS) Main Bed: Z: -1.0 to -9.0 (width 8.0m)
    const lhsRoadGeo = new THREE.PlaneGeometry(corridorLengthWorld, 8.5);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.85,
      metalness: 0.15
    });
    const lhsRoadMesh = new THREE.Mesh(lhsRoadGeo, roadMat);
    lhsRoadMesh.rotation.x = -Math.PI / 2;
    lhsRoadMesh.position.set(0, 0.01, -5.25);
    lhsRoadMesh.receiveShadow = true;
    scene.add(lhsRoadMesh);

    // Right Carriageway (RHS) Main Bed: Z: +1.0 to +9.0
    const rhsRoadMesh = new THREE.Mesh(lhsRoadGeo, roadMat);
    rhsRoadMesh.rotation.x = -Math.PI / 2;
    rhsRoadMesh.position.set(0, 0.01, 5.25);
    rhsRoadMesh.receiveShadow = true;
    scene.add(rhsRoadMesh);

    // 4. Central Median Strip with Concrete Jersey Barriers
    // Median Curb
    const medianCurbGeo = new THREE.BoxGeometry(corridorLengthWorld, 0.25, 1.8);
    const medianCurbMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.9 });
    const medianCurb = new THREE.Mesh(medianCurbGeo, medianCurbMat);
    medianCurb.position.set(0, 0.1, 0);
    scene.add(medianCurb);

    // Concrete Jersey Barrier along median
    const barrierGeo = new THREE.BoxGeometry(corridorLengthWorld, 0.75, 0.45);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x333842,
      roughness: 0.7,
      metalness: 0.2
    });
    const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
    barrierMesh.position.set(0, 0.5, 0);
    barrierMesh.castShadow = true;
    scene.add(barrierMesh);

    // Yellow retro-reflective strip on barrier
    const reflectorGeo = new THREE.BoxGeometry(corridorLengthWorld, 0.08, 0.48);
    const reflectorMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const reflectorMesh = new THREE.Mesh(reflectorGeo, reflectorMat);
    reflectorMesh.position.set(0, 0.5, 0);
    scene.add(reflectorMesh);

    // 5. Road Markings
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    // Solid Edge Lines (LHS Inner, LHS Outer, RHS Inner, RHS Outer)
    const edgeLineGeo = new THREE.PlaneGeometry(corridorLengthWorld, 0.18);
    
    // LHS Inner edge (adjacent to median)
    const lhsInnerLine = new THREE.Mesh(edgeLineGeo, yellowLineMat);
    lhsInnerLine.rotation.x = -Math.PI / 2;
    lhsInnerLine.position.set(0, 0.02, -1.1);
    scene.add(lhsInnerLine);

    // LHS Outer edge (adjacent to shoulder)
    const lhsOuterLine = new THREE.Mesh(edgeLineGeo, lineMat);
    lhsOuterLine.rotation.x = -Math.PI / 2;
    lhsOuterLine.position.set(0, 0.02, -8.1);
    scene.add(lhsOuterLine);

    // RHS Inner edge
    const rhsInnerLine = new THREE.Mesh(edgeLineGeo, yellowLineMat);
    rhsInnerLine.rotation.x = -Math.PI / 2;
    rhsInnerLine.position.set(0, 0.02, 1.1);
    scene.add(rhsInnerLine);

    // RHS Outer edge
    const rhsOuterLine = new THREE.Mesh(edgeLineGeo, lineMat);
    rhsOuterLine.rotation.x = -Math.PI / 2;
    rhsOuterLine.position.set(0, 0.02, 8.1);
    scene.add(rhsOuterLine);

    // Dashed Lane Centerlines (F/L and S/L divider at Z = -4.6 and +4.6)
    // Create dashed lines using instanced or repeated segments (3m dash, 6m gap => 0.3u dash, 0.6u gap)
    const dashLength = 0.4;
    const dashGap = 0.6;
    const totalDashes = Math.floor(corridorLengthWorld / (dashLength + dashGap));
    const dashGeo = new THREE.PlaneGeometry(dashLength, 0.16);
    
    const dashInstancedLHS = new THREE.InstancedMesh(dashGeo, lineMat, totalDashes);
    const dashInstancedRHS = new THREE.InstancedMesh(dashGeo, lineMat, totalDashes);
    const matrix = new THREE.Matrix4();
    const startX = -corridorLengthWorld / 2;

    for (let i = 0; i < totalDashes; i++) {
      const x = startX + i * (dashLength + dashGap);
      // LHS Lane Divider
      matrix.makeRotationX(-Math.PI / 2);
      matrix.setPosition(x, 0.025, -4.6);
      dashInstancedLHS.setMatrixAt(i, matrix);

      // RHS Lane Divider
      matrix.setPosition(x, 0.025, 4.6);
      dashInstancedRHS.setMatrixAt(i, matrix);
    }
    scene.add(dashInstancedLHS);
    scene.add(dashInstancedRHS);

    // 6. Outer Steel Guardrails (W-Beam Crash Barrier on LHS & RHS shoulders)
    const guardrailGeo = new THREE.BoxGeometry(corridorLengthWorld, 0.35, 0.15);
    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3
    });
    const lhsGuardrail = new THREE.Mesh(guardrailGeo, guardrailMat);
    lhsGuardrail.position.set(0, 0.6, -9.6);
    scene.add(lhsGuardrail);

    const rhsGuardrail = new THREE.Mesh(guardrailGeo, guardrailMat);
    rhsGuardrail.position.set(0, 0.6, 9.6);
    scene.add(rhsGuardrail);

    // 7. Selection Highlight Box & Pin
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    const selectionBox = new THREE.LineSegments(boxEdges, boxLineMat);
    selectionBox.visible = false;
    scene.add(selectionBox);
    selectionBoxMeshRef.current = selectionBox;

    // Glowing selection pin above selected road section
    const pinGroup = new THREE.Group();
    const pinConeGeo = new THREE.ConeGeometry(0.8, 1.8, 16);
    pinConeGeo.rotateX(Math.PI);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const pinMesh = new THREE.Mesh(pinConeGeo, pinMat);
    pinGroup.add(pinMesh);
    pinGroup.visible = false;
    scene.add(pinGroup);
    selectionPinMeshRef.current = pinGroup;

    // RESIZE HANDLER
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // CLEANUP ON UNMOUNT
    return () => {
      resizeObserver.disconnect();
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
      scene.clear();
    };
  }, [corridorLengthWorld]);

  // 3. Render and Update Dynamic Road Segments into Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous segment meshes
    segmentMeshesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    segmentMeshesRef.current.clear();

    // Build 3D mesh for each segment
    roadSegments.forEach(seg => {
      const length = Math.max(0.4, Math.abs(seg.endX - seg.startX));
      const centerX = (seg.startX + seg.endX) / 2;

      // Realistic 3D lift: DBM is raised +0.07m above asphalt; Milling is grooved; Tackcoat is intermediate
      let layerHeight = 0.06;
      let posY = 0.04;
      if (seg.activity === 'DBM') {
        layerHeight = 0.08;
        posY = 0.05;
      } else if (seg.activity === 'Milling') {
        layerHeight = 0.04;
        posY = 0.025;
      }

      const geo = new THREE.BoxGeometry(length, layerHeight, seg.widthZ);
      const style = getSegmentColor(seg);

      const mat = new THREE.MeshStandardMaterial({
        color: style.color,
        emissive: style.emissive,
        emissiveIntensity: seg.isAnomaly ? 0.6 : 0.25,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: style.opacity
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(centerX, posY, seg.centerZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { segmentData: seg };

      scene.add(mesh);
      segmentMeshesRef.current.set(seg.id, mesh);
    });
  }, [roadSegments, getSegmentColor]);

  // 4. Update Selection Visuals in 3D (Box highlight & Marker pin)
  useEffect(() => {
    const selectionBox = selectionBoxMeshRef.current;
    const pinGroup = selectionPinMeshRef.current;

    if (!selectedSegment) {
      if (selectionBox) selectionBox.visible = false;
      if (pinGroup) pinGroup.visible = false;
      return;
    }

    const length = Math.max(0.6, Math.abs(selectedSegment.endX - selectedSegment.startX));
    const centerX = (selectedSegment.startX + selectedSegment.endX) / 2;

    if (selectionBox) {
      selectionBox.visible = true;
      selectionBox.scale.set(length + 0.3, 0.25, selectedSegment.widthZ + 0.3);
      selectionBox.position.set(centerX, 0.12, selectedSegment.centerZ);
    }

    if (pinGroup) {
      pinGroup.visible = true;
      pinGroup.position.set(centerX, 3.2, selectedSegment.centerZ);
    }
  }, [selectedSegment]);

  // 5. Raycasting for Clicking and Hovering Road Segments
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // On clicking anywhere on the road scene, pause the chainage tour!
    if (isPlayingChainageTourRef.current) {
      setIsPlayingChainageTour(false);
      isPlayingChainageTourRef.current = false;
    }

    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!canvas || !camera || !scene) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const meshes = Array.from(segmentMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const seg: RoadSegmentData = hit.object.userData.segmentData;
      if (seg) {
        setSelectedSegment(seg);
        setInspectorActiveActivity(seg.activity);
        if (onSelectRow) onSelectRow(seg.primaryRow);
      }
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const meshes = Array.from(segmentMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const seg: RoadSegmentData = intersects[0].object.userData.segmentData;
      setHoveredSegment(seg);
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredSegment(null);
      canvas.style.cursor = 'default';
    }
  };

  // 6. MAIN ANIMATION LOOP (With Smooth Camera, Flyover Tour, Driver Mode & Screen-Space Labels)
  useEffect(() => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    if (!canvas || !camera || !renderer || !scene || !controls) return;

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // 1. Smooth Camera Fly-To Interpolation
      if (cameraTargetRef.current.active) {
        cameraTargetRef.current.alpha += deltaTime * 2.5;
        const t = Math.min(1, cameraTargetRef.current.alpha);
        const easeT = 0.5 - 0.5 * Math.cos(t * Math.PI); // ease-in-out

        camera.position.lerp(cameraTargetRef.current.pos, 0.12);
        controls.target.lerp(cameraTargetRef.current.look, 0.12);

        if (t >= 0.99) {
          cameraTargetRef.current.active = false;
        }
      }

      // 2. Cinematic Flyover Tour Animation
      if (isFlyoverActive) {
        flyoverProgressRef.current += deltaTime * 0.04 * flyoverSpeed;
        if (flyoverProgressRef.current > 1) flyoverProgressRef.current = 0;

        const currentKm = minChainage + flyoverProgressRef.current * corridorLengthKm;
        const wx = kmToWorldX(currentKm);

        camera.position.set(wx - 25, 18, -12);
        controls.target.set(wx + 25, 1.5, -4);
      }

      // 2b. Chainage Playback Tour (Smooth continuous travel along highway corridor)
      if (isPlayingChainageTourRef.current) {
        // Base travel speed: ~0.16 km/sec at 1x
        const kmIncrement = deltaTime * 0.16 * chainageTourSpeedRef.current;
        let nextKm = currentTourChainageRef.current + kmIncrement;

        if (nextKm >= maxChainage) {
          nextKm = maxChainage;
          isPlayingChainageTourRef.current = false;
          setIsPlayingChainageTour(false);
        }

        currentTourChainageRef.current = nextKm;
        setCurrentTourChainage(nextKm);

        // Move camera and target synchronously along the highway
        const targetWorldX = kmToWorldX(nextKm);
        if (cameraMode === 'Plan') {
          controls.target.x = targetWorldX;
          camera.position.x = targetWorldX;
        } else if (cameraMode === 'Driver') {
          // TPP Chase View along highway
          controls.target.set(targetWorldX + 38, 1.2, -3.8);
          camera.position.set(targetWorldX - 22, 6.8, -3.8);
          setDriverChainage(nextKm);
        } else {
          // 3D View: shift camera and target smoothly along X while preserving view angle
          const currentCamOffsetX = camera.position.x - controls.target.x;
          controls.target.x = targetWorldX;
          camera.position.x = targetWorldX + (currentCamOffsetX !== 0 ? currentCamOffsetX : -42);
        }
      }

      // 3. Driver Mode Camera Logic (Third Person Perspective TPP)
      if (cameraMode === 'Driver' && !isPlayingChainageTourRef.current) {
        const wx = driverPositionRef.current;
        camera.position.set(wx - 22, 6.8, -3.8);
        controls.target.set(wx + 38, 1.2, -3.8);
      }

      // 4. Bobbing Selection Pin Animation
      if (selectionPinMeshRef.current && selectionPinMeshRef.current.visible) {
        selectionPinMeshRef.current.rotation.y += deltaTime * 2.0;
        selectionPinMeshRef.current.position.y = 3.2 + Math.sin(currentTime * 0.005) * 0.3;
      }

      controls.update();
      renderer.render(scene, camera);

      // 5. PROJECT 3D CHAINAGE MILESTONES TO SCREEN-SPACE BADGES
      // This guarantees crystal-clear, retina-sharp, large labels that never blur or overlap!
      const rect = canvas.getBoundingClientRect();
      const markersList: ProjectedMarker[] = [];
      const camPos = camera.position;

      // Generate Milestone Stations dynamically from real chainage data range
      const startKmInt = Math.floor(minChainage);
      const endKmInt = Math.ceil(maxChainage);

      // Determine Zoom Level & Distance to camera
      const cameraDistance = camera.position.y + Math.abs(camera.position.z);
      const isCloseZoom = cameraDistance < 40;
      const isMediumZoom = cameraDistance < 120;

      // Stations list: 1km stations, plus 500m / 200m if zoomed in
      const stations: { km: number; type: 'major' | 'intermediate' }[] = [];
      for (let k = startKmInt; k <= endKmInt; k++) {
        if (k >= minChainage && k <= maxChainage) {
          stations.push({ km: k, type: 'major' });
        }
        if (isMediumZoom && k + 0.5 <= maxChainage && k + 0.5 >= minChainage) {
          stations.push({ km: k + 0.5, type: 'intermediate' });
        }
        if (isCloseZoom) {
          if (k + 0.25 <= maxChainage && k + 0.25 >= minChainage) stations.push({ km: k + 0.25, type: 'intermediate' });
          if (k + 0.75 <= maxChainage && k + 0.75 >= minChainage) stations.push({ km: k + 0.75, type: 'intermediate' });
        }
      }

      // Add selected section marker if present
      if (selectedSegment) {
        stations.push({ km: selectedSegment.fromChainage, type: 'major' });
        stations.push({ km: selectedSegment.toChainage, type: 'major' });
      }

      // Project each station into screen pixel coordinates
      const tempVec = new THREE.Vector3();
      const screenMarkers: ProjectedMarker[] = [];

      stations.forEach((st, idx) => {
        const wx = kmToWorldX(st.km);
        const wz = -8.5; // Along LHS outer shoulder board line

        tempVec.set(wx, 1.2, wz);
        // Distance check from camera to avoid rendering behind camera
        const distToCam = camPos.distanceTo(tempVec);
        if (distToCam > 350) return;

        tempVec.project(camera);

        // Check if inside normalized device coordinates [-1, 1]
        if (tempVec.z < 1 && tempVec.x >= -1.1 && tempVec.x <= 1.1 && tempVec.y >= -1.1 && tempVec.y <= 1.1) {
          const screenX = ((tempVec.x + 1) / 2) * rect.width;
          const screenY = ((-tempVec.y + 1) / 2) * rect.height;

          screenMarkers.push({
            id: `marker-${st.km}-${idx}`,
            chainage: st.km,
            label: formatChainagePlus(st.km),
            type: selectedSegment && (st.km === selectedSegment.fromChainage || st.km === selectedSegment.toChainage)
              ? 'selected'
              : st.type,
            x: screenX,
            y: screenY,
            worldX: wx,
            worldZ: wz,
            visible: true
          });
        }
      });

      // Intelligent Label Density / Collision Prevention:
      // Sort screen markers by X coordinate and prune overlaps (ensure at least 70px separation)
      screenMarkers.sort((a, b) => a.x - b.x);
      const filteredMarkers: ProjectedMarker[] = [];
      let lastX = -999;

      screenMarkers.forEach(m => {
        // Selected marker always takes priority
        if (m.type === 'selected') {
          filteredMarkers.push(m);
          lastX = m.x;
          return;
        }

        if (m.x - lastX > 75) {
          filteredMarkers.push(m);
          lastX = m.x;
        }
      });

      setProjectedMarkers(filteredMarkers);

      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [
    isFlyoverActive,
    flyoverSpeed,
    cameraMode,
    minChainage,
    maxChainage,
    corridorLengthKm,
    kmToWorldX,
    selectedSegment
  ]);

  // 7. Chainage Search & Navigation Handler
  const searchToChainage = (queryStr: string) => {
    setSearchError(null);

    const query = queryStr.trim();
    if (!query) return;

    // Normalize chainage input (supports '193+000', '193+250', '193.25', '193250', '193')
    let targetKm = 0;
    if (query.includes('+')) {
      const parts = query.split('+');
      const km = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const m = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      targetKm = km + m / 1000;
    } else {
      const rawNum = parseFloat(query.replace(/[^0-9.]/g, ''));
      if (isNaN(rawNum)) {
        setSearchError('Please enter a valid chainage (e.g. 193+000 or 193.5)');
        return;
      }
      targetKm = normalizeChainage(rawNum);
    }

    // Corridor range check
    if (targetKm < minChainage - 0.5 || targetKm > maxChainage + 0.5) {
      setSearchError(
        `Ch. ${formatChainagePlus(targetKm)} is outside current corridor (${minChainage.toFixed(3)} to ${maxChainage.toFixed(3)} km)`
      );
      return;
    }

    // Find matching road segment
    const found = roadSegments.find(
      s => targetKm >= s.fromChainage && targetKm <= s.toChainage
    ) || roadSegments.reduce((closest, curr) => {
      const currDist = Math.abs((curr.fromChainage + curr.toChainage) / 2 - targetKm);
      const closestDist = Math.abs((closest.fromChainage + closest.toChainage) / 2 - targetKm);
      return currDist < closestDist ? curr : closest;
    }, roadSegments[0]);

    if (found) {
      setSelectedSegment(found);
      setInspectorActiveActivity(found.activity);
      if (onSelectRow) onSelectRow(found.primaryRow);
      smoothFlyToChainage(targetKm);
    }
  };

  const handleSearchGo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    searchToChainage(searchInput);
  };

  // 8. Camera Mode Toggles
  const setCameraViewMode = (mode: CameraMode) => {
    setCameraMode(mode);
    setIsFlyoverActive(false);

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (mode === 'Plan') {
      // Top-Down 90 degree plan view (like engineering GIS strip)
      const currentTargetX = controls.target.x;
      smoothFlyTo(new THREE.Vector3(currentTargetX, 85, 0), new THREE.Vector3(currentTargetX, 0, 0));
    } else if (mode === '3D') {
      // Perspective isometric highway view - spacious zoomed-out perspective
      const currentTargetX = controls.target.x;
      smoothFlyTo(
        new THREE.Vector3(currentTargetX - 42, 30, 42),
        new THREE.Vector3(currentTargetX, 0, 0)
      );
    } else if (mode === 'Driver') {
      // Third Person Perspective (TPP) elevated chase view
      const currentTargetX = controls.target.x;
      driverPositionRef.current = currentTargetX;
      setDriverChainage(worldXToKm(currentTargetX));
      smoothFlyTo(
        new THREE.Vector3(currentTargetX - 22, 6.8, -3.8),
        new THREE.Vector3(currentTargetX + 38, 1.2, -3.8)
      );
    }
  };

  const handleResetCamera = () => {
    setIsFlyoverActive(false);
    setCameraMode('3D');
    const midKm = (minChainage + maxChainage) / 2;
    smoothFlyToChainage(midKm);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // 9. Chainage Playback & Navigation Handlers
  const jumpCameraToChainage = (km: number) => {
    const wx = kmToWorldX(km);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (cameraMode === 'Plan') {
      controls.target.x = wx;
      camera.position.x = wx;
    } else if (cameraMode === 'Driver') {
      // TPP Chase View
      controls.target.set(wx + 38, 1.2, -3.8);
      camera.position.set(wx - 22, 6.8, -3.8);
      setDriverChainage(km);
    } else {
      const offsetX = camera.position.x - controls.target.x;
      controls.target.x = wx;
      camera.position.x = wx + (offsetX !== 0 ? offsetX : -42);
    }
  };

  const handleToggleChainagePlay = () => {
    if (currentTourChainageRef.current >= maxChainage - 0.05) {
      // If at or near the end of corridor, reset back to starting chainage and start playing
      currentTourChainageRef.current = minChainage;
      setCurrentTourChainage(minChainage);
      jumpCameraToChainage(minChainage);
    }
    const nextState = !isPlayingChainageTour;
    setIsPlayingChainageTour(nextState);
    isPlayingChainageTourRef.current = nextState;
  };

  const handleChainageSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const km = Number(e.target.value);
    currentTourChainageRef.current = km;
    setCurrentTourChainage(km);
    jumpCameraToChainage(km);
  };

  const handleStepBackChainage = () => {
    const prevKm = Math.max(minChainage, currentTourChainageRef.current - 0.5);
    currentTourChainageRef.current = prevKm;
    setCurrentTourChainage(prevKm);
    jumpCameraToChainage(prevKm);
  };

  const handleStepForwardChainage = () => {
    const nextKm = Math.min(maxChainage, currentTourChainageRef.current + 0.5);
    currentTourChainageRef.current = nextKm;
    setCurrentTourChainage(nextKm);
    jumpCameraToChainage(nextKm);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl bg-[#0B0C0E] border border-white/[0.08] shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'min-h-[640px] h-[720px]'
      }`}
    >
      {/* =========================================================================
          TOP TOOLBAR: VIEW PILLS, ACTIVITIES, SEARCH & CAMERA MODES
          (Matching the user's design reference exactly)
      ========================================================================= */}
      <div className="z-20 bg-[#121418]/95 backdrop-blur-md border-b border-white/[0.08] p-3 px-4 flex flex-wrap items-center justify-between gap-3">
        {/* Row 1: VIEW Modes & Filter controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            VIEW
          </span>

          {/* VIEW Mode Pills */}
          <div className="flex items-center bg-[#181B22] p-1 rounded-xl border border-white/[0.06]">
            {(['Overall', 'Activity', 'Planned', 'Actual', 'Delayed', 'Remaining'] as ViewMode[]).map(mode => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          {/* Activity Dropdown */}
          <div className="relative">
            <select
              value={selectedActivityFilter}
              onChange={e => setSelectedActivityFilter(e.target.value as any)}
              className="bg-[#181B22] text-slate-200 text-xs rounded-xl px-3 py-1.5 border border-white/[0.1] hover:border-cyan-500/40 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Activities</option>
              <option value="Milling">Milling</option>
              <option value="Tackcoat">Tackcoat</option>
              <option value="DBM">DBM</option>
            </select>
          </div>

          {/* Chainage Search Box with Go Button */}
          <form onSubmit={handleSearchGo} className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Chainage (e.g. 193+000)"
                className="w-44 sm:w-52 bg-[#181B22] text-slate-200 text-xs rounded-xl px-3 py-1.5 pl-7 border border-white/[0.1] focus:outline-none focus:border-cyan-400 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 px-3 py-1.5 rounded-xl font-medium transition-all text-xs cursor-pointer flex items-center gap-1"
            >
              <span>Go</span>
              <span>→</span>
            </button>
          </form>

          {/* Search Error Toast */}
          {searchError && (
            <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1 bg-rose-950/40 border border-rose-500/30 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              {searchError}
            </span>
          )}
        </div>

        {/* Row 2: Camera Controls, Driver Mode, Flyover Tour & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* 3D View Toggle */}
          <button
            onClick={() => setCameraViewMode('3D')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              cameraMode === '3D' && !isFlyoverActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 glow-cyan'
                : 'bg-[#181B22] text-slate-300 border-white/[0.08] hover:bg-[#20242D]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>3D View</span>
          </button>

          {/* Plan View (Top-Down GIS strip) */}
          <button
            onClick={() => setCameraViewMode('Plan')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              cameraMode === 'Plan'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 glow-cyan'
                : 'bg-[#181B22] text-slate-300 border-white/[0.08] hover:bg-[#20242D]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plan</span>
          </button>

          {/* Driver (TPP View) Mode */}
          <button
            onClick={() => setCameraViewMode('Driver')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              cameraMode === 'Driver'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 glow-emerald'
                : 'bg-[#181B22] text-slate-300 border-white/[0.08] hover:bg-[#20242D]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Driver (TPP)</span>
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            title="Reset to default highway overview"
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#181B22] text-slate-300 border border-white/[0.08] hover:bg-[#20242D] hover:text-white transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Cinematic Flyover Tour */}
          <button
            onClick={() => {
              setIsFlyoverActive(prev => !prev);
              if (!isFlyoverActive) setCameraMode('3D');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              isFlyoverActive
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 glow-emerald animate-pulse'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>{isFlyoverActive ? 'Stop Tour' : 'Flyover Tour'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-xl text-slate-300 hover:text-white bg-[#181B22] border border-white/[0.08] hover:bg-[#20242D] cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN 3D HIGHWAY VIEWPORT & SECTION INSPECTOR WORKSPACE
      ========================================================================= */}
      <div className="flex-1 relative flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT / CENTER: Interactive 3D WebGL Canvas */}
        <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#090A0D] to-[#0F1116]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="w-full h-full block focus:outline-none"
          />

          {/* ---------------------------------------------------------------------
              CRITICAL: LARGE, ULTRA-CLEAR, DYNAMIC SCREEN-SPACE CHAINAGE LABELS
              (Projected directly from 3D coordinates into pixel-perfect HTML badges)
          --------------------------------------------------------------------- */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {projectedMarkers.map(m => {
              const isSelected = m.type === 'selected';
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'absolute',
                    left: `${m.x}px`,
                    top: `${m.y}px`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: isSelected ? 40 : 20
                  }}
                  className="pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110"
                  onClick={() => {
                    smoothFlyToChainage(m.chainage);
                  }}
                >
                  {/* Pin Leader Line down to road */}
                  <div className={`w-0.5 h-4 mx-auto ${isSelected ? 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]' : 'bg-amber-400/80'}`} />

                  {/* Marker Board */}
                  <div
                    className={`flex flex-col items-center rounded-lg border shadow-xl backdrop-blur-md px-2.5 py-1 ${
                      isSelected
                        ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/50 glow-cyan'
                        : 'bg-[#12141A]/95 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <MapPin className={`w-3 h-3 ${isSelected ? 'text-cyan-400 animate-bounce' : 'text-amber-400'}`} />
                      <span className="text-[12px] font-mono font-bold tracking-wider">
                        {m.label}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-mono font-semibold text-cyan-300 uppercase tracking-wider">
                        Selected Station
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Hover Indicator Tooltip */}
          {hoveredSegment && (
            <div className="absolute top-4 left-4 z-20 pointer-events-none bg-[#12141A]/95 border border-cyan-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-200 max-w-xs">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 mb-1.5">
                <span className="font-bold text-cyan-300">
                  {formatChainagePlus(hoveredSegment.fromChainage)} → {formatChainagePlus(hoveredSegment.toChainage)}
                </span>
                <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/5">
                  {hoveredSegment.lengthM}m
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                <div>Activity: <span className="text-white font-semibold">{hoveredSegment.activity}</span></div>
                <div>Lane: <span className="text-white">{hoveredSegment.lane}</span></div>
                <div>Date: <span className="text-white">{hoveredSegment.date}</span></div>
                <div>Progress: <span className="text-emerald-400 font-bold">{hoveredSegment.progressPercent}%</span></div>
              </div>
              {hoveredSegment.isAnomaly && (
                <div className="mt-1.5 text-rose-400 text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{hoveredSegment.anomalyDescription}</span>
                </div>
              )}
            </div>
          )}

          {/* Driver Cockpit HUD Overlay */}
          {cameraMode === 'Driver' && (
            <div className="absolute bottom-16 left-6 z-20 bg-[#12141A]/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3.5 shadow-2xl flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-emerald-400 animate-spin-slow" />
                <div>
                  <div className="text-[10px] text-slate-400">HIGHWAY STATION (TPP)</div>
                  <div className="text-sm font-bold text-emerald-300">
                    {formatChainagePlus(driverChainage)}
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextKm = Math.max(minChainage, driverChainage - 0.2);
                    setDriverChainage(nextKm);
                    const wx = kmToWorldX(nextKm);
                    driverPositionRef.current = wx;
                    if (cameraRef.current && controlsRef.current) {
                      controlsRef.current.target.set(wx + 38, 1.2, -3.8);
                      cameraRef.current.position.set(wx - 22, 6.8, -3.8);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  ◀ -200m
                </button>
                <button
                  onClick={() => {
                    const nextKm = Math.min(maxChainage, driverChainage + 0.2);
                    setDriverChainage(nextKm);
                    const wx = kmToWorldX(nextKm);
                    driverPositionRef.current = wx;
                    if (cameraRef.current && controlsRef.current) {
                      controlsRef.current.target.set(wx + 38, 1.2, -3.8);
                      cameraRef.current.position.set(wx - 22, 6.8, -3.8);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  +200m ▶
                </button>
              </div>
            </div>
          )}

          {/* View Mode Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-[#12141A]/85 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-slate-300 flex items-center gap-3">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 animate-pulse" />
              <span className="text-rose-300">Anomaly (&gt;50mm / Offset)</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT SIDE PANEL: HIGHWAY SECTION INSPECTOR
            (Matching the user's design reference exactly)
        ========================================================================= */}
        <div className="w-full lg:w-96 xl:w-[410px] shrink-0 bg-[#121418] border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg">
                <Truck className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                  Highway Section Inspector
                </h3>
                <p className="text-[11px] text-slate-400">
                  Physical parameters &amp; execution audit
                </p>
              </div>
            </div>
            {selectedSegment && (
              <button
                onClick={() => {
                  setSelectedSegment(null);
                  if (onSelectRow) onSelectRow(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Inspector Body Content */}
          <div className="p-4 flex-1 space-y-4">
            {!selectedSegment ? (
              /* Empty State matching the user prompt screenshot */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner">
                  <span className="text-3xl">🛣️</span>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold text-slate-200">
                    No Highway Section Selected
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                    Click any road segment in the 3D scene, search a chainage above, or select a row from the DPR table to inspect its physical parameters and audit history.
                  </p>
                </div>

                {/* Quick Jump Suggestions */}
                <div className="w-full pt-4 border-t border-white/[0.06] text-left space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Quick Corridor Jumps:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => { setSearchInput('189+230'); searchToChainage('189+230'); }}
                      className="p-2 rounded-xl bg-[#181B22] border border-white/[0.06] hover:border-cyan-500/40 text-left hover:bg-white/5 cursor-pointer"
                    >
                      <div className="text-cyan-300 font-mono font-bold">Ch. 189+230</div>
                      <div className="text-[10px] text-slate-400">Roorkee Bypass</div>
                    </button>
                    <button
                      onClick={() => { setSearchInput('190+220'); searchToChainage('190+220'); }}
                      className="p-2 rounded-xl bg-[#181B22] border border-white/[0.06] hover:border-cyan-500/40 text-left hover:bg-white/5 cursor-pointer"
                    >
                      <div className="text-emerald-300 font-mono font-bold">Ch. 190+220</div>
                      <div className="text-[10px] text-slate-400">DBM 126 Cum Span</div>
                    </button>
                    <button
                      onClick={() => { setSearchInput('201+250'); searchToChainage('201+250'); }}
                      className="p-2 rounded-xl bg-[#181B22] border border-rose-500/30 hover:border-rose-400 text-left hover:bg-rose-950/20 cursor-pointer"
                    >
                      <div className="text-rose-300 font-mono font-bold">Ch. 201+250 ⚠️</div>
                      <div className="text-[10px] text-slate-400">90mm Milling Depth</div>
                    </button>
                    <button
                      onClick={() => { setSearchInput('204+000'); searchToChainage('204+000'); }}
                      className="p-2 rounded-xl bg-[#181B22] border border-white/[0.06] hover:border-cyan-500/40 text-left hover:bg-white/5 cursor-pointer"
                    >
                      <div className="text-cyan-300 font-mono font-bold">Ch. 204+000</div>
                      <div className="text-[10px] text-slate-400">Haridwar Approach</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Selected Highway Section Details */
              <div className="space-y-4">
                {/* 1. Main Chainage Badge */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-[#181B22] to-blue-950/30 border border-cyan-500/30 shadow-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider">
                      Selected Section
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[11px]">
                      Span: {selectedSegment.lengthM} m
                    </span>
                  </div>
                  <div className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <span className="text-cyan-300">{formatChainagePlus(selectedSegment.fromChainage)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span className="text-cyan-300">{formatChainagePlus(selectedSegment.toChainage)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold text-[11px]">
                      {selectedSegment.side}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>Lane: <strong className="text-white">{selectedSegment.lane}</strong></span>
                    <span className="text-slate-400">•</span>
                    <span>Date: <strong className="text-white">{selectedSegment.date}</strong></span>
                  </div>
                </div>

                {/* 2. Activity Selector Tabs (Milling, Tackcoat, DBM) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Activity Layer:</span>
                    <span className="text-[11px] text-slate-400">
                      {selectedSegment.allRowsAtChainage.length} recorded layer(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#181B22] rounded-xl border border-white/[0.06]">
                    {(['Milling', 'Tackcoat', 'DBM'] as ActivityType[]).map(act => {
                      const exists = selectedSegment.allRowsAtChainage.some(r => r.activity === act);
                      const isTabActive = inspectorActiveActivity === act;
                      return (
                        <button
                          key={act}
                          disabled={!exists}
                          onClick={() => setInspectorActiveActivity(act)}
                          className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                            isTabActive
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                              : exists
                              ? 'text-slate-200 hover:bg-white/5'
                              : 'text-slate-600 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {act}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Physical Parameters & Execution Metrics */}
                {(() => {
                  const activeRow = selectedSegment.allRowsAtChainage.find(
                    r => r.activity === inspectorActiveActivity
                  ) || selectedSegment.primaryRow;

                  const planned = activeRow.plannedToday || 0;
                  const achieved = activeRow.achievedToday;
                  const remaining = Math.max(0, planned - achieved);
                  const pct = planned > 0 ? Math.min(100, Math.round((achieved / planned) * 100)) : 100;

                  return (
                    <div className="space-y-3">
                      {/* Metric 4-Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-[#181B22] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Planned Today</span>
                          <div className="text-sm font-bold text-white font-mono">
                            {planned > 0 ? `${planned} ${activeRow.unit}` : 'Per Program'}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#181B22] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase">Achieved Today</span>
                          <div className="text-sm font-bold text-emerald-300 font-mono">
                            {achieved} {activeRow.unit}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#181B22] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono text-amber-400 uppercase">Remaining Span</span>
                          <div className="text-sm font-bold text-amber-300 font-mono">
                            {remaining} {activeRow.unit}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#181B22] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">Adherence Pace</span>
                          <div className="text-sm font-bold text-cyan-300 font-mono">
                            {pct}%
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Layer Execution Progress</span>
                          <span className="text-white font-bold">{pct}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#181B22] rounded-full overflow-hidden border border-white/10">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* Engineering Dimensions */}
                      <div className="p-3 rounded-xl bg-[#16181F] border border-white/[0.06] text-xs space-y-2">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                          Cross-Section Dimensions
                        </span>
                        <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                          <div>Length: <strong className="text-white">{activeRow.lengthM}m</strong></div>
                          <div>Width: <strong className="text-white">{activeRow.widthM}m</strong></div>
                          <div>
                            Depth:{' '}
                            <strong className={activeRow.depthM && activeRow.depthM > 0.055 ? 'text-rose-400 font-bold' : 'text-white'}>
                              {activeRow.depthM ? `${Math.round(activeRow.depthM * 1000)}mm` : 'Standard'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Anomaly & QC Alert */}
                      {activeRow.isAnomaly && (
                        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs space-y-1.5 glow-crimson">
                          <div className="flex items-center gap-1.5 text-rose-300 font-bold font-mono">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>Quality / Geometric Anomaly</span>
                          </div>
                          <p className="text-[11px] text-rose-200 leading-relaxed">
                            {activeRow.remarks || activeRow.anomalyDescription}
                          </p>
                        </div>
                      )}

                      {/* Quality Register Cross-reference */}
                      <div className="p-3 rounded-xl bg-[#16181F] border border-white/[0.06] text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Quality Control &amp; Test Register</span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-mono">
                          MORTH Table 900-4 standards verified. Bitumen Extraction: 4.53% | GMM: 2.469 | Gradation: PASS
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => smoothFlyToChainage((selectedSegment.fromChainage + selectedSegment.toChainage) / 2)}
                          className="flex-1 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Zoom in 3D</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CHAINAGE CORRIDOR PLAYBACK BAR (Travels smoothly from Start to End)
      ========================================================================= */}
      <div className="z-20 bg-[#121418] border-t border-white/[0.08] p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Play/Pause & Step Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStepBackChainage}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Step Back -500m"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleChainagePlay}
              className={`p-1.5 px-3.5 rounded-xl flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                isPlayingChainageTour
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 glow-cyan'
              }`}
              title={isPlayingChainageTour ? 'Pause Chainage Tour (Clicking road also pauses)' : 'Play Chainage Tour'}
            >
              {isPlayingChainageTour ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlayingChainageTour ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={handleStepForwardChainage}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Step Forward +500m"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selectors: 1x, 1.5x, 2x, 2.5x, 3x */}
          <div className="flex items-center gap-1 bg-[#181B22] p-1 rounded-xl border border-white/[0.08]">
            {[1, 1.5, 2, 2.5, 3].map(speed => {
              const isActive = chainageTourSpeed === speed;
              return (
                <button
                  key={speed}
                  onClick={() => {
                    setChainageTourSpeed(speed);
                    chainageTourSpeedRef.current = speed;
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`Set speed to ${speed}x`}
                >
                  {speed}x
                </button>
              );
            })}
          </div>

          {/* Current Chainage Position Badge */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-400 text-[11px]">Chainage:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30">
              {formatChainagePlus(currentTourChainage)}
            </span>
          </div>
        </div>

        {/* Chainage Corridor Scrubber Slider */}
        <div className="flex-1 max-w-lg flex items-center gap-3 mx-2">
          <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
            {formatChainagePlus(minChainage)}
          </span>
          <input
            type="range"
            min={minChainage}
            max={maxChainage}
            step={0.01}
            value={currentTourChainage}
            onChange={handleChainageSliderChange}
            className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer hover:accent-cyan-300"
          />
          <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
            {formatChainagePlus(maxChainage)}
          </span>
        </div>

        {/* Real-time Status Badge */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>Corridor: Roorkee–Haridwar (Ch. 189+230 to 204+000)</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">
            {isPlayingChainageTour ? 'Tour Running' : 'Tour Paused'}
          </span>
        </div>
      </div>
    </div>
  );
};
