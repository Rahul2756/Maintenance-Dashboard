import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
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
import { StripChartDataset } from '../../types/stripChart';
import {
  buildHighway3DProgressSegments,
  Highway3DProgressSegment,
  STRIP_ACTIVITIES
} from '../../utils/gisUtils';
import { formatChainagePlus, formatChainageKm, normalizeChainage } from '../../utils/excelParser';
import { useTheme } from '../../context/ThemeContext';
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
  Info,
  MousePointer,
  Plus,
  Minus
} from 'lucide-react';

export type ViewMode = 'Overall' | 'Activity' | 'Planned' | 'Actual' | 'Delayed' | 'Remaining';
export type CameraMode = '3D' | 'Plan' | 'Driver';

export interface Highway3DDigitalTwinHandle {
  smoothFlyToChainage: (km: number) => void;
  jumpCameraToChainage: (km: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleFlyover: () => void;
  searchToChainage: (queryStr: string) => void;
  togglePlayTour: () => void;
  setTourSpeed: (speed: number) => void;
}

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
  stripDataset?: StripChartDataset | null;
  sideFilter?: HighwaySide;
  selectedActivityFilter?: string;
  onActivityChange?: (activity: string) => void;
  onSideChange?: (side: HighwaySide) => void;
  activeReportingDate?: string;
  // Enhanced props for Draft A unified GIS architecture:
  cameraMode?: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
  isFlyoverActive?: boolean;
  onToggleFlyover?: () => void;
  currentTourChainage?: number;
  onTourChainageChange?: (km: number) => void;
  isPlayingTour?: boolean;
  onTogglePlayTour?: () => void;
  tourSpeed?: number;
  selectedSegment?: RoadSegmentData | null;
  onSelectSegment?: (seg: RoadSegmentData | null) => void;
  targetChainage?: number | null;
  activeTool?: 'select' | 'orbit';
  onActiveToolChange?: (tool: 'select' | 'orbit') => void;
  isHighlightingDeviations?: boolean;
}

// Normalized road segment type aliased to Highway3DProgressSegment
export type RoadSegmentData = Highway3DProgressSegment;

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

export const Highway3DDigitalTwin = forwardRef<Highway3DDigitalTwinHandle, Highway3DDigitalTwinProps>(({
  actualRows,
  plannedRecords,
  selectedRow,
  onSelectRow,
  minChainage = 130.560,
  maxChainage = 206.220,
  availableDates,
  qcLogs = [],
  globalFilters,
  onFilterChange,
  stripDataset,
  sideFilter = 'Both',
  selectedActivityFilter: externalActivityFilter,
  onActivityChange,
  onSideChange,
  activeReportingDate,
  cameraMode: propCameraMode,
  onCameraModeChange,
  isFlyoverActive: propIsFlyoverActive,
  onToggleFlyover,
  currentTourChainage: propCurrentTourChainage,
  onTourChainageChange,
  isPlayingTour: propIsPlayingTour,
  onTogglePlayTour,
  tourSpeed: propTourSpeed,
  selectedSegment: propSelectedSegment,
  onSelectSegment,
  targetChainage: propTargetChainage,
  activeTool: propActiveTool = 'select',
  onActiveToolChange,
  isHighlightingDeviations = false
}, ref) => {
  // Container & Canvas references
  const { isLight } = useTheme();
  const isLightRef = useRef(isLight);
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

  // Dynamically update 3D scene sky/fog when Dark/Light theme changes without rebuilding WebGL
  useEffect(() => {
    isLightRef.current = isLight;
    if (!sceneRef.current) return;
    const bgHex = isLight ? 0xedf2f7 : 0x0b0c0e;
    sceneRef.current.background = new THREE.Color(bgHex);
    sceneRef.current.fog = new THREE.FogExp2(bgHex, 0.00015);
  }, [isLight]);
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
  const [internalActivity, setInternalActivity] = useState<string>(
    externalActivityFilter || 'milling'
  );

  useEffect(() => {
    if (externalActivityFilter) {
      setInternalActivity(externalActivityFilter);
    }
  }, [externalActivityFilter]);

  const handleActivityChange = (actId: string) => {
    setInternalActivity(actId);
    if (onActivityChange) onActivityChange(actId);
  };

  const [cameraMode, setCameraMode] = useState<CameraMode>(propCameraMode || '3D');
  const [activeTool, setActiveTool] = useState<'select' | 'orbit'>(propActiveTool || 'select');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFlyoverActive, setIsFlyoverActive] = useState(propIsFlyoverActive || false);
  const flyoverProgressRef = useRef(0);
  const flyoverSpeed = 1;

  // Driver mode state
  const driverPositionRef = useRef(kmToWorldX(189.500));
  const [driverChainage, setDriverChainage] = useState(189.500);

  // Search input state
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Hover and selection state
  const [hoveredSegment, setHoveredSegment] = useState<RoadSegmentData | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentData | null>(propSelectedSegment || null);
  const [inspectorActiveActivity, setInspectorActiveActivity] = useState<string>('milling');

  // Chainage Tour Playback state (moves slowly from starting chainage to ending chainage)
  const [currentTourChainage, setCurrentTourChainage] = useState<number>(propCurrentTourChainage || minChainage);
  const currentTourChainageRef = useRef<number>(propCurrentTourChainage || minChainage);
  const [isPlayingChainageTour, setIsPlayingChainageTour] = useState<boolean>(propIsPlayingTour || false);
  const isPlayingChainageTourRef = useRef<boolean>(propIsPlayingTour || false);
  const [chainageTourSpeed, setChainageTourSpeed] = useState<number>(propTourSpeed || 1); // 1x, 1.5x, 2x, 2.5x, 3x
  const chainageTourSpeedRef = useRef<number>(propTourSpeed || 1);

  // Synchronize incoming props
  useEffect(() => {
    if (propCameraMode && propCameraMode !== cameraMode) {
      setCameraViewMode(propCameraMode);
    }
  }, [propCameraMode]);

  useEffect(() => {
    if (propActiveTool) {
      setActiveTool(propActiveTool);
    }
  }, [propActiveTool]);

  useEffect(() => {
    if (propIsFlyoverActive !== undefined && propIsFlyoverActive !== isFlyoverActive) {
      setIsFlyoverActive(propIsFlyoverActive);
    }
  }, [propIsFlyoverActive]);

  useEffect(() => {
    if (
      propCurrentTourChainage !== undefined &&
      Math.abs(propCurrentTourChainage - currentTourChainageRef.current) > 0.05
    ) {
      currentTourChainageRef.current = propCurrentTourChainage;
      setCurrentTourChainage(propCurrentTourChainage);
      jumpCameraToChainage(propCurrentTourChainage);
    }
  }, [propCurrentTourChainage]);

  useEffect(() => {
    if (propIsPlayingTour !== undefined && propIsPlayingTour !== isPlayingChainageTourRef.current) {
      setIsPlayingChainageTour(propIsPlayingTour);
      isPlayingChainageTourRef.current = propIsPlayingTour;
    }
  }, [propIsPlayingTour]);

  useEffect(() => {
    if (propTourSpeed !== undefined) {
      setChainageTourSpeed(propTourSpeed);
      chainageTourSpeedRef.current = propTourSpeed;
    }
  }, [propTourSpeed]);

  useEffect(() => {
    if (propSelectedSegment !== undefined) {
      setSelectedSegment(propSelectedSegment);
      if (propSelectedSegment) {
        setInspectorActiveActivity(propSelectedSegment.activity);
      }
    }
  }, [propSelectedSegment]);

  useEffect(() => {
    if (propTargetChainage !== undefined && propTargetChainage !== null) {
      searchToChainage(formatChainagePlus(propTargetChainage));
    }
  }, [propTargetChainage]);

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
  const activeTimelineDate = activeReportingDate || availableDates[availableDates.length - 1] || '05.11.2026';

  // 1. Process 3D Segments using dynamic unified Construction Execution Sequence logic
  const roadSegments: RoadSegmentData[] = useMemo(() => {
    return buildHighway3DProgressSegments(
      actualRows,
      plannedRecords,
      stripDataset ?? null,
      'milling',
      sideFilter,
      activeTimelineDate,
      kmToWorldX,
      isLight
    );
  }, [actualRows, plannedRecords, stripDataset, sideFilter, activeTimelineDate, kmToWorldX, isLight]);

  // Sync selectedSegment when external selectedRow prop changes
  useEffect(() => {
    if (selectedRow) {
      const match = roadSegments.find(
        s => s.fromChainage <= selectedRow.fromChainage && s.toChainage >= selectedRow.toChainage
      ) || roadSegments.find(s => s.id === selectedRow.id);

      if (match) {
        setSelectedSegment(match);
        setInspectorActiveActivity(match.activity);
        // Smoothly focus camera towards this chainage
        smoothFlyToChainage((match.fromChainage + match.toChainage) / 2);
      }
    }
  }, [selectedRow, roadSegments]);

  // Color evaluation function based on ViewMode and timeline
  const getSegmentColor = useCallback((seg: RoadSegmentData) => {
    // Out-of-scope segments (Work by DPS, Himalayan, Under Construction) are kept in "no fill" format
    if (seg.isOutOfScope || seg.status === 'dps' || seg.status === 'under_construction' || seg.status === 'himalayan') {
      return { color: 0x000000, emissive: 0x000000, opacity: 0 };
    }

    let opacity = 0.95;
    if (isHighlightingDeviations && !seg.isDeviation) {
      opacity = 0.22;
    }

    return { color: seg.color, emissive: seg.emissive, opacity };
  }, [isHighlightingDeviations]);

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
    const bgHex = isLightRef.current ? 0xedf2f7 : 0x0b0c0e;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.00015);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 25000);
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
    controls.maxDistance = 15000;
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

      // Out-of-Scope (Work by DPS, Himalayan, Under Construction):
      // Keep in "no fill" format: leave the road completely blank in these chainages.
      // Attach an invisible hit-box mesh with opacity 0 so raycasting/inspection still identifies the section.
      if (seg.isOutOfScope || seg.status === 'dps' || seg.status === 'under_construction' || seg.status === 'himalayan') {
        const invisibleGeo = new THREE.BoxGeometry(length, 0.05, seg.widthZ);
        const invisibleMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hitMesh = new THREE.Mesh(invisibleGeo, invisibleMat);
        hitMesh.position.set(centerX, 0.02, seg.centerZ);
        hitMesh.userData = { segmentData: seg };
        scene.add(hitMesh);
        segmentMeshesRef.current.set(seg.id, hitMesh);
        return;
      }

      // Realistic 3D lift:
      let layerHeight = 0.06;
      let posY = 0.04;
      if (seg.latestStage === 5) {
        layerHeight = 0.08;
        posY = 0.05;
      } else if (seg.latestStage === 3) {
        layerHeight = 0.07;
        posY = 0.045;
      } else if (seg.latestStage === 1) {
        layerHeight = 0.04;
        posY = 0.025;
      }

      const geo = new THREE.BoxGeometry(length, layerHeight, seg.widthZ);
      const style = getSegmentColor(seg);

      const mat = new THREE.MeshStandardMaterial({
        color: style.color,
        emissive: style.emissive,
        emissiveIntensity: 0.45,
        roughness: 0.35,
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
        if (onSelectRow) onSelectRow(seg.primaryRow ?? null);
        if (onSelectSegment) onSelectSegment(seg);
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
          if (onTogglePlayTour) onTogglePlayTour();
        }

        currentTourChainageRef.current = nextKm;
        setCurrentTourChainage(nextKm);
        if (onTourChainageChange) onTourChainageChange(nextKm);

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
      if (onSelectRow) onSelectRow(found.primaryRow ?? null);
      if (onSelectSegment) onSelectSegment(found);
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

  const handleZoomIn = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.sub(controls.target).multiplyScalar(0.8).add(controls.target);
    controls.update();
  };

  const handleZoomOut = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);
    controls.update();
  };

  useImperativeHandle(ref, () => ({
    smoothFlyToChainage,
    jumpCameraToChainage,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetCamera: handleResetCamera,
    setCameraMode: (mode: CameraMode) => setCameraViewMode(mode),
    toggleFlyover: () => {
      setIsFlyoverActive(prev => !prev);
      if (!isFlyoverActive) setCameraMode('3D');
    },
    searchToChainage,
    togglePlayTour: handleToggleChainagePlay,
    setTourSpeed: (speed: number) => {
      setChainageTourSpeed(speed);
      chainageTourSpeedRef.current = speed;
    }
  }));

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[580px] bg-gradient-to-b ${
        isLight ? 'from-[#F7F9FC] to-[#EDF2F7]' : 'from-[#090A0D] to-[#0F1116]'
      } overflow-hidden rounded-2xl border ${
        isLight ? 'border-slate-200' : 'border-white/10'
      }`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="w-full h-full block focus:outline-none cursor-grab active:cursor-grabbing"
      />

      {/* Floating Vertical Tool Dock on Left Edge (Draft A Section 3) */}
      <div
        className={`absolute top-4 left-4 z-30 flex flex-col gap-1 p-1 rounded-xl shadow-lg backdrop-blur-md border ${
          isLight
            ? 'bg-white/95 border-slate-200 shadow-slate-200/50'
            : 'bg-[#101726]/90 border-white/10 shadow-black/50'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTool('select');
            if (onActiveToolChange) onActiveToolChange('select');
          }}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            activeTool === 'select'
              ? isLight
                ? 'bg-[#07966D] text-white shadow-sm'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Select / Pointer Tool"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool('orbit');
            if (onActiveToolChange) onActiveToolChange('orbit');
          }}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            activeTool === 'orbit'
              ? isLight
                ? 'bg-[#07966D] text-white shadow-sm'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Orbit / Pan Tool"
        >
          <Compass className="w-4 h-4" />
        </button>

        <div className={`h-px my-0.5 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

        <button
          type="button"
          onClick={handleZoomIn}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetCamera}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Exclusive Construction Sequence Legend (Draft A Section 4) */}
      <div
        className={`absolute bottom-4 left-4 z-20 flex items-center gap-3.5 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md border text-xs font-mono select-none flex-wrap max-w-[80vw] ${
          isLight
            ? 'bg-white/95 border-slate-200 text-[#17212B] shadow-slate-200/50'
            : 'bg-[#101726]/90 border-white/10 text-slate-300 shadow-black/50'
        }`}
      >
        <span className="text-slate-400 font-bold uppercase text-[10px]">Legend:</span>
        <div className="flex items-center gap-1.5" title="Milling (#64748B)">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#64748B' }} />
          <span>Milling</span>
        </div>
        <div className="flex items-center gap-1.5" title="Tack Coat (DBM) (#F59E0B)">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
          <span>Tack Coat (DBM)</span>
        </div>
        <div className="flex items-center gap-1.5" title="DBM (#2563EB)">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2563EB' }} />
          <span>DBM</span>
        </div>
        <div className="flex items-center gap-1.5" title="Tack Coat (BC) (#8B5CF6)">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
          <span>Tack Coat (BC)</span>
        </div>
        <div className="flex items-center gap-1.5" title="BC (#16A34A)">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16A34A' }} />
          <span>BC</span>
        </div>
        <span className="text-slate-500">|</span>
        <div className="flex items-center gap-1.5" title="Sequence Deviation (#EF4444) - Solid Red">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
          <span className="text-rose-500 font-semibold">Sequence Deviation</span>
        </div>
        <div className="flex items-center gap-1.5" title="Planned (#CBD5E1) - Silver Grey">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#CBD5E1' }} />
          <span>Planned</span>
        </div>
      </div>

      {/* Screen-Space Projected Markers */}
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
              <div
                className={`w-0.5 h-4 mx-auto ${
                  isSelected
                    ? isLight ? 'bg-[#07966D] shadow-[0_0_8px_#07966D]' : 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]'
                    : 'bg-amber-400/80'
                }`}
              />

              {/* Marker Board */}
              <div
                className={`flex flex-col items-center rounded-lg border shadow-xl backdrop-blur-md px-2.5 py-1 ${
                  isSelected
                    ? isLight
                      ? 'bg-white/95 border-[#07966D] text-[#07966D] ring-2 ring-[#07966D]/30'
                      : 'bg-cyan-950/95 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/50 glow-cyan'
                    : isLight
                    ? 'bg-white/95 border-amber-500/50 text-amber-800'
                    : 'bg-[#12141A]/95 border-amber-500/50 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <MapPin
                    className={`w-3 h-3 ${
                      isSelected
                        ? isLight ? 'text-[#07966D] animate-bounce' : 'text-cyan-400 animate-bounce'
                        : 'text-amber-500'
                    }`}
                  />
                  <span className="text-[12px] font-mono font-bold tracking-wider">
                    {m.label}
                  </span>
                </div>
                {isSelected && (
                  <span
                    className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${
                      isLight ? 'text-[#07966D]' : 'text-cyan-300'
                    }`}
                  >
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
        <div
          className={`absolute top-4 right-4 z-20 pointer-events-none rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono max-w-xs border ${
            isLight
              ? 'bg-white/95 border-slate-200 text-[#17212B]'
              : 'bg-[#12141A]/95 border-cyan-500/40 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-1 mb-1.5">
            <span className={`font-bold ${isLight ? 'text-[#07966D]' : 'text-cyan-300'}`}>
              {formatChainagePlus(hoveredSegment.fromChainage)} → {formatChainagePlus(hoveredSegment.toChainage)}
            </span>
            <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
              {hoveredSegment.lengthM}m
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div>Stage: <span className="font-semibold text-slate-900 dark:text-white">{hoveredSegment.latestStageName || hoveredSegment.activity}</span></div>
            <div>Lane: <span className="text-slate-900 dark:text-white">{hoveredSegment.lane}</span></div>
            <div>Status: <span className={`font-semibold ${hoveredSegment.isDeviation ? 'text-rose-500' : hoveredSegment.isInProgress ? 'text-cyan-400' : 'text-emerald-500'}`}>
              {hoveredSegment.isDeviation ? 'Sequence Deviation' : hoveredSegment.isInProgress ? 'In Progress' : 'Compliant'}
            </span></div>
            <div>Progress: <span className="text-emerald-500 dark:text-emerald-400 font-bold">{hoveredSegment.progressPercent}%</span></div>
            {hoveredSegment.isDeviation && hoveredSegment.missingPredecessors && hoveredSegment.missingPredecessors.length > 0 && (
              <div className="col-span-2 text-[10px] text-rose-500 font-bold">
                Missing: {hoveredSegment.missingPredecessors.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver Cockpit HUD Overlay */}
      {cameraMode === 'Driver' && (
        <div
          className={`absolute bottom-16 left-6 z-20 backdrop-blur-md border rounded-2xl p-3.5 shadow-2xl flex items-center gap-4 text-xs font-mono ${
            isLight
              ? 'bg-white/90 border-slate-200 text-[#17212B]'
              : 'bg-[#12141A]/90 border-emerald-500/30 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">HIGHWAY STATION (TPP)</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                {formatChainagePlus(driverChainage)}
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
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
              className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer"
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
              className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer"
            >
              +200m ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

Highway3DDigitalTwin.displayName = 'Highway3DDigitalTwin';
