import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BoardEvaluation, PinState, PuzzleDefinition } from '../game/puzzleEngine';
import {
  BrushedMetalTextureSet,
  createBrushedMetalTextures,
  createContactShadowTexture,
  LetterTextureCache,
} from './textures';

export interface WordlockSceneCallbacks {
  /** Rotate a column by an integer delta (+up, -down; may be multi-step on drag) */
  onWheelRotate: (col: number, delta: number) => void;
  onHoverWheelChange?: (col: number | null, half: 'up' | 'down' | null) => void;
  /** Subtle audio feedback while dragging a wheel across slat detent thresholds */
  onDragDetentTick?: (col: number) => void;
}

interface BeltSlatUnit {
  /** Index along the continuous conveyor loop (`letterIndex = slotIndex % rowCount`) */
  slotIndex: number;
  group: THREE.Group;
  faceMat: THREE.MeshStandardMaterial;
}

/**
 * Individual vertical tumbler track mounted inside the unified `conveyorMechanismGroup`.
 * Pre-allocated with 14 slat slots & 14 chain links so switching 5↔7 rows requires zero
 * mesh or material allocations and zero WebGL shader recompilations.
 */
interface ConveyorTrackUnit {
  col: number;
  trackGroup: THREE.Group;
  slats: BeltSlatUnit[];
  chainLinks: THREE.Group[];
  upperClutchSprocket: THREE.Group;
  lowerClutchSprocket: THREE.Group;
  currentSteps: number;
  targetSteps: number;
  stepVelocity: number;
  hoverIntensity: number;
}

interface LedStripPair {
  slotIndex: number; // 0..6 (slots 1..5 active on 5-row; 0..6 active on 7-row)
  leftGroup: THREE.Group;
  rightGroup: THREE.Group;
  leftMat: THREE.MeshStandardMaterial;
  rightMat: THREE.MeshStandardMaterial;
  pointLight: THREE.PointLight;
  targetColor: THREE.Color;
  targetIntensity: number;
  y5: number;
  y7: number;
  isOuterOnly: boolean;
}

interface PinLampUnit {
  topMat: THREE.MeshStandardMaterial;
  bottomMat: THREE.MeshStandardMaterial;
  pointLight: THREE.PointLight;
  targetColor: THREE.Color;
  targetIntensity: number;
}

interface ActiveDragState {
  pointerId: number;
  pointerType: string;
  col: number;
  hitHalf: 'up' | 'down';
  isChevronButton: boolean;
  startX: number;
  startY: number;
  startTimeMs: number;
  baseSteps: number;
  visualSteps: number;
  lastDetentIndex: number;
  hasDragged: boolean;
  pixelsPerSlat: number;
}

interface VaultDimensions {
  rowCount: 5 | 7;
  masterRowIndex: number;
  slatCount: number;
  slatPitch: number;
  beltPerimeter: number;
  straightLen: number;
  halfStraight: number;
  rollerRadius: number;
  semicircleArc: number;
  slatHeight: number;
  housingHalfH: number;
  beamY: number;
  innerChamberH: number;
  backPlateH: number;
  guideH: number;
  laserY: number;
  tensionY: number;
  footY: number;
  plinthY: number;
  shadowY: number;
  bezelOuterH: number;
  bezelInnerH: number;
  bezelPinY: number;
  bezelBracketY: number;
  baseCameraDist: number;
  vaultTotalHeight: number;
}

function createVaultDimensions(rowCount: 5 | 7): VaultDimensions {
  if (rowCount === 7) {
    const slatCount = 14;
    const slatPitch = 0.8;
    const beltPerimeter = slatCount * slatPitch; // 11.20
    const straightLen = 4.36;
    const halfStraight = straightLen / 2; // 2.18
    const rollerRadius = (beltPerimeter - 2 * straightLen) / (2 * Math.PI); // ~0.3947
    return {
      rowCount: 7,
      masterRowIndex: 3,
      slatCount,
      slatPitch,
      beltPerimeter,
      straightLen,
      halfStraight,
      rollerRadius,
      semicircleArc: Math.PI * rollerRadius,
      slatHeight: 0.62,
      housingHalfH: 3.38,
      beamY: 3.12,
      innerChamberH: 5.88,
      backPlateH: 6.82,
      guideH: 5.56,
      laserY: 2.76,
      tensionY: 1.88,
      footY: -3.63,
      plinthY: -3.94,
      shadowY: -3.71,
      bezelOuterH: 1.0,
      bezelInnerH: 0.7,
      bezelPinY: 0.44,
      bezelBracketY: 0.45,
      baseCameraDist: 13.4,
      vaultTotalHeight: 7.3,
    };
  }

  const slatCount = 10;
  const slatPitch = 0.94;
  const beltPerimeter = slatCount * slatPitch; // 9.40
  const straightLen = 3.32;
  const halfStraight = straightLen / 2; // 1.66
  const rollerRadius = (beltPerimeter - 2 * straightLen) / (2 * Math.PI); // ~0.4393
  return {
    rowCount: 5,
    masterRowIndex: 2,
    slatCount,
    slatPitch,
    beltPerimeter,
    straightLen,
    halfStraight,
    rollerRadius,
    semicircleArc: Math.PI * rollerRadius,
    slatHeight: 0.72,
    housingHalfH: 2.92,
    beamY: 2.66,
    innerChamberH: 4.95,
    backPlateH: 5.9,
    guideH: 4.65,
    laserY: 2.3,
    tensionY: 1.38,
    footY: -3.17,
    plinthY: -3.48,
    shadowY: -3.25,
    bezelOuterH: 1.24,
    bezelInnerH: 0.84,
    bezelPinY: 0.54,
    bezelBracketY: 0.56,
    baseCameraDist: 11.9,
    vaultTotalHeight: 6.35,
  };
}

const DIMS_5 = createVaultDimensions(5);
const DIMS_7 = createVaultDimensions(7);
const MAX_SLAT_POOL = 14;

// Horizontal layout constants shared by both 5-row and 7-row vaults
const WHEEL_XS = [-2.01, -0.67, 0.67, 2.01];
const COUPLER_XS = [-1.34, 0.0, 1.34];
const SLAT_WIDTH = 1.08;
const SLAT_THICKNESS = 0.11;

// LED vertical slot coordinates (7 persistent LEDs; slots 1..5 serve 5-row mode, 0..6 serve 7-row)
const LED_SLOT_Y5 = [2.39, 1.86, 0.94, 0.0, -0.94, -1.86, -2.39];
const LED_SLOT_Y7 = [2.39, 1.6, 0.8, 0.0, -0.8, -1.6, -2.39];

// Pre-allocated colors & math helpers (zero GC in render loop)
const COLOR_AMBER = new THREE.Color('#ffaa00');
const COLOR_PIN_AMBER = new THREE.Color('#ffab00');
const COLOR_EMERALD = new THREE.Color('#00e676');
const COLOR_SLATE_LED = new THREE.Color('#2a2e35');
const COLOR_DIM_STRIP = new THREE.Color('#1a1f28');
const COLOR_HOVER_TINT = new THREE.Color('#ffd380');
const COLOR_ENAMEL_GLOW = new THREE.Color('#fff2d6');
const _mouseNdc = new THREE.Vector2();
const _projA = new THREE.Vector3();
const _projB = new THREE.Vector3();
const _poseOut = { y: 0, z: 0, rotX: 0 };

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Evaluates exact (y, z, rotX) along the closed vertical stadium conveyor path.
 */
function sampleStadiumBelt(
  sRaw: number,
  radialOffset: number,
  dims: VaultDimensions,
  out: { y: number; z: number; rotX: number }
): void {
  const { beltPerimeter, straightLen, halfStraight, rollerRadius, semicircleArc } = dims;
  const u = (((sRaw + halfStraight) % beltPerimeter) + beltPerimeter) % beltPerimeter;
  const r = rollerRadius + radialOffset;

  if (u <= straightLen) {
    out.y = halfStraight - u;
    out.z = r;
    out.rotX = 0;
  } else if (u <= straightLen + semicircleArc) {
    const phi = (u - straightLen) / rollerRadius;
    out.y = -halfStraight - r * Math.sin(phi);
    out.z = r * Math.cos(phi);
    out.rotX = phi;
  } else if (u <= 2 * straightLen + semicircleArc) {
    const d = u - (straightLen + semicircleArc);
    out.y = -halfStraight + d;
    out.z = -r;
    out.rotX = Math.PI;
  } else {
    const phi = Math.PI + (u - (2 * straightLen + semicircleArc)) / rollerRadius;
    out.y = halfStraight - r * Math.sin(phi);
    out.z = r * Math.cos(phi);
    out.rotX = phi;
  }
}

export class WordlockScene {
  private readonly container: HTMLElement;
  private readonly callbacks: WordlockSceneCallbacks;
  private readonly isSoftwareGl: boolean;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  // Active row configuration & smooth 5↔7 morph animation state (0 = 5-row, 1 = 7-row)
  private dims: VaultDimensions = DIMS_5;
  private rowMorph = 0;
  private rowMorphTarget = 0;
  private conveyorMorphScaleY = 1;

  // Studio stage elements repositioned smoothly during 5↔7 morph
  private darkMode = true;
  private hemiLight!: THREE.HemisphereLight;
  private rimLeftLight!: THREE.DirectionalLight;
  private rimRightLight!: THREE.DirectionalLight;
  private plinthMat!: THREE.MeshStandardMaterial;
  private backWallMat!: THREE.MeshStandardMaterial;
  private watermarkTex: THREE.Texture | null = null;
  private plinthMesh!: THREE.Mesh;
  private shadowPlaneMesh!: THREE.Mesh;

  // Persistent morphable vault housing references (built ONCE -> zero rebuild stalls)
  private readonly vaultHousingGroup = new THREE.Group();
  private backPlateMesh!: THREE.Mesh;
  private innerChamberMesh!: THREE.Mesh;
  private leftPillarMesh!: THREE.Mesh;
  private rightPillarMesh!: THREE.Mesh;
  private topBeamMesh!: THREE.Mesh;
  private bottomBeamMesh!: THREE.Mesh;
  private topTrimMesh!: THREE.Mesh;
  private bottomTrimMesh!: THREE.Mesh;
  private topLaserMesh!: THREE.Mesh;
  private botLaserMesh!: THREE.Mesh;
  private leftFootMesh!: THREE.Mesh;
  private rightFootMesh!: THREE.Mesh;
  private topBoltsGroup = new THREE.Group();
  private bottomBoltsGroup = new THREE.Group();
  private upperBearingCapsGroup = new THREE.Group();
  private lowerBearingCapsGroup = new THREE.Group();
  private upChevronGroup = new THREE.Group();
  private downChevronGroup = new THREE.Group();
  private bezelGroup = new THREE.Group();
  private upperProxyGroup = new THREE.Group();
  private lowerProxyGroup = new THREE.Group();
  private readonly trackGuides: THREE.Mesh[] = [];
  private readonly crossBraces: THREE.Mesh[] = [];

  // Unified Interconnected Conveyor Architecture (persistent, zero rebuilds)
  private readonly conveyorMechanismGroup = new THREE.Group();
  private readonly beltTracksGroup = new THREE.Group();
  private readonly upperDriveShaftGroup = new THREE.Group();
  private readonly lowerDriveShaftGroup = new THREE.Group();
  private readonly upperTensionShaftGroup = new THREE.Group();
  private readonly lowerTensionShaftGroup = new THREE.Group();
  private readonly tracks: ConveyorTrackUnit[] = [];

  private readonly hitProxies: THREE.Mesh[] = [];
  private readonly rowLedPairs: LedStripPair[] = [];
  private readonly pinLamps: PinLampUnit[] = [];

  // Shared mechanical coupling state for the unified conveyor assembly
  private sharedDriveAngle = 0;
  private assemblySeatZ = 0;
  private assemblySeatTargetZ = 0;
  private assemblyRecoilY = 0;
  private assemblyRecoilVel = 0;
  private hasLoadedOnce = false;

  // Shared conveyor geometries & materials (built ONCE)
  private slatBodyGeo!: THREE.BoxGeometry;
  private slatFaceGeo!: THREE.PlaneGeometry;
  private hingeLugGeo!: THREE.CylinderGeometry;
  private chainPlateGeo!: THREE.BoxGeometry;
  private chainPinGeo!: THREE.CylinderGeometry;
  private slatBodyMat!: THREE.MeshPhysicalMaterial;
  private chainSteelMat!: THREE.MeshPhysicalMaterial;
  private brassHardwareMat!: THREE.MeshPhysicalMaterial;
  private rollerCoreMat!: THREE.MeshStandardMaterial;

  // Hero animated mechanisms mounted to vaultHousingGroup
  private leverPivot = new THREE.Group();
  private leverAngle = 0.62;
  private leverTargetAngle = 0.62;
  private leverVelocity = 0;

  private deadboltGroup = new THREE.Group();
  private boltPositionX = -3.38;
  private boltTargetX = -3.38;

  private bezelReticleMat!: THREE.MeshStandardMaterial;
  private unlockLaserMat!: THREE.MeshStandardMaterial;
  private unlockCascadeActive = false;
  private unlockCascadeTime = 0;

  // Shared procedural metal textures + high-speed A–Z letter texture cache
  private readonly gunmetalTex: BrushedMetalTextureSet;
  private readonly steelTex: BrushedMetalTextureSet;
  private readonly brassTex: BrushedMetalTextureSet;
  private readonly letterCache: LetterTextureCache;
  private readonly contactShadowTex: THREE.CanvasTexture;
  private readonly envTexture: THREE.Texture;
  private warmTimerId = 0;

  // Interaction, direct vertical touch/mouse drag & camera parallax
  private readonly raycaster = new THREE.Raycaster();
  private hoveredCol: number | null = null;
  private hoveredHalf: 'up' | 'down' | null = null;
  private activeDrag: ActiveDragState | null = null;
  private maxDragSteps = 12;
  private pointerNormX = 0;
  private pointerNormY = 0;
  private lastRaycastMs = 0;
  private lastWheelScrollMs = 0;
  private interactionLocked = false;
  private prefersReducedMotion = false;

  // Smoothly damped camera framing state
  private readonly baseYaw = THREE.MathUtils.degToRad(6.8);
  private readonly basePitch = THREE.MathUtils.degToRad(8.0);
  private currentYaw = THREE.MathUtils.degToRad(6.8);
  private currentPitch = THREE.MathUtils.degToRad(8.0);
  private currentCameraDist = DIMS_5.baseCameraDist;
  private currentCameraFov = 34;
  private currentLookAtX = 0.22;
  private currentLookAtY = -0.08;
  private cameraInitialized = false;

  // Loop & lifecycle
  private frameId = 0;
  private lastTimeMs = performance.now();
  private disposed = false;
  private contextLost = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: WordlockSceneCallbacks, initialDarkMode = true) {
    this.container = container;
    this.callbacks = callbacks;
    this.darkMode = initialDarkMode;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = initialDarkMode ? 0.92 : 1.0;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Studio Environment Map (Missing Piece Royal Purple / Lavender Stage)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(initialDarkMode ? '#160524' : '#EFE8F8');
    this.scene.fog = new THREE.FogExp2(
      initialDarkMode ? '#160524' : '#EFE8F8',
      initialDarkMode ? 0.026 : 0.016
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = initialDarkMode ? 0.42 : 0.56;
    pmrem.dispose();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 90);

    // 4. Procedural PBR Textures & Pre-Baked A–Z Letter Cache
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.gunmetalTex = createBrushedMetalTextures('gunmetal', maxAniso);
    this.steelTex = createBrushedMetalTextures('steel', maxAniso);
    this.brassTex = createBrushedMetalTextures('brass', maxAniso);
    this.letterCache = new LetterTextureCache(maxAniso);
    this.contactShadowTex = createContactShadowTexture();

    // 5. Shared Conveyor Hardware Assets (created ONCE)
    this.initSharedConveyorAssets();

    // 6. Build Persistent Morphable Vault Hierarchy ONCE (zero future rebuilds/shader recompiles)
    this.setupLighting();
    this.buildStudioStage();
    this.scene.add(this.vaultHousingGroup);
    this.vaultHousingGroup.add(this.conveyorMechanismGroup);
    this.conveyorMechanismGroup.add(this.beltTracksGroup);

    this.buildVaultHousing();
    this.buildUnifiedConveyorDriveChassis();
    this.buildInspectionMagnifyingBezel();
    this.buildBrassReleaseLever();
    this.buildLockingDeadbolt();
    this.buildHitProxies();
    this.buildPersistentTrackPool();

    this.applyVaultMorph(0);
    this.updateCameraTransform(width, height, 0, true);

    // 7. Post-Processing (GPU only; software WebGL renders directly)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.18,
        0.32,
        0.95
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    // 8. Events, Idle A–Z Cache Pre-Warming & Render Loop
    this.bindEvents();
    this.scheduleIdleTextureWarm();
    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  /**
   * Quietly pre-warms remaining A–Z letter textures during idle intervals after mount
   * so switching between 5-row and 7-row locks later requires zero canvas draws.
   */
  private scheduleIdleTextureWarm(): void {
    if (this.isSoftwareGl) return;
    const step = () => {
      if (this.disposed) return;
      const hasMore = this.letterCache.warmBatch(2);
      if (hasMore) {
        this.warmTimerId = window.setTimeout(step, 140);
      }
    };
    this.warmTimerId = window.setTimeout(step, 500);
  }

  private initSharedConveyorAssets(): void {
    this.slatBodyGeo = new THREE.BoxGeometry(SLAT_WIDTH, DIMS_5.slatHeight, SLAT_THICKNESS);
    this.slatFaceGeo = new THREE.PlaneGeometry(SLAT_WIDTH - 0.04, DIMS_5.slatHeight - 0.04);

    this.hingeLugGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.14, 12);
    this.hingeLugGeo.rotateZ(Math.PI / 2);

    this.chainPlateGeo = new THREE.BoxGeometry(0.055, 0.28, 0.075);
    this.chainPinGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.12, 10);
    this.chainPinGeo.rotateZ(Math.PI / 2);

    this.slatBodyMat = new THREE.MeshPhysicalMaterial({
      color: '#322544',
      metalness: 0.86,
      roughness: 0.34,
      anisotropy: 0.55,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
    });

    this.chainSteelMat = new THREE.MeshPhysicalMaterial({
      color: '#615678',
      metalness: 0.88,
      roughness: 0.3,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
    });

    this.brassHardwareMat = new THREE.MeshPhysicalMaterial({
      color: '#D9AB2E',
      metalness: 0.92,
      roughness: 0.23,
      map: this.brassTex.map,
      roughnessMap: this.brassTex.roughnessMap,
    });

    this.rollerCoreMat = new THREE.MeshStandardMaterial({
      color: '#1E112C',
      metalness: 0.78,
      roughness: 0.46,
      map: this.gunmetalTex.map,
    });
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(
      this.darkMode ? '#9E7CD8' : '#F8F4FF',
      this.darkMode ? '#200B2E' : '#9E89BA',
      this.darkMode ? 0.34 : 0.65
    );
    this.scene.add(this.hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffeed4', 1.24);
    keyLight.position.set(4.5, 7.6, 8.0);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.camera.left = -6.5;
    keyLight.shadow.camera.right = 6.5;
    keyLight.shadow.camera.top = 6.5;
    keyLight.shadow.camera.bottom = -6.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    this.rimLeftLight = new THREE.DirectionalLight(
      this.darkMode ? '#9E6CFF' : '#8F6CE6',
      this.darkMode ? 0.72 : 0.52
    );
    this.rimLeftLight.position.set(-7.2, 2.5, -3.5);
    this.scene.add(this.rimLeftLight);

    this.rimRightLight = new THREE.DirectionalLight(
      this.darkMode ? '#F6C915' : '#E0B020',
      this.darkMode ? 0.62 : 0.55
    );
    this.rimRightLight.position.set(7.6, -1.0, 2.6);
    this.scene.add(this.rimRightLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight('#fff6e8', 0.58, 7.5, 1.2);
      softbox.position.set(0.4, 6.2, 3.8);
      softbox.lookAt(0, 0, 0);
      this.scene.add(softbox);
    }
  }

  private buildStudioStage(): void {
    this.plinthMat = new THREE.MeshStandardMaterial({
      color: this.darkMode ? '#24093B' : '#D6C7EA',
      metalness: 0.68,
      roughness: 0.44,
      map: this.gunmetalTex.map,
      roughnessMap: this.gunmetalTex.roughnessMap,
    });
    this.plinthMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 10), this.plinthMat);
    this.plinthMesh.position.set(0, DIMS_5.plinthY, -0.35);
    this.plinthMesh.receiveShadow = true;
    this.scene.add(this.plinthMesh);

    this.shadowPlaneMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 5.4),
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      })
    );
    this.shadowPlaneMesh.rotation.x = -Math.PI / 2;
    this.shadowPlaneMesh.position.set(0.15, DIMS_5.shadowY, 0.0);
    this.scene.add(this.shadowPlaneMesh);

    this.backWallMat = new THREE.MeshStandardMaterial({
      color: this.darkMode ? '#1C0730' : '#E7DCF5',
      metalness: 0.45,
      roughness: 0.72,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), this.backWallMat);
    backWall.position.set(0, 0, -4.8);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // 25% opacity Missing Piece 3D logo watermark mounted on studio back wall behind the vault
    const loader = new THREE.TextureLoader();
    loader.load(
      '/assets/aistudio/3d_logo_944e5372.png',
      (tex) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        this.watermarkTex = tex;
        const watermarkMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
          fog: false,
        });
        const watermarkPlane = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 11.2), watermarkMat);
        watermarkPlane.position.set(0, 0.08, -4.64);
        this.scene.add(watermarkPlane);
      },
      undefined,
      () => {
        // Ignore if asset fails to load
      }
    );
  }

  public setTheme(darkMode: boolean): void {
    this.darkMode = darkMode;
    const bgHex = darkMode ? '#160524' : '#EFE8F8';
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, darkMode ? 0.026 : 0.016);
    this.renderer.toneMappingExposure = darkMode ? 0.92 : 1.0;
    this.scene.environmentIntensity = darkMode ? 0.42 : 0.56;

    if (this.backWallMat) {
      this.backWallMat.color.set(darkMode ? '#1C0730' : '#E7DCF5');
    }
    if (this.plinthMat) {
      this.plinthMat.color.set(darkMode ? '#24093B' : '#D6C7EA');
    }
    if (this.hemiLight) {
      this.hemiLight.color.set(darkMode ? '#9E7CD8' : '#F8F4FF');
      this.hemiLight.groundColor.set(darkMode ? '#200B2E' : '#9E89BA');
      this.hemiLight.intensity = darkMode ? 0.34 : 0.65;
    }
    if (this.rimLeftLight) {
      this.rimLeftLight.color.set(darkMode ? '#9E6CFF' : '#8F6CE6');
      this.rimLeftLight.intensity = darkMode ? 0.72 : 0.52;
    }
    if (this.rimRightLight) {
      this.rimRightLight.color.set(darkMode ? '#F6C915' : '#E0B020');
      this.rimRightLight.intensity = darkMode ? 0.62 : 0.55;
    }
  }

  /**
   * Builds the persistent morphable vault housing ONCE with all 7 paired row LED strips
   * and PointLights permanently mounted so switching 5↔7 rows never recompiles WebGL shaders.
   */
  private buildVaultHousing(): void {
    const gunmetalMat = new THREE.MeshPhysicalMaterial({
      color: '#342447',
      metalness: 0.88,
      roughness: 0.28,
      anisotropy: 0.65,
      map: this.gunmetalTex.map,
      roughnessMap: this.gunmetalTex.roughnessMap,
      bumpMap: this.gunmetalTex.bumpMap,
      bumpScale: 0.015,
    });

    const darkCavityMat = new THREE.MeshStandardMaterial({
      color: '#140822',
      metalness: 0.72,
      roughness: 0.56,
    });

    const brushedSteelMat = new THREE.MeshPhysicalMaterial({
      color: '#958CA6',
      metalness: 0.88,
      roughness: 0.26,
      anisotropy: 0.75,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
      bumpMap: this.steelTex.bumpMap,
      bumpScale: 0.012,
    });

    const brassTrimMat = new THREE.MeshPhysicalMaterial({
      color: '#D9AB2E',
      metalness: 0.92,
      roughness: 0.22,
      anisotropy: 0.7,
      map: this.brassTex.map,
      roughnessMap: this.brassTex.roughnessMap,
      bumpMap: this.brassTex.bumpMap,
      bumpScale: 0.01,
    });

    const housing = new THREE.Group();

    this.backPlateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, DIMS_5.backPlateH, 0.4),
      gunmetalMat
    );
    this.backPlateMesh.position.set(0, 0, -0.98);
    this.backPlateMesh.castShadow = true;
    this.backPlateMesh.receiveShadow = true;
    housing.add(this.backPlateMesh);

    this.innerChamberMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.65, DIMS_5.innerChamberH, 0.16),
      darkCavityMat
    );
    this.innerChamberMesh.position.set(0, 0, -0.74);
    this.innerChamberMesh.receiveShadow = true;
    housing.add(this.innerChamberMesh);

    // Heavy Left & Right Machined Side Pillars (base 5-row height, smoothly scales Y to 7-row)
    const pillarShape = new THREE.Shape();
    pillarShape.moveTo(-0.46, -DIMS_5.housingHalfH);
    pillarShape.lineTo(0.46, -DIMS_5.housingHalfH);
    pillarShape.lineTo(0.46, DIMS_5.housingHalfH);
    pillarShape.lineTo(-0.46, DIMS_5.housingHalfH);
    pillarShape.closePath();

    const pillarGeo = new THREE.ExtrudeGeometry(pillarShape, {
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    pillarGeo.center();

    this.leftPillarMesh = new THREE.Mesh(pillarGeo, gunmetalMat);
    this.leftPillarMesh.position.set(-3.16, 0, -0.05);
    this.leftPillarMesh.castShadow = true;
    this.leftPillarMesh.receiveShadow = true;
    housing.add(this.leftPillarMesh);

    this.rightPillarMesh = new THREE.Mesh(pillarGeo, gunmetalMat);
    this.rightPillarMesh.position.set(3.16, 0, -0.05);
    this.rightPillarMesh.castShadow = true;
    this.rightPillarMesh.receiveShadow = true;
    housing.add(this.rightPillarMesh);

    // Upper & Lower Chamfered Header/Footer Beams (slide cleanly along Y)
    const beamShape = new THREE.Shape();
    beamShape.moveTo(-3.55, -0.34);
    beamShape.lineTo(3.55, -0.34);
    beamShape.lineTo(3.55, 0.34);
    beamShape.lineTo(-3.55, 0.34);
    beamShape.closePath();

    const beamGeo = new THREE.ExtrudeGeometry(beamShape, {
      depth: 1.54,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    beamGeo.center();

    this.topBeamMesh = new THREE.Mesh(beamGeo, gunmetalMat);
    this.topBeamMesh.position.set(0, DIMS_5.beamY, -0.05);
    this.topBeamMesh.castShadow = true;
    this.topBeamMesh.receiveShadow = true;
    housing.add(this.topBeamMesh);

    this.bottomBeamMesh = new THREE.Mesh(beamGeo, gunmetalMat);
    this.bottomBeamMesh.position.set(0, -DIMS_5.beamY, -0.05);
    this.bottomBeamMesh.castShadow = true;
    this.bottomBeamMesh.receiveShadow = true;
    housing.add(this.bottomBeamMesh);

    // Machined Steel Pedestal Feet
    const footGeo = new THREE.BoxGeometry(1.45, 0.22, 1.75);
    this.leftFootMesh = new THREE.Mesh(footGeo, brushedSteelMat);
    this.leftFootMesh.position.set(-2.55, DIMS_5.footY, -0.05);
    this.leftFootMesh.castShadow = true;
    housing.add(this.leftFootMesh);

    this.rightFootMesh = new THREE.Mesh(footGeo, brushedSteelMat);
    this.rightFootMesh.position.set(2.55, DIMS_5.footY, -0.05);
    this.rightFootMesh.castShadow = true;
    housing.add(this.rightFootMesh);

    // Brass trim inlay strips along top & bottom edges
    const trimBarGeo = new THREE.BoxGeometry(6.92, 0.055, 0.06);
    this.topTrimMesh = new THREE.Mesh(trimBarGeo, brassTrimMat);
    this.topTrimMesh.position.set(0, DIMS_5.housingHalfH + 0.06, 0.78);
    housing.add(this.topTrimMesh);

    this.bottomTrimMesh = new THREE.Mesh(trimBarGeo, brassTrimMat);
    this.bottomTrimMesh.position.set(0, -(DIMS_5.housingHalfH + 0.06), 0.78);
    housing.add(this.bottomTrimMesh);

    // Outer brass bearing pillow-block caps sliding in lockstep with upper/lower drive shafts
    const bearingCapGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.14, 20);
    bearingCapGeo.rotateZ(Math.PI / 2);
    for (const bx of [-3.65, 3.65]) {
      const topCap = new THREE.Mesh(bearingCapGeo, brassTrimMat);
      topCap.position.set(bx, 0, 0);
      this.upperBearingCapsGroup.add(topCap);

      const botCap = new THREE.Mesh(bearingCapGeo, brassTrimMat);
      botCap.position.set(bx, 0, 0);
      this.lowerBearingCapsGroup.add(botCap);
    }
    housing.add(this.upperBearingCapsGroup);
    housing.add(this.lowerBearingCapsGroup);

    // Grouped Hex-Socket Fastener Bolts sliding cleanly with top & bottom beams
    const boltGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.08, 6);
    boltGeo.rotateX(Math.PI / 2);
    const headerBoltOffsets: [number, number, number][] = [
      [-3.32, 0.08, 0.78],
      [-2.94, 0.08, 0.78],
      [2.94, 0.08, 0.78],
      [3.32, 0.08, 0.78],
      [-3.32, -0.28, 0.78],
      [3.32, -0.28, 0.78],
      [-1.34, 0.06, 0.78],
      [1.34, 0.06, 0.78],
    ];
    const dummy = new THREE.Object3D();

    const topBolts = new THREE.InstancedMesh(boltGeo, brushedSteelMat, headerBoltOffsets.length);
    headerBoltOffsets.forEach(([bx, by, bz], idx) => {
      dummy.position.set(bx, by, bz);
      dummy.updateMatrix();
      topBolts.setMatrixAt(idx, dummy.matrix);
    });
    topBolts.instanceMatrix.needsUpdate = true;
    topBolts.computeBoundingSphere();
    this.topBoltsGroup.add(topBolts);
    housing.add(this.topBoltsGroup);

    const botBolts = new THREE.InstancedMesh(boltGeo, brushedSteelMat, headerBoltOffsets.length);
    headerBoltOffsets.forEach(([bx, by, bz], idx) => {
      dummy.position.set(bx, -by, bz);
      dummy.updateMatrix();
      botBolts.setMatrixAt(idx, dummy.matrix);
    });
    botBolts.instanceMatrix.needsUpdate = true;
    botBolts.computeBoundingSphere();
    this.bottomBoltsGroup.add(botBolts);
    housing.add(this.bottomBoltsGroup);

    // 7 Persistent Recessed Row LED Strips & PointLights (constant light count -> zero shader stalls)
    const channelGeo = new THREE.BoxGeometry(0.18, 0.56, 0.14);
    const ledGeo = new THREE.BoxGeometry(0.1, 0.46, 0.08);

    for (let slot = 0; slot < 7; slot++) {
      const leftGroup = new THREE.Group();
      const rightGroup = new THREE.Group();

      const leftChannel = new THREE.Mesh(channelGeo, darkCavityMat);
      leftChannel.position.set(-2.92, 0, 0.76);
      leftGroup.add(leftChannel);

      const rightChannel = new THREE.Mesh(channelGeo, darkCavityMat);
      rightChannel.position.set(2.92, 0, 0.76);
      rightGroup.add(rightChannel);

      const leftMat = new THREE.MeshStandardMaterial({
        color: '#202631',
        emissive: COLOR_DIM_STRIP.clone(),
        emissiveIntensity: 0.14,
        roughness: 0.2,
        metalness: 0.1,
      });
      const rightMat = leftMat.clone();

      const leftLed = new THREE.Mesh(ledGeo, leftMat);
      leftLed.position.set(-2.92, 0, 0.8);
      leftGroup.add(leftLed);

      const rightLed = new THREE.Mesh(ledGeo, rightMat);
      rightLed.position.set(2.92, 0, 0.8);
      rightGroup.add(rightLed);

      housing.add(leftGroup);
      housing.add(rightGroup);

      const pt = new THREE.PointLight('#ffaa00', 0, 2.2, 2.0);
      pt.position.set(slot % 2 === 0 ? 2.86 : -2.86, LED_SLOT_Y5[slot], 1.12);
      housing.add(pt);

      this.rowLedPairs.push({
        slotIndex: slot,
        leftGroup,
        rightGroup,
        leftMat,
        rightMat,
        pointLight: pt,
        targetColor: COLOR_DIM_STRIP.clone(),
        targetIntensity: 0.14,
        y5: LED_SLOT_Y5[slot],
        y7: LED_SLOT_Y7[slot],
        isOuterOnly: slot === 0 || slot === 6,
      });
    }

    // Unlock Laser Relay Bars
    this.unlockLaserMat = new THREE.MeshStandardMaterial({
      color: '#0e1d16',
      emissive: COLOR_EMERALD.clone(),
      emissiveIntensity: 0.0,
      roughness: 0.15,
      metalness: 0.1,
    });
    this.topLaserMesh = new THREE.Mesh(new THREE.BoxGeometry(5.48, 0.045, 0.05), this.unlockLaserMat);
    this.topLaserMesh.position.set(0, DIMS_5.laserY, 0.74);
    housing.add(this.topLaserMesh);

    this.botLaserMesh = new THREE.Mesh(new THREE.BoxGeometry(5.48, 0.045, 0.05), this.unlockLaserMat);
    this.botLaserMesh.position.set(0, -DIMS_5.laserY, 0.74);
    housing.add(this.botLaserMesh);

    this.vaultHousingGroup.add(housing);
  }

  /**
   * Builds the singular interconnected conveyor drive chassis inside `conveyorMechanismGroup` ONCE.
   */
  private buildUnifiedConveyorDriveChassis(): void {
    const darkGuideMat = new THREE.MeshStandardMaterial({
      color: '#171c24',
      metalness: 0.65,
      roughness: 0.54,
    });

    const splinedSteelMat = new THREE.MeshPhysicalMaterial({
      color: '#6e7887',
      metalness: 0.88,
      roughness: 0.3,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
    });

    const guideGeo = new THREE.BoxGeometry(0.08, DIMS_5.guideH, 0.78);
    for (const cx of COUPLER_XS) {
      const guide = new THREE.Mesh(guideGeo, darkGuideMat);
      guide.position.set(cx, 0, -0.06);
      this.conveyorMechanismGroup.add(guide);
      this.trackGuides.push(guide);
    }

    // 5 horizontal cross-braces (3 visible on 5-row, all 5 visible on 7-row)
    const crossBraceGeo = new THREE.BoxGeometry(5.65, 0.11, 0.11);
    for (let i = 0; i < 5; i++) {
      const brace = new THREE.Mesh(crossBraceGeo, darkGuideMat);
      this.conveyorMechanismGroup.add(brace);
      this.crossBraces.push(brace);
    }

    const buildDriveShaftAssembly = (targetGroup: THREE.Group, yPos: number) => {
      targetGroup.position.set(0, yPos, 0);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 6.2, 20),
        splinedSteelMat
      );
      shaft.rotation.z = Math.PI / 2;
      targetGroup.add(shaft);

      const splineGeo = new THREE.BoxGeometry(5.8, 0.038, 0.038);
      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        const spline = new THREE.Mesh(splineGeo, this.brassHardwareMat);
        spline.position.set(0, Math.sin(ang) * 0.14, Math.cos(ang) * 0.14);
        targetGroup.add(spline);
      }

      const couplerHubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 20);
      couplerHubGeo.rotateZ(Math.PI / 2);
      const couplerToothGeo = new THREE.BoxGeometry(0.12, 0.065, 0.052);

      for (const cx of COUPLER_XS) {
        const hub = new THREE.Mesh(couplerHubGeo, this.brassHardwareMat);
        hub.position.x = cx;
        targetGroup.add(hub);

        for (let t = 0; t < 10; t++) {
          const ang = (t / 10) * Math.PI * 2;
          const tooth = new THREE.Mesh(couplerToothGeo, this.brassHardwareMat);
          tooth.position.set(cx, Math.sin(ang) * 0.255, Math.cos(ang) * 0.255);
          tooth.rotation.x = -ang;
          targetGroup.add(tooth);
        }
      }

      this.conveyorMechanismGroup.add(targetGroup);
    };

    buildDriveShaftAssembly(this.upperDriveShaftGroup, DIMS_5.halfStraight);
    buildDriveShaftAssembly(this.lowerDriveShaftGroup, -DIMS_5.halfStraight);

    const buildTensionShaft = (targetGroup: THREE.Group, yPos: number) => {
      targetGroup.position.set(0, yPos, 0.24);

      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 5.75, 16),
        splinedSteelMat
      );
      rod.rotation.z = Math.PI / 2;
      targetGroup.add(rod);

      const pulleyGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.11, 16);
      pulleyGeo.rotateZ(Math.PI / 2);
      const notchGeo = new THREE.BoxGeometry(0.12, 0.032, 0.032);

      for (const cx of COUPLER_XS) {
        const pulley = new THREE.Mesh(pulleyGeo, this.brassHardwareMat);
        pulley.position.x = cx;
        targetGroup.add(pulley);

        for (let n = 0; n < 6; n++) {
          const ang = (n / 6) * Math.PI * 2;
          const notch = new THREE.Mesh(notchGeo, darkGuideMat);
          notch.position.set(cx, Math.sin(ang) * 0.126, Math.cos(ang) * 0.126);
          notch.rotation.x = -ang;
          targetGroup.add(notch);
        }
      }

      this.conveyorMechanismGroup.add(targetGroup);
    };

    buildTensionShaft(this.upperTensionShaftGroup, DIMS_5.tensionY);
    buildTensionShaft(this.lowerTensionShaftGroup, -DIMS_5.tensionY);
  }

  /**
   * Persistent 3D Brushed-Steel Inspection Magnifying Bezel (smoothly scales Y on 5↔7 morph).
   */
  private buildInspectionMagnifyingBezel(): void {
    this.bezelGroup = new THREE.Group();
    this.bezelGroup.position.set(0, 0, 0.74);

    const brushedSteelMat = new THREE.MeshPhysicalMaterial({
      color: '#939ead',
      metalness: 0.9,
      roughness: 0.26,
      anisotropy: 0.82,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
      bumpMap: this.steelTex.bumpMap,
      bumpScale: 0.012,
    });

    const brassAccentMat = new THREE.MeshPhysicalMaterial({
      color: '#c09346',
      metalness: 0.92,
      roughness: 0.22,
      anisotropy: 0.72,
      map: this.brassTex.map,
      roughnessMap: this.brassTex.roughnessMap,
    });

    const outerW = 5.76;
    const outerH = DIMS_5.bezelOuterH;
    const innerW = 5.28;
    const innerH = DIMS_5.bezelInnerH;
    const rOut = 0.11;
    const rIn = 0.065;

    const frameShape = this.createRoundedRectShape(outerW, outerH, rOut);
    frameShape.holes.push(this.createRoundedRectPath(innerW, innerH, rIn));

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.17,
      bevelEnabled: true,
      bevelThickness: 0.032,
      bevelSize: 0.028,
      bevelSegments: 3,
    });
    frameGeo.center();

    const steelFrame = new THREE.Mesh(frameGeo, brushedSteelMat);
    steelFrame.castShadow = true;
    steelFrame.receiveShadow = true;
    this.bezelGroup.add(steelFrame);

    const lipShape = this.createRoundedRectShape(innerW + 0.09, innerH + 0.09, rIn + 0.02);
    lipShape.holes.push(this.createRoundedRectPath(innerW - 0.02, innerH - 0.02, rIn));
    const lipGeo = new THREE.ExtrudeGeometry(lipShape, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    lipGeo.center();

    const brassLip = new THREE.Mesh(lipGeo, brassAccentMat);
    brassLip.position.z = 0.065;
    this.bezelGroup.add(brassLip);

    const lensGeo = new THREE.PlaneGeometry(innerW - 0.04, innerH - 0.04, 24, 12);
    const posAttr = lensGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i) / (innerW * 0.5);
      const ly = posAttr.getY(i) / (innerH * 0.5);
      const curve = Math.max(0, 1 - ly * ly * 0.78 - lx * lx * 0.14) * 0.044;
      posAttr.setZ(i, curve);
    }
    lensGeo.computeVertexNormals();

    const lensMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0.0,
      roughness: 0.015,
      transmission: this.isSoftwareGl ? 0 : 0.9,
      transparent: this.isSoftwareGl,
      opacity: this.isSoftwareGl ? 0.12 : 1.0,
      ior: 1.34,
      thickness: 0.06,
      attenuationColor: new THREE.Color('#f7fbff'),
      attenuationDistance: 8.0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.22,
      depthWrite: false,
    });

    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.z = 0.05;
    lensMesh.renderOrder = 5;
    this.bezelGroup.add(lensMesh);

    this.bezelReticleMat = new THREE.MeshStandardMaterial({
      color: '#a8833e',
      emissive: new THREE.Color('#c89c48'),
      emissiveIntensity: 0.2,
      metalness: 0.85,
      roughness: 0.24,
    });

    const bracketCorners: [number, number][] = [
      [-2.82, DIMS_5.bezelBracketY],
      [2.82, DIMS_5.bezelBracketY],
      [-2.82, -DIMS_5.bezelBracketY],
      [2.82, -DIMS_5.bezelBracketY],
    ];
    for (const [bx, by] of bracketCorners) {
      const bH = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.042, 0.065), this.bezelReticleMat);
      bH.position.set(bx - Math.sign(bx) * 0.12, by, 0.115);
      this.bezelGroup.add(bH);

      const bV = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.19, 0.065), this.bezelReticleMat);
      bV.position.set(bx, by - Math.sign(by) * 0.08, 0.115);
      this.bezelGroup.add(bV);
    }

    const collarGeo = new THREE.CylinderGeometry(0.115, 0.135, 0.09, 18);
    collarGeo.rotateX(Math.PI / 2);
    const jewelGeo = new THREE.SphereGeometry(0.092, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    jewelGeo.rotateX(Math.PI / 2);

    WHEEL_XS.forEach((wx) => {
      const topCollar = new THREE.Mesh(collarGeo, brassAccentMat);
      topCollar.position.set(wx, DIMS_5.bezelPinY, 0.095);
      this.bezelGroup.add(topCollar);

      const botCollar = new THREE.Mesh(collarGeo, brassAccentMat);
      botCollar.position.set(wx, -DIMS_5.bezelPinY, 0.095);
      this.bezelGroup.add(botCollar);

      const topMat = new THREE.MeshPhysicalMaterial({
        color: '#2a2e35',
        emissive: COLOR_SLATE_LED.clone(),
        emissiveIntensity: 0.1,
        roughness: 0.14,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      const bottomMat = topMat.clone();

      const topJewel = new THREE.Mesh(jewelGeo, topMat);
      topJewel.position.set(wx, DIMS_5.bezelPinY, 0.115);
      this.bezelGroup.add(topJewel);

      const botJewel = new THREE.Mesh(jewelGeo, bottomMat);
      botJewel.position.set(wx, -DIMS_5.bezelPinY, 0.115);
      this.bezelGroup.add(botJewel);

      const pt = new THREE.PointLight('#00e676', 0, 1.5, 2.0);
      pt.position.set(wx, DIMS_5.bezelPinY + 0.04, 0.32);
      this.bezelGroup.add(pt);

      this.pinLamps.push({
        topMat,
        bottomMat,
        pointLight: pt,
        targetColor: COLOR_SLATE_LED.clone(),
        targetIntensity: 0.1,
      });
    });

    const lugGeo = new THREE.BoxGeometry(0.32, 0.36, 0.28);
    const leftLug = new THREE.Mesh(lugGeo, brushedSteelMat);
    leftLug.position.set(-2.98, 0, -0.06);
    this.bezelGroup.add(leftLug);

    const rightLug = new THREE.Mesh(lugGeo, brushedSteelMat);
    rightLug.position.set(2.98, 0, -0.06);
    this.bezelGroup.add(rightLug);

    this.vaultHousingGroup.add(this.bezelGroup);
  }

  /**
   * Physical Brass Release Lever mounted on the right side of the vault housing.
   */
  private buildBrassReleaseLever(): void {
    const brassMat = new THREE.MeshPhysicalMaterial({
      color: '#cfa04b',
      metalness: 0.94,
      roughness: 0.2,
      anisotropy: 0.75,
      map: this.brassTex.map,
      roughnessMap: this.brassTex.roughnessMap,
      bumpMap: this.brassTex.bumpMap,
      bumpScale: 0.01,
    });

    const darkBrassMat = new THREE.MeshPhysicalMaterial({
      color: '#7f5e24',
      metalness: 0.9,
      roughness: 0.32,
      map: this.brassTex.map,
    });

    const eboniteGripMat = new THREE.MeshStandardMaterial({
      color: '#1b1d22',
      metalness: 0.15,
      roughness: 0.52,
    });

    const mountGroup = new THREE.Group();
    mountGroup.position.set(3.66, 0.0, -0.05);

    const basePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.68, 0.24, 32),
      darkBrassMat
    );
    basePlate.rotation.z = Math.PI / 2;
    basePlate.castShadow = true;
    mountGroup.add(basePlate);

    const hubBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.44, 0.42, 24),
      brassMat
    );
    hubBoss.rotation.z = Math.PI / 2;
    hubBoss.position.x = 0.18;
    hubBoss.castShadow = true;
    mountGroup.add(hubBoss);

    const stopGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12);
    stopGeo.rotateZ(Math.PI / 2);
    const upperStop = new THREE.Mesh(stopGeo, brassMat);
    upperStop.position.set(0.14, 0.48, 0.24);
    mountGroup.add(upperStop);

    const lowerStop = new THREE.Mesh(stopGeo, brassMat);
    lowerStop.position.set(0.14, -0.48, 0.24);
    mountGroup.add(lowerStop);

    this.leverPivot = new THREE.Group();
    this.leverPivot.position.set(0.36, 0, 0);
    this.leverPivot.rotation.x = -this.leverAngle;

    const capNut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 6), brassMat);
    capNut.rotation.z = Math.PI / 2;
    capNut.position.x = 0.08;
    this.leverPivot.add(capNut);

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(0.14, 0.0, 0.72),
      new THREE.Vector3(0.22, 0.0, 1.55),
      new THREE.Vector3(0.24, 0.0, 2.08),
    ]);
    const armGeo = new THREE.TubeGeometry(armCurve, 24, 0.105, 16, false);
    const armMesh = new THREE.Mesh(armGeo, brassMat);
    armMesh.castShadow = true;
    this.leverPivot.add(armMesh);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.14, 20), darkBrassMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(0.32, 0, 2.08);
    this.leverPivot.add(collar);

    const gripCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.72, 24),
      eboniteGripMat
    );
    gripCore.rotation.z = Math.PI / 2;
    gripCore.position.set(0.68, 0, 2.08);
    gripCore.castShadow = true;
    this.leverPivot.add(gripCore);

    const gripEndCap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 16), brassMat);
    gripEndCap.position.set(1.04, 0, 2.08);
    gripEndCap.castShadow = true;
    this.leverPivot.add(gripEndCap);

    for (const gx of [0.46, 0.68, 0.9]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.192, 0.018, 10, 24), brassMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(gx, 0, 2.08);
      this.leverPivot.add(ring);
    }

    mountGroup.add(this.leverPivot);
    this.vaultHousingGroup.add(mountGroup);
  }

  /**
   * Central heavy machined steel locking deadbolt protruding from the left pillar.
   */
  private buildLockingDeadbolt(): void {
    const steelMat = new THREE.MeshPhysicalMaterial({
      color: '#aeb8c6',
      metalness: 0.94,
      roughness: 0.18,
      anisotropy: 0.85,
      map: this.steelTex.map,
      roughnessMap: this.steelTex.roughnessMap,
    });

    const brassCollarMat = new THREE.MeshPhysicalMaterial({
      color: '#c09346',
      metalness: 0.92,
      roughness: 0.24,
      map: this.brassTex.map,
    });

    const bushing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.5, 0.22, 28),
      brassCollarMat
    );
    bushing.rotation.z = Math.PI / 2;
    bushing.position.set(-3.68, 0, -0.05);
    bushing.castShadow = true;
    this.vaultHousingGroup.add(bushing);

    this.deadboltGroup = new THREE.Group();
    this.deadboltGroup.position.set(this.boltPositionX, 0, -0.05);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.35, 28), steelMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = -0.65;
    shaft.castShadow = true;
    this.deadboltGroup.add(shaft);

    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.18, 28), steelMat);
    nose.rotation.z = Math.PI / 2;
    nose.position.x = -1.41;
    this.deadboltGroup.add(nose);

    for (const gx of [-0.95, -1.15]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 10, 28), brassCollarMat);
      band.rotation.y = Math.PI / 2;
      band.position.x = gx;
      this.deadboltGroup.add(band);
    }

    this.vaultHousingGroup.add(this.deadboltGroup);
  }

  /**
   * Builds morphable upper/lower hit proxies & 3D machined brass Up (▲) and Down (▼) chevron buttons.
   */
  private buildHitProxies(): void {
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const halfProxyH = DIMS_5.innerChamberH * 0.48;
    const proxyGeo = new THREE.BoxGeometry(1.26, halfProxyH, 1.25);

    const brassButtonMat = new THREE.MeshPhysicalMaterial({
      color: '#c49748',
      metalness: 0.92,
      roughness: 0.22,
      map: this.brassTex.map,
      roughnessMap: this.brassTex.roughnessMap,
    });
    const buttonBaseMat = new THREE.MeshStandardMaterial({
      color: '#181d26',
      metalness: 0.82,
      roughness: 0.36,
    });

    const upChevronShape = new THREE.Shape();
    upChevronShape.moveTo(0, 0.11);
    upChevronShape.lineTo(0.16, -0.07);
    upChevronShape.lineTo(-0.16, -0.07);
    upChevronShape.closePath();

    const chevronGeo = new THREE.ExtrudeGeometry(upChevronShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    chevronGeo.center();

    const padGeo = new THREE.BoxGeometry(0.64, 0.28, 0.1);
    const btnHitGeo = new THREE.BoxGeometry(0.92, 0.48, 0.45);

    WHEEL_XS.forEach((wx, col) => {
      const upperProxy = new THREE.Mesh(proxyGeo, proxyMat);
      upperProxy.position.set(wx, halfProxyH * 0.5, 0.58);
      upperProxy.userData = { col, half: 'up' as const, isChevron: false };
      this.upperProxyGroup.add(upperProxy);
      this.hitProxies.push(upperProxy);

      const lowerProxy = new THREE.Mesh(proxyGeo, proxyMat);
      lowerProxy.position.set(wx, -halfProxyH * 0.5, 0.58);
      lowerProxy.userData = { col, half: 'down' as const, isChevron: false };
      this.lowerProxyGroup.add(lowerProxy);
      this.hitProxies.push(lowerProxy);

      const upPad = new THREE.Mesh(padGeo, buttonBaseMat);
      upPad.position.set(wx, 0, 0.78);
      this.upChevronGroup.add(upPad);

      const upChevron = new THREE.Mesh(chevronGeo, brassButtonMat);
      upChevron.position.set(wx, 0.01, 0.85);
      this.upChevronGroup.add(upChevron);

      const upBtnProxy = new THREE.Mesh(btnHitGeo, proxyMat);
      upBtnProxy.position.set(wx, 0, 0.86);
      upBtnProxy.userData = { col, half: 'up' as const, isChevron: true };
      this.upChevronGroup.add(upBtnProxy);
      this.hitProxies.push(upBtnProxy);

      const downPad = new THREE.Mesh(padGeo, buttonBaseMat);
      downPad.position.set(wx, 0, 0.78);
      this.downChevronGroup.add(downPad);

      const downChevron = new THREE.Mesh(chevronGeo, brassButtonMat);
      downChevron.rotation.z = Math.PI;
      downChevron.position.set(wx, -0.01, 0.85);
      this.downChevronGroup.add(downChevron);

      const downBtnProxy = new THREE.Mesh(btnHitGeo, proxyMat);
      downBtnProxy.position.set(wx, 0, 0.86);
      downBtnProxy.userData = { col, half: 'down' as const, isChevron: true };
      this.downChevronGroup.add(downBtnProxy);
      this.hitProxies.push(downBtnProxy);
    });

    this.vaultHousingGroup.add(this.upperProxyGroup);
    this.vaultHousingGroup.add(this.lowerProxyGroup);
    this.vaultHousingGroup.add(this.upChevronGroup);
    this.vaultHousingGroup.add(this.downChevronGroup);
  }

  /**
   * Builds a clutched brass sprocket drum mounted concentrically onto the shared upper/lower drive shaft.
   */
  private createClutchSprocketDrum(): THREE.Group {
    const roller = new THREE.Group();
    const coreRadius = DIMS_5.rollerRadius - 0.05;

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius, coreRadius, SLAT_WIDTH - 0.14, 24),
      this.rollerCoreMat
    );
    drum.rotation.z = Math.PI / 2;
    drum.castShadow = true;
    roller.add(drum);

    const sprocketRadius = DIMS_5.rollerRadius - 0.018;
    const ringGeo = new THREE.CylinderGeometry(sprocketRadius, sprocketRadius, 0.075, 24);
    ringGeo.rotateZ(Math.PI / 2);

    const toothGeo = new THREE.BoxGeometry(0.06, 0.08, 0.055);
    const toothCount = 12;

    for (const sideX of [-(SLAT_WIDTH / 2 + 0.015), SLAT_WIDTH / 2 + 0.015]) {
      const ring = new THREE.Mesh(ringGeo, this.brassHardwareMat);
      ring.position.x = sideX;
      roller.add(ring);

      for (let t = 0; t < toothCount; t++) {
        const ang = (t / toothCount) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeo, this.brassHardwareMat);
        tooth.position.set(
          sideX,
          Math.sin(ang) * (sprocketRadius + 0.018),
          Math.cos(ang) * (sprocketRadius + 0.018)
        );
        tooth.rotation.x = -ang;
        roller.add(tooth);
      }
    }

    return roller;
  }

  /**
   * Pre-allocates the 4 interconnected conveyor tracks with MAX_SLAT_POOL (14) slats & chain links
   * ONCE at startup. Switching puzzles or 5↔7 rows simply swaps cached textures and toggles slot visibility.
   */
  private buildPersistentTrackPool(): void {
    const defaultTex = this.letterCache.get('A');

    for (let col = 0; col < 4; col++) {
      const trackGroup = new THREE.Group();
      trackGroup.position.set(WHEEL_XS[col], 0, 0);

      const upperClutchSprocket = this.createClutchSprocketDrum();
      upperClutchSprocket.position.set(0, DIMS_5.halfStraight, 0);
      trackGroup.add(upperClutchSprocket);

      const lowerClutchSprocket = this.createClutchSprocketDrum();
      lowerClutchSprocket.position.set(0, -DIMS_5.halfStraight, 0);
      trackGroup.add(lowerClutchSprocket);

      const slats: BeltSlatUnit[] = [];
      for (let slot = 0; slot < MAX_SLAT_POOL; slot++) {
        const slatGroup = new THREE.Group();

        const body = new THREE.Mesh(this.slatBodyGeo, this.slatBodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        slatGroup.add(body);

        for (const sx of [-(SLAT_WIDTH / 2 + 0.01), SLAT_WIDTH / 2 + 0.01]) {
          for (const sy of [-DIMS_5.slatHeight * 0.36, DIMS_5.slatHeight * 0.36]) {
            const lug = new THREE.Mesh(this.hingeLugGeo, this.brassHardwareMat);
            lug.position.set(sx, sy, -0.01);
            slatGroup.add(lug);
          }
        }

        const faceMat = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          map: defaultTex.map,
          bumpMap: defaultTex.bumpMap,
          bumpScale: 0.022,
          roughnessMap: defaultTex.roughnessMap,
          roughness: 0.58,
          metalness: 0.34,
          envMapIntensity: 0.42,
          emissive: COLOR_ENAMEL_GLOW.clone(),
          emissiveMap: defaultTex.emissiveMap,
          emissiveIntensity: 0.28,
        });

        const faceMesh = new THREE.Mesh(this.slatFaceGeo, faceMat);
        faceMesh.position.z = SLAT_THICKNESS / 2 + 0.005;
        faceMesh.castShadow = true;
        faceMesh.receiveShadow = true;
        slatGroup.add(faceMesh);

        trackGroup.add(slatGroup);
        slats.push({ slotIndex: slot, group: slatGroup, faceMat });
      }

      const chainLinks: THREE.Group[] = [];
      for (let i = 0; i < MAX_SLAT_POOL; i++) {
        const linkPair = new THREE.Group();
        for (const sideX of [-(SLAT_WIDTH / 2 + 0.022), SLAT_WIDTH / 2 + 0.022]) {
          const plate = new THREE.Mesh(this.chainPlateGeo, this.chainSteelMat);
          plate.position.set(sideX, 0, -0.01);
          linkPair.add(plate);

          const pin = new THREE.Mesh(this.chainPinGeo, this.brassHardwareMat);
          pin.position.set(sideX, 0, -0.01);
          linkPair.add(pin);
        }
        trackGroup.add(linkPair);
        chainLinks.push(linkPair);
      }

      this.beltTracksGroup.add(trackGroup);
      this.tracks.push({
        col,
        trackGroup,
        slats,
        chainLinks,
        upperClutchSprocket,
        lowerClutchSprocket,
        currentSteps: 0,
        targetSteps: 0,
        stepVelocity: 0,
        hoverIntensity: 0,
      });
    }
  }

  /**
   * Smoothly applies morph factor `t` (0 = 5-row vault, 1 = 7-row vault) to every outer housing beam,
   * pillar, bearing cap, bolt cluster, LED strip, magnifying bezel, chevron actuator, and studio plinth.
   */
  private applyVaultMorph(t: number): void {
    const beamY = THREE.MathUtils.lerp(DIMS_5.beamY, DIMS_7.beamY, t);
    const halfH = THREE.MathUtils.lerp(DIMS_5.housingHalfH, DIMS_7.housingHalfH, t);
    const halfStraight = THREE.MathUtils.lerp(DIMS_5.halfStraight, DIMS_7.halfStraight, t);
    const laserY = THREE.MathUtils.lerp(DIMS_5.laserY, DIMS_7.laserY, t);
    const footY = THREE.MathUtils.lerp(DIMS_5.footY, DIMS_7.footY, t);

    this.backPlateMesh.scale.y = THREE.MathUtils.lerp(1, DIMS_7.backPlateH / DIMS_5.backPlateH, t);
    this.innerChamberMesh.scale.y = THREE.MathUtils.lerp(
      1,
      DIMS_7.innerChamberH / DIMS_5.innerChamberH,
      t
    );
    const pillarScaleY = halfH / DIMS_5.housingHalfH;
    this.leftPillarMesh.scale.y = pillarScaleY;
    this.rightPillarMesh.scale.y = pillarScaleY;

    this.topBeamMesh.position.y = beamY;
    this.bottomBeamMesh.position.y = -beamY;

    this.topTrimMesh.position.y = halfH + 0.06;
    this.bottomTrimMesh.position.y = -(halfH + 0.06);

    this.topLaserMesh.position.y = laserY;
    this.botLaserMesh.position.y = -laserY;

    this.leftFootMesh.position.y = footY;
    this.rightFootMesh.position.y = footY;

    this.plinthMesh.position.y = THREE.MathUtils.lerp(DIMS_5.plinthY, DIMS_7.plinthY, t);
    this.shadowPlaneMesh.position.y = THREE.MathUtils.lerp(DIMS_5.shadowY, DIMS_7.shadowY, t);

    this.upperBearingCapsGroup.position.y = halfStraight;
    this.lowerBearingCapsGroup.position.y = -halfStraight;

    this.topBoltsGroup.position.y = beamY;
    this.bottomBoltsGroup.position.y = -beamY;

    this.upChevronGroup.position.y = beamY;
    this.downChevronGroup.position.y = -beamY;

    const proxyScaleY = THREE.MathUtils.lerp(1, DIMS_7.innerChamberH / DIMS_5.innerChamberH, t);
    this.upperProxyGroup.scale.y = proxyScaleY;
    this.lowerProxyGroup.scale.y = proxyScaleY;

    // Magnifying bezel compresses sleekly for 7-row spacing without blocking Row 3 or Row 5
    this.bezelGroup.scale.y = THREE.MathUtils.lerp(1, DIMS_7.bezelOuterH / DIMS_5.bezelOuterH, t);

    // 7 Persistent Row LED Strips glide smoothly between 5-row and 7-row row centers
    const innerLedScaleY = THREE.MathUtils.lerp(1, 0.78, t);
    for (const led of this.rowLedPairs) {
      const ly = THREE.MathUtils.lerp(led.y5, led.y7, t);
      led.leftGroup.position.y = ly;
      led.rightGroup.position.y = ly;
      led.pointLight.position.y = ly;

      if (led.isOuterOnly) {
        const s = Math.max(0.001, t * 0.78);
        const show = t > 0.03;
        led.leftGroup.visible = show;
        led.rightGroup.visible = show;
        led.leftGroup.scale.y = s;
        led.rightGroup.scale.y = s;
      } else {
        led.leftGroup.visible = true;
        led.rightGroup.visible = true;
        led.leftGroup.scale.y = innerLedScaleY;
        led.rightGroup.scale.y = innerLedScaleY;
      }
    }
  }

  /**
   * Synchronizes all 4 conveyor tracks + shared upper/lower main drive shafts +
   * inter-column differential coupling gears + horizontal tensioner shafts as one unified assembly.
   */
  private updateUnifiedConveyorKinematics(): void {
    const d = this.dims;
    let totalStepsSum = 0;

    for (let c = 0; c < this.tracks.length; c++) {
      const track = this.tracks[c];
      const sShift = track.currentSteps;
      totalStepsSum += sShift;

      for (let i = 0; i < d.slatCount; i++) {
        const slat = track.slats[i];
        const s = (slat.slotIndex - d.masterRowIndex - sShift) * d.slatPitch;
        sampleStadiumBelt(s, 0, d, _poseOut);
        slat.group.position.set(0, _poseOut.y, _poseOut.z);
        slat.group.rotation.x = _poseOut.rotX;
      }

      for (let i = 0; i < d.slatCount; i++) {
        const link = track.chainLinks[i];
        const sMid = (i - (d.masterRowIndex - 0.5) - sShift) * d.slatPitch;
        sampleStadiumBelt(sMid, -0.015, d, _poseOut);
        link.position.set(0, _poseOut.y, _poseOut.z);
        link.rotation.x = _poseOut.rotX;
      }

      const trackRollerAngle = -(sShift * d.slatPitch) / d.rollerRadius;
      track.upperClutchSprocket.rotation.x = trackRollerAngle;
      track.lowerClutchSprocket.rotation.x = trackRollerAngle;
    }

    this.sharedDriveAngle = -((totalStepsSum * 0.5) * d.slatPitch) / d.rollerRadius;
    this.upperDriveShaftGroup.rotation.x = this.sharedDriveAngle;
    this.lowerDriveShaftGroup.rotation.x = this.sharedDriveAngle;

    this.upperTensionShaftGroup.rotation.x = -this.sharedDriveAngle * 1.45;
    this.lowerTensionShaftGroup.rotation.x = -this.sharedDriveAngle * 1.45;
  }

  /**
   * Loads a new puzzle (5-row or 7-row) in < 1ms with ZERO geometry disposal,
   * ZERO material creation, and ZERO WebGL shader recompilation, smoothly morphing
   * the vault housing, conveyor scale, LED strips, and camera framing together.
   */
  public loadPuzzle(
    puzzle: PuzzleDefinition,
    initialSteps: [number, number, number, number],
    evaluation: BoardEvaluation
  ): void {
    this.activeDrag = null;

    const prevDims = this.dims;
    const nextDims = puzzle.rowCount === 7 ? DIMS_7 : DIMS_5;
    const rowCountChanged = prevDims.rowCount !== nextDims.rowCount;
    this.dims = nextDims;
    this.rowMorphTarget = nextDims.rowCount === 7 ? 1 : 0;

    // Seamless scale handoff so conveyor drive shafts stay locked to bearing caps while morphing
    if (this.prefersReducedMotion || !this.hasLoadedOnce) {
      this.rowMorph = this.rowMorphTarget;
      this.conveyorMorphScaleY = 1;
      this.applyVaultMorph(this.rowMorph);
    } else if (rowCountChanged) {
      const currentVisualHalfStraight = THREE.MathUtils.lerp(
        DIMS_5.halfStraight,
        DIMS_7.halfStraight,
        this.rowMorph
      );
      this.conveyorMorphScaleY = currentVisualHalfStraight / nextDims.halfStraight;
    }

    // Reposition shared shafts & chassis guides inside conveyorMechanismGroup for active rowCount
    this.upperDriveShaftGroup.position.y = nextDims.halfStraight;
    this.lowerDriveShaftGroup.position.y = -nextDims.halfStraight;
    this.upperTensionShaftGroup.position.y = nextDims.tensionY;
    this.lowerTensionShaftGroup.position.y = -nextDims.tensionY;

    const guideScaleY = nextDims.guideH / DIMS_5.guideH;
    for (const guide of this.trackGuides) {
      guide.scale.y = guideScaleY;
    }

    const braceYs =
      nextDims.rowCount === 7 ? [1.6, 0.8, 0, -0.8, -1.6] : [0.94, 0, -0.94, 0, 0];
    this.crossBraces.forEach((brace, idx) => {
      const active = nextDims.rowCount === 7 ? true : idx < 3;
      brace.visible = active;
      brace.position.set(0, braceYs[idx], 0);
    });

    // Reset unlock, deadbolt, seat & lever states
    this.unlockCascadeActive = false;
    this.unlockCascadeTime = 0;
    this.boltTargetX = -3.38;
    this.boltPositionX = -3.38;
    this.deadboltGroup.position.x = this.boltPositionX;
    this.leverTargetAngle = 0.62;
    this.leverAngle = 0.62;
    this.leverVelocity = 0;
    this.leverPivot.rotation.x = -this.leverAngle;
    this.assemblySeatTargetZ = 0;
    this.assemblySeatZ = 0;
    this.unlockLaserMat.emissiveIntensity = 0;

    const animateEntry = this.hasLoadedOnce && !this.prefersReducedMotion;
    this.hasLoadedOnce = true;

    const slatScaleY = nextDims.slatHeight / DIMS_5.slatHeight;
    const rollerScale = nextDims.rollerRadius / DIMS_5.rollerRadius;

    for (let col = 0; col < 4; col++) {
      const track = this.tracks[col];

      // Seat clutched brass sprockets cleanly at active drive shaft elevation
      track.upperClutchSprocket.position.y = nextDims.halfStraight;
      track.lowerClutchSprocket.position.y = -nextDims.halfStraight;
      track.upperClutchSprocket.scale.set(1, rollerScale, rollerScale);
      track.lowerClutchSprocket.scale.set(1, rollerScale, rollerScale);

      // Reassign cached A–Z textures in O(1) without allocating a single material or mesh
      for (let slot = 0; slot < MAX_SLAT_POOL; slot++) {
        const slat = track.slats[slot];
        const active = slot < nextDims.slatCount;
        slat.group.visible = active;
        if (active) {
          const letter = puzzle.wheels[col][slot % nextDims.rowCount];
          const texSet = this.letterCache.get(letter);
          if (slat.faceMat.map !== texSet.map) {
            slat.faceMat.map = texSet.map;
            slat.faceMat.bumpMap = texSet.bumpMap;
            slat.faceMat.roughnessMap = texSet.roughnessMap;
            slat.faceMat.emissiveMap = texSet.emissiveMap;
          }
          slat.group.scale.y = slatScaleY;
        }
      }

      for (let i = 0; i < MAX_SLAT_POOL; i++) {
        track.chainLinks[i].visible = i < nextDims.slatCount;
      }

      // Smooth cascading roll on puzzle switches
      const entryOffset = animateEntry
        ? initialSteps[col] - (1.05 + col * 0.28)
        : initialSteps[col];
      track.currentSteps = entryOffset;
      track.targetSteps = initialSteps[col];
      track.stepVelocity = 0;
    }

    this.conveyorMechanismGroup.scale.y = this.conveyorMorphScaleY;
    this.conveyorMechanismGroup.position.set(0, this.assemblyRecoilY, this.assemblySeatZ);
    this.updateUnifiedConveyorKinematics();
    this.syncEvaluationState(initialSteps, evaluation, false);

    if (this.prefersReducedMotion || !this.cameraInitialized) {
      this.updateCameraTransform(
        Math.max(this.container.clientWidth, 320),
        Math.max(this.container.clientHeight, 240),
        0,
        true
      );
    }
  }

  /**
   * Smoothly updates independent column targets, triggers unified mechanical recoil impulse,
   * and synchronizes LED strips, Master Key pins, brass lever, and deadbolt state.
   */
  public syncEvaluationState(
    wheelSteps: [number, number, number, number],
    evaluation: BoardEvaluation,
    isUnlockingOrWon: boolean
  ): void {
    let impulseDir = 0;

    for (let col = 0; col < 4; col++) {
      const track = this.tracks[col];
      if (!track) continue;
      const delta = wheelSteps[col] - track.targetSteps;
      if (delta !== 0) {
        impulseDir += Math.sign(delta);
      }
      track.targetSteps = wheelSteps[col];
      if (this.prefersReducedMotion) {
        track.currentSteps = track.targetSteps;
        track.stepVelocity = 0;
      }
    }

    if (this.prefersReducedMotion) {
      this.updateUnifiedConveyorKinematics();
    } else if (impulseDir !== 0) {
      this.assemblyRecoilVel += Math.sign(impulseDir) * 0.24;
    }

    // Map 5 or 7 row states into the 7 persistent LED slots (5-row uses slots 1..5; 7-row uses 0..6)
    const slotOffset = this.dims.rowCount === 5 ? 1 : 0;

    for (let slot = 0; slot < 7; slot++) {
      const led = this.rowLedPairs[slot];
      const rowIdx = slot - slotOffset;
      if (rowIdx < 0 || rowIdx >= evaluation.rowValid.length) {
        led.targetColor.copy(COLOR_DIM_STRIP);
        led.targetIntensity = 0;
        continue;
      }

      const valid = evaluation.rowValid[rowIdx];
      if (isUnlockingOrWon) {
        led.targetColor.copy(COLOR_EMERALD);
        led.targetIntensity = 1.2;
      } else if (rowIdx === this.dims.masterRowIndex) {
        if (evaluation.isMasterKeyMatched) {
          led.targetColor.copy(COLOR_EMERALD);
          led.targetIntensity = 1.1;
        } else if (valid) {
          led.targetColor.copy(COLOR_AMBER);
          led.targetIntensity = 0.8;
        } else {
          led.targetColor.copy(COLOR_DIM_STRIP);
          led.targetIntensity = 0.14;
        }
      } else if (valid) {
        led.targetColor.copy(COLOR_AMBER);
        led.targetIntensity = 1.05;
      } else {
        led.targetColor.copy(COLOR_DIM_STRIP);
        led.targetIntensity = 0.14;
      }
    }

    // Four Jeweled Master Key Deduction Pins (Center Row)
    evaluation.masterKeyPins.forEach((pinState: PinState, col: number) => {
      const lamp = this.pinLamps[col];
      if (!lamp) return;

      if (pinState === 'green') {
        lamp.targetColor.copy(COLOR_EMERALD);
        lamp.targetIntensity = 1.05;
      } else if (pinState === 'amber') {
        lamp.targetColor.copy(COLOR_PIN_AMBER);
        lamp.targetIntensity = 0.95;
      } else {
        lamp.targetColor.copy(COLOR_SLATE_LED);
        lamp.targetIntensity = 0.1;
      }
    });

    this.leverTargetAngle = evaluation.allRowsValid || isUnlockingOrWon ? -0.96 : 0.62;

    if (isUnlockingOrWon) {
      this.boltTargetX = -2.58;
      this.assemblySeatTargetZ = -0.055;
      if (!this.unlockCascadeActive) {
        this.unlockCascadeActive = true;
        this.unlockCascadeTime = 0;
      }
    } else {
      this.boltTargetX = -3.38;
      this.assemblySeatTargetZ = 0;
      this.unlockCascadeActive = false;
    }
  }

  public setInteractionLocked(locked: boolean): void {
    this.interactionLocked = locked;
    if (locked) {
      this.activeDrag = null;
      this.hoveredCol = null;
      this.hoveredHalf = null;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  public setMaxDragSteps(clicksRemaining: number): void {
    this.maxDragSteps = Math.max(0, clicksRemaining);
  }

  private createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
    const s = new THREE.Shape();
    const hw = w / 2;
    const hh = h / 2;
    s.moveTo(-hw + r, -hh);
    s.lineTo(hw - r, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + r);
    s.lineTo(hw, hh - r);
    s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(-hw + r, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - r);
    s.lineTo(-hw, -hh + r);
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return s;
  }

  private createRoundedRectPath(w: number, h: number, r: number): THREE.Path {
    const p = new THREE.Path();
    const hw = w / 2;
    const hh = h / 2;
    p.moveTo(-hw + r, -hh);
    p.lineTo(hw - r, -hh);
    p.quadraticCurveTo(hw, -hh, hw, -hh + r);
    p.lineTo(hw, hh - r);
    p.quadraticCurveTo(hw, hh, hw - r, hh);
    p.lineTo(-hw + r, hh);
    p.quadraticCurveTo(-hw, hh, -hw, hh - r);
    p.lineTo(-hw, -hh + r);
    p.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return p;
  }

  /**
   * Responsive camera framing with smooth damping during 5↔7 row transitions and
   * top-anchored mobile portrait framing to eliminate blank top space.
   */
  private updateCameraTransform(width: number, height: number, dt: number, immediate = false): void {
    const aspect = width / Math.max(height, 1);
    const mobileFactor = THREE.MathUtils.clamp((0.95 - aspect) / 0.45, 0, 1);

    // Derive target geometric span smoothly from rowMorph so camera tracks vault expansion
    const baseDist = THREE.MathUtils.lerp(
      DIMS_5.baseCameraDist,
      DIMS_7.baseCameraDist,
      this.rowMorphTarget
    );
    const vaultTotalH = THREE.MathUtils.lerp(
      DIMS_5.vaultTotalHeight,
      DIMS_7.vaultTotalHeight,
      this.rowMorphTarget
    );
    const housingHalfH = THREE.MathUtils.lerp(
      DIMS_5.housingHalfH,
      DIMS_7.housingHalfH,
      this.rowMorphTarget
    );

    const targetFov = 34 + mobileFactor * 4.0;
    const vTan = Math.tan(THREE.MathUtils.degToRad(targetFov * 0.5));

    let targetDist: number;
    if (aspect < 0.95) {
      const fitWidth = 7.65;
      const distForWidth = (fitWidth * 0.5) / (vTan * Math.max(aspect, 0.38));
      const distForHeight = (vaultTotalH * 1.46) / (2 * vTan);
      const mobileDist = Math.max(baseDist, Math.max(distForWidth, distForHeight));
      const tabletDist = baseDist * 1.1;
      targetDist = THREE.MathUtils.lerp(tabletDist, mobileDist, mobileFactor);
    } else if (aspect < 1.35) {
      targetDist = baseDist * 1.09;
    } else {
      targetDist = baseDist;
    }

    const visibleH = 2 * Math.max(targetDist - 0.5, 4) * vTan;
    const vaultTopY = housingHalfH + 0.16;
    const desiredTopOffset = visibleH * (0.5 - 0.115);
    const mobileLookAtY = Math.min(-0.2, vaultTopY - desiredTopOffset);
    const desktopLookAtY = -0.08;

    const targetLookAtX = THREE.MathUtils.lerp(0.22, 0.04, mobileFactor);
    const targetLookAtY = THREE.MathUtils.lerp(desktopLookAtY, mobileLookAtY, mobileFactor);

    if (immediate || !this.cameraInitialized || this.prefersReducedMotion) {
      this.currentCameraDist = targetDist;
      this.currentCameraFov = targetFov;
      this.currentLookAtX = targetLookAtX;
      this.currentLookAtY = targetLookAtY;
      this.cameraInitialized = true;
    } else {
      this.currentCameraDist = THREE.MathUtils.damp(this.currentCameraDist, targetDist, 9.5, dt);
      this.currentCameraFov = THREE.MathUtils.damp(this.currentCameraFov, targetFov, 9.5, dt);
      this.currentLookAtX = THREE.MathUtils.damp(this.currentLookAtX, targetLookAtX, 9.5, dt);
      this.currentLookAtY = THREE.MathUtils.damp(this.currentLookAtY, targetLookAtY, 9.5, dt);
    }

    const projChanged =
      Math.abs(this.camera.fov - this.currentCameraFov) > 0.001 ||
      Math.abs(this.camera.aspect - aspect) > 0.0001;
    if (projChanged) {
      this.camera.fov = this.currentCameraFov;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    const effYaw = THREE.MathUtils.lerp(this.currentYaw, this.currentYaw * 0.42, mobileFactor);
    const effPitch = THREE.MathUtils.lerp(
      this.currentPitch,
      THREE.MathUtils.degToRad(4.8),
      mobileFactor
    );

    const x = this.currentLookAtX + this.currentCameraDist * Math.sin(effYaw) * Math.cos(effPitch);
    const y =
      this.currentLookAtY +
      this.currentCameraDist * Math.sin(effPitch) +
      (1 - mobileFactor) * 0.08;
    const z = this.currentCameraDist * Math.cos(effYaw) * Math.cos(effPitch);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.currentLookAtX, this.currentLookAtY, 0);
  }

  /**
   * Computes exact screen-space pixel height of one conveyor slat at the front plane of column `col`.
   */
  private computePixelsPerSlat(col: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const wx = WHEEL_XS[col] ?? 0;
    const frontZ = this.dims.rollerRadius + SLAT_THICKNESS * 0.5;

    _projA.set(wx, 0, frontZ).project(this.camera);
    _projB.set(wx, this.dims.slatPitch, frontZ).project(this.camera);

    const dyNdc = Math.abs(_projB.y - _projA.y);
    const px = dyNdc * 0.5 * rect.height;
    return Math.max(px, 34);
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointercancel', this.handlePointerCancel);
    dom.addEventListener('pointerleave', this.handlePointerLeave);
    dom.addEventListener('wheel', this.handleWheel, { passive: false });
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleResize);
  }

  private updateMouseNdc(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastWheel(
    clientX: number,
    clientY: number
  ): { col: number; half: 'up' | 'down'; isChevron: boolean } | null {
    this.updateMouseNdc(clientX, clientY);
    this.raycaster.setFromCamera(_mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitProxies, false);
    if (hits.length === 0) return null;
    const { col, half, isChevron } = hits[0].object.userData as {
      col: number;
      half: 'up' | 'down';
      isChevron: boolean;
    };
    return { col, half, isChevron: Boolean(isChevron) };
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.interactionLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const hit = this.raycastWheel(e.clientX, e.clientY);
    if (!hit) return;

    const track = this.tracks[hit.col];
    if (!track) return;

    if (hit.isChevron) {
      this.callbacks.onWheelRotate(hit.col, hit.half === 'up' ? 1 : -1);
      return;
    }

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }

    this.hoveredCol = hit.col;
    this.hoveredHalf = hit.half;
    this.callbacks.onHoverWheelChange?.(hit.col, hit.half);
    this.renderer.domElement.style.cursor = 'grabbing';

    this.activeDrag = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      col: hit.col,
      hitHalf: hit.half,
      isChevronButton: false,
      startX: e.clientX,
      startY: e.clientY,
      startTimeMs: performance.now(),
      baseSteps: track.targetSteps,
      visualSteps: 0,
      lastDetentIndex: 0,
      hasDragged: false,
      pixelsPerSlat: this.computePixelsPerSlat(hit.col),
    };
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();

    if (e.pointerType !== 'touch') {
      this.pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNormY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }

    if (this.interactionLocked) return;

    if (this.activeDrag && this.activeDrag.pointerId === e.pointerId) {
      const drag = this.activeDrag;
      const dy = drag.startY - e.clientY;

      if (!drag.hasDragged && Math.abs(dy) >= 10) {
        drag.hasDragged = true;
      }

      if (drag.hasDragged) {
        const maxSteps = Math.min(Math.floor(this.dims.rowCount / 2), this.maxDragSteps);
        const rawSteps = dy / drag.pixelsPerSlat;
        const clampedSteps =
          Math.abs(rawSteps) <= maxSteps
            ? rawSteps
            : Math.sign(rawSteps) * (maxSteps + (Math.abs(rawSteps) - maxSteps) * 0.22);

        drag.visualSteps = clampedSteps;

        const track = this.tracks[drag.col];
        if (track) {
          track.currentSteps = drag.baseSteps + clampedSteps;
          track.stepVelocity = 0;
          this.updateUnifiedConveyorKinematics();
        }

        const nearestDetent = Math.max(-maxSteps, Math.min(maxSteps, Math.round(rawSteps)));
        if (nearestDetent !== drag.lastDetentIndex) {
          drag.lastDetentIndex = nearestDetent;
          this.callbacks.onDragDetentTick?.(drag.col);
        }
      }
      return;
    }

    if (e.pointerType === 'touch') return;
    const now = performance.now();
    if (now - this.lastRaycastMs < 32) return;
    this.lastRaycastMs = now;

    const hit = this.raycastWheel(e.clientX, e.clientY);
    const nextCol = hit ? hit.col : null;
    const nextHalf = hit ? hit.half : null;

    if (nextCol !== this.hoveredCol || nextHalf !== this.hoveredHalf) {
      this.hoveredCol = nextCol;
      this.hoveredHalf = nextHalf;
      this.renderer.domElement.style.cursor = hit
        ? hit.isChevron
          ? 'pointer'
          : 'grab'
        : 'default';
      this.callbacks.onHoverWheelChange?.(nextCol, nextHalf);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.activeDrag || this.activeDrag.pointerId !== e.pointerId) return;
    const drag = this.activeDrag;
    this.activeDrag = null;

    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (drag.pointerType === 'touch') {
      this.hoveredCol = null;
      this.hoveredHalf = null;
      this.callbacks.onHoverWheelChange?.(null, null);
      this.renderer.domElement.style.cursor = 'default';
    } else {
      this.renderer.domElement.style.cursor = this.hoveredCol !== null ? 'grab' : 'default';
    }

    if (this.interactionLocked) return;

    if (!drag.hasDragged) {
      this.callbacks.onWheelRotate(drag.col, drag.hitHalf === 'up' ? 1 : -1);
      return;
    }

    const maxSteps = Math.min(Math.floor(this.dims.rowCount / 2), this.maxDragSteps);
    const dy = drag.startY - e.clientY;
    const elapsedMs = performance.now() - drag.startTimeMs;
    let committed = Math.round(drag.visualSteps);

    if (committed === 0 && Math.abs(dy) >= 18 && elapsedMs < 260) {
      committed = dy > 0 ? 1 : -1;
    }

    committed = Math.max(-maxSteps, Math.min(maxSteps, committed));

    if (committed !== 0) {
      this.callbacks.onWheelRotate(drag.col, committed);
    }
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    if (!this.activeDrag || this.activeDrag.pointerId !== e.pointerId) return;
    this.activeDrag = null;
    this.hoveredCol = null;
    this.hoveredHalf = null;
    this.callbacks.onHoverWheelChange?.(null, null);
    this.renderer.domElement.style.cursor = 'default';
  };

  private handlePointerLeave = (): void => {
    if (this.activeDrag) return;
    this.pointerNormX = 0;
    this.pointerNormY = 0;
    if (this.hoveredCol !== null || this.hoveredHalf !== null) {
      this.hoveredCol = null;
      this.hoveredHalf = null;
      this.renderer.domElement.style.cursor = 'default';
      this.callbacks.onHoverWheelChange?.(null, null);
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (this.interactionLocked || this.activeDrag) return;
    const hit = this.raycastWheel(e.clientX, e.clientY);
    if (!hit) return;

    e.preventDefault();
    const now = performance.now();
    if (now - this.lastWheelScrollMs < 130) return;
    this.lastWheelScrollMs = now;

    const dir: 1 | -1 = e.deltaY < 0 ? 1 : -1;
    this.callbacks.onWheelRotate(hit.col, dir);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);

    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
    this.updateCameraTransform(width, height, 0, true);
  };

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 6);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const dt = Math.min((now - this.lastTimeMs) / 1000, 0.05);
      this.lastTimeMs = now;

      this.updatePhysicsAndMaterials(dt);

      if (!this.contextLost) {
        if (!this.isSoftwareGl && this.composer) {
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private updatePhysicsAndMaterials(dt: number): void {
    // 0. Smooth 5↔7 Row Vault Morph Transition (zero allocations, zero shader recompiles)
    if (
      Math.abs(this.rowMorph - this.rowMorphTarget) > 0.0005 ||
      Math.abs(this.conveyorMorphScaleY - 1) > 0.0005
    ) {
      this.rowMorph = THREE.MathUtils.damp(this.rowMorph, this.rowMorphTarget, 11.0, dt);
      if (Math.abs(this.rowMorph - this.rowMorphTarget) <= 0.0005) {
        this.rowMorph = this.rowMorphTarget;
      }
      this.applyVaultMorph(this.rowMorph);

      const visualHalfStraight = THREE.MathUtils.lerp(
        DIMS_5.halfStraight,
        DIMS_7.halfStraight,
        this.rowMorph
      );
      this.conveyorMorphScaleY = visualHalfStraight / this.dims.halfStraight;
      if (Math.abs(this.conveyorMorphScaleY - 1) <= 0.0005) {
        this.conveyorMorphScaleY = 1;
      }
      this.conveyorMechanismGroup.scale.y = this.conveyorMorphScaleY;
    }

    // 1. Unified Conveyor Assembly Spring Kinematics
    const stiffness = 240;
    const damping = 20.5;
    let anyTrackMoved = false;
    const draggingCol = this.activeDrag?.hasDragged ? this.activeDrag.col : null;

    for (const track of this.tracks) {
      if (draggingCol !== track.col) {
        const displacement = track.targetSteps - track.currentSteps;
        if (Math.abs(displacement) > 0.0004 || Math.abs(track.stepVelocity) > 0.0004) {
          const accel = displacement * stiffness - track.stepVelocity * damping;
          track.stepVelocity += accel * dt;
          track.currentSteps += track.stepVelocity * dt;
          anyTrackMoved = true;
        } else if (track.currentSteps !== track.targetSteps) {
          track.currentSteps = track.targetSteps;
          track.stepVelocity = 0;
          anyTrackMoved = true;
        }
      }

      const isEngaged =
        (this.hoveredCol === track.col || draggingCol === track.col) && !this.interactionLocked;
      const targetHover = isEngaged ? 1 : 0;
      track.hoverIntensity = THREE.MathUtils.damp(track.hoverIntensity, targetHover, 12, dt);
      const emissiveBoost = 0.26 + track.hoverIntensity * 0.22;
      for (let i = 0; i < this.dims.slatCount; i++) {
        const slat = track.slats[i];
        slat.faceMat.emissiveIntensity = emissiveBoost;
        slat.faceMat.emissive.lerpColors(
          COLOR_ENAMEL_GLOW,
          COLOR_HOVER_TINT,
          track.hoverIntensity * 0.45
        );
      }
    }

    if (anyTrackMoved) {
      this.updateUnifiedConveyorKinematics();
    }

    // Unified conveyor chassis torque recoil & unlock seat motion
    if (Math.abs(this.assemblyRecoilY) > 0.0002 || Math.abs(this.assemblyRecoilVel) > 0.0002) {
      const recoilAccel = -this.assemblyRecoilY * 320 - this.assemblyRecoilVel * 24;
      this.assemblyRecoilVel += recoilAccel * dt;
      this.assemblyRecoilY += this.assemblyRecoilVel * dt;
    } else {
      this.assemblyRecoilY = 0;
      this.assemblyRecoilVel = 0;
    }
    this.assemblySeatZ = THREE.MathUtils.damp(this.assemblySeatZ, this.assemblySeatTargetZ, 6.0, dt);
    this.conveyorMechanismGroup.position.set(0, this.assemblyRecoilY, this.assemblySeatZ);

    // 2. Physical Brass Release Lever spring kinematics
    const leverDisp = this.leverTargetAngle - this.leverAngle;
    if (Math.abs(leverDisp) > 0.0005 || Math.abs(this.leverVelocity) > 0.0005) {
      const leverAccel = leverDisp * 140 - this.leverVelocity * 16;
      this.leverVelocity += leverAccel * dt;
      this.leverAngle += this.leverVelocity * dt;
      this.leverPivot.rotation.x = -this.leverAngle;
    }

    // 3. Central Heavy Steel Deadbolt motorized retraction
    if (Math.abs(this.boltTargetX - this.boltPositionX) > 0.001) {
      this.boltPositionX = THREE.MathUtils.damp(this.boltPositionX, this.boltTargetX, 4.2, dt);
      this.deadboltGroup.position.x = this.boltPositionX;
    }

    // 4. Recessed Row LED Strips & Point Lights
    if (this.unlockCascadeActive) {
      this.unlockCascadeTime += dt;
    }

    this.rowLedPairs.forEach((led, idx) => {
      const activeSlot = !led.isOuterOnly || this.dims.rowCount === 7;
      let desiredIntensity = activeSlot ? led.targetIntensity : 0;
      if (this.unlockCascadeActive && activeSlot) {
        const wave = Math.max(0, Math.sin(this.unlockCascadeTime * 7.5 - idx * 0.6));
        desiredIntensity = 1.05 + wave * 0.55;
      }

      led.leftMat.emissive.lerp(led.targetColor, 1 - Math.exp(-10 * dt));
      led.rightMat.emissive.copy(led.leftMat.emissive);
      led.leftMat.emissiveIntensity = THREE.MathUtils.damp(
        led.leftMat.emissiveIntensity,
        desiredIntensity,
        10,
        dt
      );
      led.rightMat.emissiveIntensity = led.leftMat.emissiveIntensity;

      led.pointLight.color.copy(led.leftMat.emissive);
      const ptTarget = activeSlot && desiredIntensity > 0.4 ? desiredIntensity * 0.13 : 0;
      led.pointLight.intensity = THREE.MathUtils.damp(led.pointLight.intensity, ptTarget, 9, dt);
    });

    // 5. Four Jeweled Master Key Deduction Pins
    this.pinLamps.forEach((lamp, col) => {
      let desiredIntensity = lamp.targetIntensity;
      if (this.unlockCascadeActive) {
        const wave = Math.max(0, Math.sin(this.unlockCascadeTime * 9.0 - col * 0.55));
        desiredIntensity = 1.05 + wave * 0.48;
      }
      lamp.topMat.emissive.lerp(lamp.targetColor, 1 - Math.exp(-12 * dt));
      lamp.bottomMat.emissive.copy(lamp.topMat.emissive);
      lamp.topMat.color.lerp(lamp.targetColor, 1 - Math.exp(-12 * dt));
      lamp.bottomMat.color.copy(lamp.topMat.color);
      lamp.topMat.emissiveIntensity = THREE.MathUtils.damp(
        lamp.topMat.emissiveIntensity,
        desiredIntensity,
        12,
        dt
      );
      lamp.bottomMat.emissiveIntensity = lamp.topMat.emissiveIntensity;

      lamp.pointLight.color.copy(lamp.topMat.emissive);
      const ptTarget = desiredIntensity > 0.35 ? desiredIntensity * 0.11 : 0;
      lamp.pointLight.intensity = THREE.MathUtils.damp(lamp.pointLight.intensity, ptTarget, 10, dt);
    });

    // 6. Bezel Reticle & Unlock Laser Relays
    const targetLaser = this.unlockCascadeActive
      ? 1.15 + Math.sin(this.unlockCascadeTime * 8.0) * 0.25
      : 0.0;
    this.unlockLaserMat.emissiveIntensity = THREE.MathUtils.damp(
      this.unlockLaserMat.emissiveIntensity,
      targetLaser,
      8,
      dt
    );

    const reticleTargetColor = this.unlockCascadeActive ? COLOR_EMERALD : COLOR_HOVER_TINT;
    this.bezelReticleMat.emissive.lerp(reticleTargetColor, 1 - Math.exp(-8 * dt));
    this.bezelReticleMat.emissiveIntensity = THREE.MathUtils.damp(
      this.bezelReticleMat.emissiveIntensity,
      this.unlockCascadeActive ? 1.0 : 0.2,
      8,
      dt
    );

    // 7. Subtle Mouse-Parallax Camera Sway & Smooth 5↔7 Camera Framing
    const swayScale = this.prefersReducedMotion ? 0 : 1;
    const targetYaw = this.baseYaw + this.pointerNormX * THREE.MathUtils.degToRad(3.4) * swayScale;
    const targetPitch =
      this.basePitch - this.pointerNormY * THREE.MathUtils.degToRad(2.5) * swayScale;

    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, targetYaw, 5.2, dt);
    this.currentPitch = THREE.MathUtils.damp(this.currentPitch, targetPitch, 5.2, dt);

    this.updateCameraTransform(
      Math.max(this.container.clientWidth, 320),
      Math.max(this.container.clientHeight, 240),
      dt,
      false
    );
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    clearTimeout(this.warmTimerId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointercancel', this.handlePointerCancel);
    dom.removeEventListener('pointerleave', this.handlePointerLeave);
    dom.removeEventListener('wheel', this.handleWheel);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });

    [this.gunmetalTex, this.steelTex, this.brassTex].forEach((set) => {
      set.map.dispose();
      set.roughnessMap.dispose();
      set.bumpMap.dispose();
    });

    this.letterCache.dispose();
    this.contactShadowTex.dispose();
    this.watermarkTex?.dispose();
    this.envTexture.dispose();
    this.composer?.dispose();
    this.renderer.dispose();

    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
