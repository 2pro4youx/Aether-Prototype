import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Zap, Gauge } from 'lucide-react';
import { ColorPalette, ColorPaletteId } from '../types';
import { PALETTES } from '../data/mockData';

interface PolygonCanvasProps {
  onEnterApp?: () => void;
  activePalette?: ColorPalette;
  onPaletteChange?: (paletteId: ColorPaletteId) => void;
  isLoggedIn?: boolean;
}

type QualityTier = 'performance' | 'balanced' | 'ultra';

interface QualityConfig {
  label: string;
  badge: string;
  desc: string;
  scale: number;
  step: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ThemeWave {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  waveWidth: number;
  invTwoWidth: number;
  fromPalette: ColorPalette;
  toPalette: ColorPalette;
  fromPri: RGB;
  fromAcc: RGB;
  toPri: RGB;
  toAcc: RGB;
  fromBg: RGB;
  toBg: RGB;
}

interface ClickBurst {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  speed: number;
}

const QUALITY_PRESETS: Record<QualityTier, QualityConfig> = {
  performance: {
    label: 'Fast',
    badge: '0.6x res',
    desc: 'High FPS on all GPUs & laptops',
    scale: 0.6,
    step: 48,
  },
  balanced: {
    label: 'Balanced',
    badge: '0.8x res',
    desc: 'Smooth 60–120 FPS with crisp facets (Recommended)',
    scale: 0.8,
    step: 38,
  },
  ultra: {
    label: 'Ultra',
    badge: '1.0x res',
    desc: 'Native resolution, dense mesh',
    scale: 1.0,
    step: 28,
  },
};

const PALETTE_RGB_CACHE = new Map<string, RGB>();
const parseHexChannel = (hexSlice: string, fallback: number): number => {
  const val = parseInt(hexSlice, 16);
  return Number.isNaN(val) ? fallback : val;
};
const parseHexCached = (hex: string): RGB => {
  const key = hex || '#f59e0b';
  let cached = PALETTE_RGB_CACHE.get(key);
  if (cached) return cached;
  let clean = key.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  cached = {
    r: parseHexChannel(clean.substring(0, 2), 245),
    g: parseHexChannel(clean.substring(2, 4), 158),
    b: parseHexChannel(clean.substring(4, 6), 11),
  };
  PALETTE_RGB_CACHE.set(key, cached);
  return cached;
};

// Revolve forward through the curated 10-gradient order
const getNextThemeInOrder = (current: ColorPalette): ColorPalette => {
  const currentIndex = PALETTES.findIndex((p) => p.id === current.id);
  const nextIndex = (currentIndex + 1) % PALETTES.length;
  return PALETTES[nextIndex];
};

const VERTEX_SHADER_SRC = `
attribute vec2 aPos;
attribute vec4 aColor;
uniform vec2 uResolution;
varying vec4 vColor;
void main() {
  vec2 clip = (aPos / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vColor = aColor;
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`;

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const PolygonCanvas: React.FC<PolygonCanvasProps> = ({
  onEnterApp,
  activePalette,
  onPaletteChange,
  isLoggedIn = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpsTextRef = useRef<HTMLSpanElement | null>(null);

  const activePaletteRef = useRef<ColorPalette>(activePalette || PALETTES[0]);
  activePaletteRef.current = activePalette || PALETTES[0];

  const onPaletteChangeRef = useRef(onPaletteChange);
  onPaletteChangeRef.current = onPaletteChange;

  const getPaletteSignature = (p: ColorPalette) =>
    `${p.id}|${p.primary}|${p.accent}|${p.bgDark}`;

  const [displayPalette, setDisplayPalette] = useState<ColorPalette>(
    () => activePalette || PALETTES[0]
  );
  const [isTextBlurred, setIsTextBlurred] = useState(false);
  const textBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textUnblurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWaveCountRef = useRef(0);
  const isWaveBlurPendingRef = useRef(false);
  const pendingCommitPaletteIdRef = useRef<ColorPaletteId | null>(null);

  useEffect(() => {
    if (!activePalette) return;
    activePaletteRef.current = activePalette;

    if (pendingCommitPaletteIdRef.current === activePalette.id) {
      pendingCommitPaletteIdRef.current = null;
    }

    if (
      activeWaveCountRef.current === 0 &&
      !isWaveBlurPendingRef.current &&
      pendingCommitPaletteIdRef.current === null
    ) {
      setDisplayPalette(activePalette);
    }
  }, [activePalette]);

  // Quality Tier selection (persisted)
  const [quality, setQuality] = useState<QualityTier>(() => {
    try {
      const saved = localStorage.getItem('aether_canvas_quality') as QualityTier;
      if (saved && QUALITY_PRESETS[saved]) return saved;
    } catch {
      // Fallback
    }
    return 'balanced';
  });

  const handleQualityChange = (newQuality: QualityTier) => {
    setQuality(newQuality);
    try {
      localStorage.setItem('aether_canvas_quality', newQuality);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prefer GPU-accelerated WebGL for 100+ FPS across dense meshes & unlimited stacked waves
    const glOpts: WebGLContextAttributes = {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    };
    const gl =
      (canvas.getContext('webgl2', glOpts) as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl', glOpts) as WebGLRenderingContext | null);

    let ctx2d: CanvasRenderingContext2D | null = null;
    let glProgram: WebGLProgram | null = null;
    let glPosLoc = -1;
    let glColorLoc = -1;
    let glResLoc: WebGLUniformLocation | null = null;
    let glTriBuf: WebGLBuffer | null = null;
    let glWireBuf: WebGLBuffer | null = null;
    let glGlintBuf: WebGLBuffer | null = null;

    if (gl) {
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
      if (vs && fs) {
        glProgram = gl.createProgram();
        if (glProgram) {
          gl.attachShader(glProgram, vs);
          gl.attachShader(glProgram, fs);
          gl.linkProgram(glProgram);
          if (gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
            glPosLoc = gl.getAttribLocation(glProgram, 'aPos');
            glColorLoc = gl.getAttribLocation(glProgram, 'aColor');
            glResLoc = gl.getUniformLocation(glProgram, 'uResolution');
            glTriBuf = gl.createBuffer();
            glWireBuf = gl.createBuffer();
            glGlintBuf = gl.createBuffer();
            gl.useProgram(glProgram);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(
              gl.SRC_ALPHA,
              gl.ONE_MINUS_SRC_ALPHA,
              gl.ONE,
              gl.ONE_MINUS_SRC_ALPHA
            );
          } else {
            gl.deleteProgram(glProgram);
            glProgram = null;
          }
        }
      }
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    }

    if (!glProgram) {
      ctx2d = canvas.getContext('2d', { alpha: false });
      if (!ctx2d) return;
    }

    let animationFrameId = 0;
    const config = QUALITY_PRESETS[quality];
    const renderScale = config.scale;
    const step = config.step;
    const INV_255 = 1 / 255;
    const HALF_PI = Math.PI * 0.5;
    const PI = Math.PI;

    let internalWidth = (canvas.width = Math.max(320, Math.round(window.innerWidth * renderScale)));
    let internalHeight = (canvas.height = Math.max(240, Math.round(window.innerHeight * renderScale)));

    // Cached bounding rect to prevent layout thrashing on every mousemove
    let cachedRectLeft = 0;
    let cachedRectTop = 0;
    let cachedScaleX = internalWidth / (window.innerWidth || 1);
    let cachedScaleY = internalHeight / (window.innerHeight || 1);

    const updateCachedRect = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cachedRectLeft = rect.left;
        cachedRectTop = rect.top;
        cachedScaleX = internalWidth / rect.width;
        cachedScaleY = internalHeight / rect.height;
      }
    };

    let currentPalette: ColorPalette = activePaletteRef.current;
    let currentPaletteSig = getPaletteSignature(currentPalette);

    // Unlimited stackable animations (NO queue caps or throttles)
    const activeBursts: ClickBurst[] = [];
    const activeWaves: ThemeWave[] = [];
    let waveIdCounter = 0;

    // Per-frame wave & burst cached bounds (resized dynamically if user stacks arbitrarily many)
    let waveInnerSq = new Float32Array(32);
    let waveOuterSq = new Float32Array(32);
    let burstMinSq = new Float32Array(32);
    let burstMaxSq = new Float32Array(32);

    const mouse = {
      x: internalWidth * 0.5,
      y: internalHeight * 0.5,
      targetX: internalWidth * 0.5,
      targetY: internalHeight * 0.5,
      radius: Math.round(180 * renderScale),
      radiusSq: Math.round(180 * renderScale) ** 2,
      invRadiusHalfPi: (Math.PI * 0.5) / Math.max(1, Math.round(180 * renderScale)),
    };

    // Flat typed-array grid & GPU upload buffers
    let cols = 0;
    let rows = 0;
    let stride = 0;
    let maxRow = 0;
    let maxCol = 0;
    let gridX0 = new Float32Array(0);
    let gridY0 = new Float32Array(0);
    let gridX = new Float32Array(0);
    let gridY = new Float32Array(0);
    let gridZ = new Float32Array(0);
    let waveCols = new Float32Array(0);
    let waveRows = new Float32Array(0);

    // WebGL vertex staging buffers:
    // triData: 6 floats per vertex [x, y, r, g, b, a], 6 vertices per quad cell
    // wireData: 2 floats per vertex [x, y], 6 vertices per quad cell (3 edges)
    // glintData: 6 floats per vertex [x, y, r, g, b, a], 6 vertices per flipping facet
    let triData = new Float32Array(0);
    let wireData = new Float32Array(0);
    let glintData = new Float32Array(0);
    let facetCount = 0;
    let wireVertCount = 0;

    const initGrid = () => {
      cols = Math.ceil(internalWidth / step) + 2;
      rows = Math.ceil(internalHeight / step) + 2;
      stride = cols + 1;
      maxCol = cols - 1;
      maxRow = rows - 1;
      const pointCount = (rows + 1) * stride;
      const cellCount = maxRow * maxCol;

      gridX0 = new Float32Array(pointCount);
      gridY0 = new Float32Array(pointCount);
      gridX = new Float32Array(pointCount);
      gridY = new Float32Array(pointCount);
      gridZ = new Float32Array(pointCount);
      waveCols = new Float32Array(cols + 1);
      waveRows = new Float32Array(rows + 1);

      let idx = 0;
      for (let r = 0; r <= rows; r++) {
        const y = (r - 1) * step;
        for (let c = 0; c <= cols; c++) {
          const x = (c - 1) * step;
          gridX0[idx] = x;
          gridY0[idx] = y;
          gridX[idx] = x;
          gridY[idx] = y;
          idx++;
        }
      }

      facetCount = cellCount * 2;
      wireVertCount = cellCount * 6;

      if (gl && glProgram && glTriBuf && glWireBuf && glGlintBuf) {
        triData = new Float32Array(facetCount * 3 * 6);
        wireData = new Float32Array(wireVertCount * 2);
        glintData = new Float32Array(facetCount * 6 * 6);

        gl.viewport(0, 0, internalWidth, internalHeight);
        gl.uniform2f(glResLoc, internalWidth, internalHeight);

        gl.bindBuffer(gl.ARRAY_BUFFER, glTriBuf);
        gl.bufferData(gl.ARRAY_BUFFER, triData.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, glWireBuf);
        gl.bufferData(gl.ARRAY_BUFFER, wireData.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, glGlintBuf);
        gl.bufferData(gl.ARRAY_BUFFER, glintData.byteLength, gl.DYNAMIC_DRAW);
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      internalWidth = canvas.width = Math.max(320, Math.round(window.innerWidth * renderScale));
      internalHeight = canvas.height = Math.max(240, Math.round(window.innerHeight * renderScale));
      mouse.radius = Math.round(180 * renderScale);
      mouse.radiusSq = mouse.radius * mouse.radius;
      mouse.invRadiusHalfPi = HALF_PI / Math.max(1, mouse.radius);
      initGrid();
      updateCachedRect();
    };

    initGrid();
    updateCachedRect();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateCachedRect);
      resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', handleResize);

    let lastDragX = 0;
    let lastDragY = 0;

    // 1. Left-click / Drag: spawn instant stackable circular shockwave ripples
    const spawnBurstRipple = (clientX: number, clientY: number, strengthMultiplier = 1.0) => {
      const originX = (clientX - cachedRectLeft) * cachedScaleX;
      const originY = (clientY - cachedRectTop) * cachedScaleY;

      mouse.targetX = originX;
      mouse.targetY = originY;

      activeBursts.push({
        x: originX,
        y: originY,
        radius: 0,
        maxRadius: Math.round(540 * renderScale),
        strength: Math.round(38 * renderScale * strengthMultiplier),
        speed: Math.max(12, Math.round(18 * renderScale)),
      });
    };

    // 2. Right-click: stackable theme-flip wave radiating to edges and flipping polygons in order
    const triggerThemeFlipWave = (clientX: number, clientY: number) => {
      const originX = (clientX - cachedRectLeft) * cachedScaleX;
      const originY = (clientY - cachedRectTop) * cachedScaleY;

      const fromPal =
        activeWaves.length > 0 ? activeWaves[activeWaves.length - 1].toPalette : currentPalette;
      const toPal = getNextThemeInOrder(fromPal);

      const d0 = Math.hypot(originX, originY);
      const d1 = Math.hypot(internalWidth - originX, originY);
      const d2 = Math.hypot(originX, internalHeight - originY);
      const d3 = Math.hypot(internalWidth - originX, internalHeight - originY);
      const maxCornerDist = Math.max(d0, d1, d2, d3);

      const waveWidth = Math.round(115 * renderScale);
      const maxRadius = maxCornerDist + waveWidth * 1.5;
      const speed = Math.max(16, Math.round(25 * renderScale));

      activeWaves.push({
        id: ++waveIdCounter,
        x: originX,
        y: originY,
        radius: 0,
        maxRadius,
        speed,
        waveWidth,
        invTwoWidth: 1 / (2 * waveWidth),
        fromPalette: fromPal,
        toPalette: toPal,
        fromPri: parseHexCached(fromPal.primary),
        fromAcc: parseHexCached(fromPal.accent),
        toPri: parseHexCached(toPal.primary),
        toAcc: parseHexCached(toPal.accent),
        fromBg: parseHexCached(fromPal.bgDark || '#06090e'),
        toBg: parseHexCached(toPal.bgDark || '#06090e'),
      });
      activeWaveCountRef.current = activeWaves.length;
      pendingCommitPaletteIdRef.current = null;

      // Immediate physical shockwave burst at click location
      activeBursts.push({
        x: originX,
        y: originY,
        radius: 0,
        maxRadius: Math.round(380 * renderScale),
        strength: Math.round(32 * renderScale),
        speed: Math.max(12, Math.round(18 * renderScale)),
      });

      // Blur in and out text animation to gracefully hide the color transition
      isWaveBlurPendingRef.current = true;
      setIsTextBlurred(true);
      if (textBlurTimerRef.current) clearTimeout(textBlurTimerRef.current);
      if (textUnblurTimerRef.current) clearTimeout(textUnblurTimerRef.current);

      textBlurTimerRef.current = setTimeout(() => {
        setDisplayPalette(toPal);
        textUnblurTimerRef.current = setTimeout(() => {
          isWaveBlurPendingRef.current = false;
          setIsTextBlurred(false);
        }, 90);
      }, 260);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const currX = (e.clientX - cachedRectLeft) * cachedScaleX;
      const currY = (e.clientY - cachedRectTop) * cachedScaleY;
      mouse.targetX = currX;
      mouse.targetY = currY;

      if (e.buttons & 1) {
        const dx = currX - lastDragX;
        const dy = currY - lastDragY;
        const threshold = 36 * renderScale;
        if (dx * dx + dy * dy > threshold * threshold) {
          lastDragX = currX;
          lastDragY = currY;
          spawnBurstRipple(e.clientX, e.clientY, 0.75);
        }
      }
    };

    // Track whether pointerdown(button=2) just handled the current right-click so contextmenu doesn't fire a duplicate wave for the same click
    let handledRightPointerDown = false;
    let rightPointerResetTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const targetEl = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (targetEl?.closest?.('button, a, input, select, nav, [role="dialog"]')) {
        return;
      }

      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        handledRightPointerDown = true;
        if (rightPointerResetTimer) clearTimeout(rightPointerResetTimer);
        rightPointerResetTimer = setTimeout(() => {
          handledRightPointerDown = false;
        }, 120);
        triggerThemeFlipWave(e.clientX, e.clientY);
      } else if (e.button === 0) {
        lastDragX = (e.clientX - cachedRectLeft) * cachedScaleX;
        lastDragY = (e.clientY - cachedRectTop) * cachedScaleY;
        spawnBurstRipple(e.clientX, e.clientY, 1.0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (handledRightPointerDown) {
        handledRightPointerDown = false;
        if (rightPointerResetTimer) {
          clearTimeout(rightPointerResetTimer);
          rightPointerResetTimer = null;
        }
        return;
      }
      const targetEl = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (targetEl?.closest?.('button, a, input, select, nav, [role="dialog"]')) {
        return;
      }
      triggerThemeFlipWave(e.clientX, e.clientY);
    };

    const handleBlur = () => {
      handledRightPointerDown = false;
      if (rightPointerResetTimer) {
        clearTimeout(rightPointerResetTimer);
        rightPointerResetTimer = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);

    let time = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let lastFrameTime = lastFpsTime;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastFrameTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Precomputed Canvas2D fallback facet helper (hoisted outside frame loop)
    let fallbackBgStr = '';
    const emitCanvas2DFacet = (
      targetCtx: CanvasRenderingContext2D,
      p1x: number,
      p1y: number,
      p1z: number,
      p2x: number,
      p2y: number,
      p2z: number,
      p3x: number,
      p3y: number,
      p3z: number,
      defPri: RGB,
      defAcc: RGB,
      mx: number,
      my: number,
      waveCount: number
    ) => {
      const midX = (p1x + p2x + p3x) * 0.3333333;
      const midY = (p1y + p2y + p3y) * 0.3333333;
      const avgZ = (p1z + p2z + p3z) * 0.3333333;

      const mdx = midX - mx;
      const mdy = midY - my;
      const mDistSq = mdx * mdx + mdy * mdy;
      const hoverIntensity = mDistSq < 62500 ? Math.max(0, 1 - Math.sqrt(mDistSq) * 0.004) : 0;
      const t = Math.max(0, Math.min(1, (avgZ + 15) * 0.02));

      let pt1X = p1x;
      let pt1Y = p1y;
      let pt2X = p2x;
      let pt2Y = p2y;
      let pt3X = p3x;
      let pt3Y = p3y;

      let pri = defPri;
      let acc = defAcc;
      let specular = 0;
      let edgeGlint = 0;

      for (let w = waveCount - 1; w >= 0; w--) {
        const wave = activeWaves[w];
        const dxW = midX - wave.x;
        const dyW = midY - wave.y;
        const distWSq = dxW * dxW + dyW * dyW;

        if (distWSq > waveOuterSq[w]) continue;
        if (distWSq < waveInnerSq[w]) {
          pri = wave.toPri;
          acc = wave.toAcc;
          break;
        }

        const distW = Math.sqrt(distWSq);
        const u = Math.max(0, Math.min(1, 0.5 - (distW - wave.radius) * wave.invTwoWidth));
        const angle = u * PI;
        const scaleN = Math.max(0.06, Math.abs(Math.cos(angle)));

        const invLen = distW > 0 ? 1 / distW : 1;
        const nx = dxW * invLen;
        const ny = dyW * invLen;
        const tx = -ny;
        const ty = nx;

        const v1x = p1x - midX;
        const v1y = p1y - midY;
        const t1 = v1x * tx + v1y * ty;
        const n1 = (v1x * nx + v1y * ny) * scaleN;
        pt1X = midX + t1 * tx + n1 * nx;
        pt1Y = midY + t1 * ty + n1 * ny;

        const v2x = p2x - midX;
        const v2y = p2y - midY;
        const t2 = v2x * tx + v2y * ty;
        const n2 = (v2x * nx + v2y * ny) * scaleN;
        pt2X = midX + t2 * tx + n2 * nx;
        pt2Y = midY + t2 * ty + n2 * ny;

        const v3x = p3x - midX;
        const v3y = p3y - midY;
        const t3 = v3x * tx + v3y * ty;
        const n3 = (v3x * nx + v3y * ny) * scaleN;
        pt3X = midX + t3 * tx + n3 * nx;
        pt3Y = midY + t3 * ty + n3 * ny;

        if (u < 0.5) {
          pri = wave.fromPri;
          acc = wave.fromAcc;
        } else {
          pri = wave.toPri;
          acc = wave.toAcc;
        }

        specular = Math.sin(angle) * 70;
        const edgeProximity = Math.abs(u - 0.5);
        if (edgeProximity < 0.14) {
          edgeGlint = 1 - edgeProximity / 0.14;
        }
        break;
      }

      const red = Math.min(255, (acc.r * (1 - t) + pri.r * t + hoverIntensity * 20 + specular + 0.5) | 0);
      const green = Math.min(255, (acc.g * (1 - t) + pri.g * t + hoverIntensity * 30 + specular + 0.5) | 0);
      const blue = Math.min(255, (acc.b * (1 - t) + pri.b * t + hoverIntensity * 20 + specular + 0.5) | 0);
      const alpha = Math.max(0.25, Math.min(0.96, 0.35 + t * 0.45 + hoverIntensity * 0.25 + (specular / 70) * 0.3));

      targetCtx.beginPath();
      targetCtx.moveTo(pt1X, pt1Y);
      targetCtx.lineTo(pt2X, pt2Y);
      targetCtx.lineTo(pt3X, pt3Y);
      targetCtx.closePath();
      targetCtx.fillStyle = `rgba(${red},${green},${blue},${((alpha * 50 + 0.5) | 0) * 0.02})`;
      targetCtx.fill();

      if (edgeGlint > 0) {
        targetCtx.strokeStyle = `rgba(255,255,255,${((edgeGlint * 65 + 0.5) | 0) * 0.01})`;
        targetCtx.lineWidth = 1.2;
        targetCtx.stroke();
      }
    };

    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (document.hidden) return;

      // Sync external palette change ONLY when resting & no wave commit is in flight
      const incoming = activePaletteRef.current;
      const incomingSig = getPaletteSignature(incoming);
      if (
        activeWaves.length === 0 &&
        pendingCommitPaletteIdRef.current === null &&
        currentPaletteSig !== incomingSig
      ) {
        currentPalette = incoming;
        currentPaletteSig = incomingSig;
      }

      // Frame-rate independent delta step (normalized so 1.0 = 60 FPS frame)
      const dtMs = now - lastFrameTime;
      lastFrameTime = now;
      const stepFactor = Math.min(2.5, Math.max(0.1, dtMs / 16.6667));

      // FPS measurement via direct DOM mutation (zero React re-renders)
      frameCount++;
      if (now - lastFpsTime >= 500) {
        const measured = Math.round((frameCount * 1000) / (now - lastFpsTime));
        if (fpsTextRef.current) {
          fpsTextRef.current.textContent = `${measured} FPS`;
        }
        frameCount = 0;
        lastFpsTime = now;
      }

      time += 0.025 * stepFactor;

      const mouseLerp = 1 - Math.pow(0.88, stepFactor);
      mouse.x += (mouse.targetX - mouse.x) * mouseLerp;
      mouse.y += (mouse.targetY - mouse.y) * mouseLerp;

      // Progress unlimited stackable left-click shockwave bursts
      const burstDecay = Math.pow(0.94, stepFactor);
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const b = activeBursts[i];
        b.radius += b.speed * stepFactor;
        b.strength *= burstDecay;
        if (b.strength < 0.3 || b.radius >= b.maxRadius) {
          activeBursts.splice(i, 1);
        }
      }

      // Progress unlimited stackable theme-flip waves chronologically.
      // When any wave reaches maxRadius, it covers 100% of the canvas so all earlier waves (0..i) are visually eclipsed.
      let highestFinishedIdx = -1;
      for (let i = 0; i < activeWaves.length; i++) {
        const w = activeWaves[i];
        w.radius += w.speed * stepFactor;
        if (w.radius >= w.maxRadius) {
          highestFinishedIdx = i;
        }
      }
      if (highestFinishedIdx >= 0) {
        const winningWave = activeWaves[highestFinishedIdx];
        currentPalette = winningWave.toPalette;
        currentPaletteSig = getPaletteSignature(currentPalette);
        activeWaves.splice(0, highestFinishedIdx + 1);
        activeWaveCountRef.current = activeWaves.length;
        if (activeWaves.length === 0) {
          if (activePaletteRef.current.id !== currentPalette.id) {
            pendingCommitPaletteIdRef.current = currentPalette.id;
            onPaletteChangeRef.current?.(currentPalette.id);
          }
        }
      }

      const burstCount = activeBursts.length;
      const waveCount = activeWaves.length;

      // Grow scratch squared-distance arrays only if stacked count exceeds current capacity
      if (burstCount > burstMinSq.length) {
        burstMinSq = new Float32Array(burstCount * 2);
        burstMaxSq = new Float32Array(burstCount * 2);
      }
      for (let i = 0; i < burstCount; i++) {
        const b = activeBursts[i];
        const minR = b.radius > 50 ? b.radius - 50 : 0;
        const maxR = b.radius + 50;
        burstMinSq[i] = minR * minR;
        burstMaxSq[i] = maxR * maxR;
      }

      if (waveCount > waveInnerSq.length) {
        waveInnerSq = new Float32Array(waveCount * 2);
        waveOuterSq = new Float32Array(waveCount * 2);
      }
      for (let i = 0; i < waveCount; i++) {
        const w = activeWaves[i];
        const inner = w.radius > w.waveWidth ? w.radius - w.waveWidth : 0;
        const outer = w.radius + w.waveWidth;
        waveInnerSq[i] = inner * inner;
        waveOuterSq[i] = outer * outer;
      }

      // Precalculate 1D trigonometric wave tables
      for (let c = 0; c <= cols; c++) {
        waveCols[c] = Math.sin((c - 1) * step * 0.012 + time * 1.2) * 12;
      }
      for (let r = 0; r <= rows; r++) {
        waveRows[r] = Math.cos((r - 1) * step * 0.014 - time * 0.9) * 10;
      }

      // Flat typed-array lattice elevation update
      const mouseX = mouse.x;
      const mouseY = mouse.y;
      const mouseRadSq = mouse.radiusSq;
      const invMouseRadHalfPi = mouse.invRadiusHalfPi;
      const waveHeightAmp = 58 * renderScale;
      const zLerp = 1 - Math.pow(0.82, stepFactor);
      const timeDiag = time * 1.5;

      for (let r = 0; r <= rows; r++) {
        const wRow = waveRows[r];
        const rowBase = r * stride;
        for (let c = 0; c <= cols; c++) {
          const idx = rowBase + c;
          const x0 = gridX0[idx];
          const y0 = gridY0[idx];

          let targetZ = waveCols[c] + wRow + Math.sin((x0 + y0) * 0.008 + timeDiag) * 8;

          const dx = x0 - mouseX;
          const dy = y0 - mouseY;
          const distSq = dx * dx + dy * dy;
          if (distSq < mouseRadSq) {
            targetZ += Math.cos(Math.sqrt(distSq) * invMouseRadHalfPi) * 48;
          }

          for (let i = 0; i < burstCount; i++) {
            const b = activeBursts[i];
            const bdx = x0 - b.x;
            const bdy = y0 - b.y;
            const bDistSq = bdx * bdx + bdy * bdy;
            if (bDistSq < burstMaxSq[i] && bDistSq > burstMinSq[i]) {
              const burstDist = Math.abs(Math.sqrt(bDistSq) - b.radius);
              if (burstDist < 50) {
                targetZ += (1 - burstDist * 0.02) * b.strength * 1.8;
              }
            }
          }

          for (let i = 0; i < waveCount; i++) {
            const w = activeWaves[i];
            const wdx = x0 - w.x;
            const wdy = y0 - w.y;
            const wDistSq = wdx * wdx + wdy * wdy;
            if (wDistSq < waveOuterSq[i] && wDistSq > waveInnerSq[i]) {
              const distFromCrest = Math.abs(Math.sqrt(wDistSq) - w.radius);
              if (distFromCrest < w.waveWidth) {
                targetZ += Math.cos((distFromCrest / w.waveWidth) * HALF_PI) * waveHeightAmp;
              }
            }
          }

          const newZ = gridZ[idx] + (targetZ - gridZ[idx]) * zLerp;
          gridZ[idx] = newZ;
          gridX[idx] = x0 + newZ * 0.25;
          gridY[idx] = y0 + newZ * 0.35;
        }
      }

      const defPri = parseHexCached(currentPalette.primary);
      const defAcc = parseHexCached(currentPalette.accent);

      // Smooth canvas background color transition
      let bgR: number;
      let bgG: number;
      let bgB: number;
      if (waveCount > 0) {
        const latestWave = activeWaves[waveCount - 1];
        const waveProg = Math.min(1, latestWave.radius / (latestWave.maxRadius * 0.85));
        bgR = latestWave.fromBg.r + (latestWave.toBg.r - latestWave.fromBg.r) * waveProg;
        bgG = latestWave.fromBg.g + (latestWave.toBg.g - latestWave.fromBg.g) * waveProg;
        bgB = latestWave.fromBg.b + (latestWave.toBg.b - latestWave.fromBg.b) * waveProg;
      } else {
        const defBg = parseHexCached(currentPalette.bgDark || '#06090e');
        bgR = defBg.r;
        bgG = defBg.g;
        bgB = defBg.b;
      }

      const wirePri = waveCount > 0 ? activeWaves[waveCount - 1].toPri : defPri;

      // =========================================================================
      // GPU WEBGL PATH (Single batched draw call for all facets + wireframes)
      // =========================================================================
      if (gl && glProgram && glTriBuf && glWireBuf && glGlintBuf) {
        gl.clearColor(bgR * INV_255, bgG * INV_255, bgB * INV_255, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        let triOffset = 0;
        let wireOffset = 0;
        let glintOffset = 0;

        for (let r = 0; r < maxRow; r++) {
          const r1 = r * stride;
          const r2 = r1 + stride;
          for (let c = 0; c < maxCol; c++) {
            const idxA = r1 + c;
            const idxB = idxA + 1;
            const idxC = r2 + c;
            const idxD = idxC + 1;

            const ax = gridX[idxA], ay = gridY[idxA], az = gridZ[idxA];
            const bx = gridX[idxB], by = gridY[idxB], bz = gridZ[idxB];
            const cx = gridX[idxC], cy = gridY[idxC], cz = gridZ[idxC];
            const dx = gridX[idxD], dy = gridY[idxD], dz = gridZ[idxD];

            // Wireframe cell edges (A-B, B-C, C-A)
            wireData[wireOffset] = ax;
            wireData[wireOffset + 1] = ay;
            wireData[wireOffset + 2] = bx;
            wireData[wireOffset + 3] = by;
            wireData[wireOffset + 4] = bx;
            wireData[wireOffset + 5] = by;
            wireData[wireOffset + 6] = cx;
            wireData[wireOffset + 7] = cy;
            wireData[wireOffset + 8] = cx;
            wireData[wireOffset + 9] = cy;
            wireData[wireOffset + 10] = ax;
            wireData[wireOffset + 11] = ay;
            wireOffset += 12;

            // Emit both triangular facets (A,B,C) and (B,D,C)
            for (let tri = 0; tri < 2; tri++) {
              const p1x = tri === 0 ? ax : bx;
              const p1y = tri === 0 ? ay : by;
              const p1z = tri === 0 ? az : bz;
              const p2x = tri === 0 ? bx : dx;
              const p2y = tri === 0 ? by : dy;
              const p2z = tri === 0 ? bz : dz;
              const p3x = cx;
              const p3y = cy;
              const p3z = cz;

              const midX = (p1x + p2x + p3x) * 0.3333333;
              const midY = (p1y + p2y + p3y) * 0.3333333;
              const avgZ = (p1z + p2z + p3z) * 0.3333333;

              const mdx = midX - mouseX;
              const mdy = midY - mouseY;
              const mDistSq = mdx * mdx + mdy * mdy;
              const hoverIntensity =
                mDistSq < 62500 ? Math.max(0, 1 - Math.sqrt(mDistSq) * 0.004) : 0;

              let t = (avgZ + 15) * 0.02;
              if (t < 0) t = 0;
              else if (t > 1) t = 1;

              let pt1X = p1x, pt1Y = p1y;
              let pt2X = p2x, pt2Y = p2y;
              let pt3X = p3x, pt3Y = p3y;

              let pri = defPri;
              let acc = defAcc;
              let specular = 0;
              let edgeGlint = 0;

              for (let w = waveCount - 1; w >= 0; w--) {
                const wave = activeWaves[w];
                const dxW = midX - wave.x;
                const dyW = midY - wave.y;
                const distWSq = dxW * dxW + dyW * dyW;

                if (distWSq > waveOuterSq[w]) continue;
                if (distWSq < waveInnerSq[w]) {
                  pri = wave.toPri;
                  acc = wave.toAcc;
                  break;
                }

                const distW = Math.sqrt(distWSq);
                let u = 0.5 - (distW - wave.radius) * wave.invTwoWidth;
                if (u < 0) u = 0;
                else if (u > 1) u = 1;

                const angle = u * PI;
                const absCos = Math.abs(Math.cos(angle));
                const scaleN = absCos > 0.06 ? absCos : 0.06;

                const invLen = distW > 0 ? 1 / distW : 1;
                const nx = dxW * invLen;
                const ny = dyW * invLen;
                const tx = -ny;
                const ty = nx;

                const v1x = p1x - midX, v1y = p1y - midY;
                const t1 = v1x * tx + v1y * ty, n1 = (v1x * nx + v1y * ny) * scaleN;
                pt1X = midX + t1 * tx + n1 * nx;
                pt1Y = midY + t1 * ty + n1 * ny;

                const v2x = p2x - midX, v2y = p2y - midY;
                const t2 = v2x * tx + v2y * ty, n2 = (v2x * nx + v2y * ny) * scaleN;
                pt2X = midX + t2 * tx + n2 * nx;
                pt2Y = midY + t2 * ty + n2 * ny;

                const v3x = p3x - midX, v3y = p3y - midY;
                const t3 = v3x * tx + v3y * ty, n3 = (v3x * nx + v3y * ny) * scaleN;
                pt3X = midX + t3 * tx + n3 * nx;
                pt3Y = midY + t3 * ty + n3 * ny;

                if (u < 0.5) {
                  pri = wave.fromPri;
                  acc = wave.fromAcc;
                } else {
                  pri = wave.toPri;
                  acc = wave.toAcc;
                }

                specular = Math.sin(angle) * 70;
                const edgeProximity = Math.abs(u - 0.5);
                if (edgeProximity < 0.14) {
                  edgeGlint = 1 - edgeProximity / 0.14;
                }
                break;
              }

              const invT = 1 - t;
              let cr = (acc.r * invT + pri.r * t + hoverIntensity * 20 + specular) * INV_255;
              let cg = (acc.g * invT + pri.g * t + hoverIntensity * 30 + specular) * INV_255;
              let cb = (acc.b * invT + pri.b * t + hoverIntensity * 20 + specular) * INV_255;
              if (cr > 1) cr = 1;
              if (cg > 1) cg = 1;
              if (cb > 1) cb = 1;

              let ca = 0.35 + t * 0.45 + hoverIntensity * 0.25 + (specular / 70) * 0.3;
              if (ca < 0.25) ca = 0.25;
              else if (ca > 0.96) ca = 0.96;

              // Vertex 1
              triData[triOffset] = pt1X;
              triData[triOffset + 1] = pt1Y;
              triData[triOffset + 2] = cr;
              triData[triOffset + 3] = cg;
              triData[triOffset + 4] = cb;
              triData[triOffset + 5] = ca;
              // Vertex 2
              triData[triOffset + 6] = pt2X;
              triData[triOffset + 7] = pt2Y;
              triData[triOffset + 8] = cr;
              triData[triOffset + 9] = cg;
              triData[triOffset + 10] = cb;
              triData[triOffset + 11] = ca;
              // Vertex 3
              triData[triOffset + 12] = pt3X;
              triData[triOffset + 13] = pt3Y;
              triData[triOffset + 14] = cr;
              triData[triOffset + 15] = cg;
              triData[triOffset + 16] = cb;
              triData[triOffset + 17] = ca;
              triOffset += 18;

              if (edgeGlint > 0) {
                const ga = edgeGlint * 0.65;
                // Edge 1->2, 2->3, 3->1
                glintData[glintOffset] = pt1X;
                glintData[glintOffset + 1] = pt1Y;
                glintData[glintOffset + 2] = 1;
                glintData[glintOffset + 3] = 1;
                glintData[glintOffset + 4] = 1;
                glintData[glintOffset + 5] = ga;

                glintData[glintOffset + 6] = pt2X;
                glintData[glintOffset + 7] = pt2Y;
                glintData[glintOffset + 8] = 1;
                glintData[glintOffset + 9] = 1;
                glintData[glintOffset + 10] = 1;
                glintData[glintOffset + 11] = ga;

                glintData[glintOffset + 12] = pt2X;
                glintData[glintOffset + 13] = pt2Y;
                glintData[glintOffset + 14] = 1;
                glintData[glintOffset + 15] = 1;
                glintData[glintOffset + 16] = 1;
                glintData[glintOffset + 17] = ga;

                glintData[glintOffset + 18] = pt3X;
                glintData[glintOffset + 19] = pt3Y;
                glintData[glintOffset + 20] = 1;
                glintData[glintOffset + 21] = 1;
                glintData[glintOffset + 22] = 1;
                glintData[glintOffset + 23] = ga;

                glintData[glintOffset + 24] = pt3X;
                glintData[glintOffset + 25] = pt3Y;
                glintData[glintOffset + 26] = 1;
                glintData[glintOffset + 27] = 1;
                glintData[glintOffset + 28] = 1;
                glintData[glintOffset + 29] = ga;

                glintData[glintOffset + 30] = pt1X;
                glintData[glintOffset + 31] = pt1Y;
                glintData[glintOffset + 32] = 1;
                glintData[glintOffset + 33] = 1;
                glintData[glintOffset + 34] = 1;
                glintData[glintOffset + 35] = ga;

                glintOffset += 36;
              }
            }
          }
        }

        // Draw Pass 1: All triangular facets in a single GPU draw call
        gl.bindBuffer(gl.ARRAY_BUFFER, glTriBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, triData);
        gl.enableVertexAttribArray(glPosLoc);
        gl.vertexAttribPointer(glPosLoc, 2, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(glColorLoc);
        gl.vertexAttribPointer(glColorLoc, 4, gl.FLOAT, false, 24, 8);
        gl.drawArrays(gl.TRIANGLES, 0, facetCount * 3);

        // Draw Pass 1b: Edge glints for flipping facets (only when any exist)
        if (glintOffset > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, glGlintBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, glintData.subarray(0, glintOffset));
          gl.vertexAttribPointer(glPosLoc, 2, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(glColorLoc, 4, gl.FLOAT, false, 24, 8);
          gl.drawArrays(gl.LINES, 0, glintOffset / 6);
        }

        // Draw Pass 2: Ambient wireframe lattice in a single GPU draw call
        gl.bindBuffer(gl.ARRAY_BUFFER, glWireBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, wireData);
        gl.vertexAttribPointer(glPosLoc, 2, gl.FLOAT, false, 8, 0);
        gl.disableVertexAttribArray(glColorLoc);
        gl.vertexAttrib4f(
          glColorLoc,
          wirePri.r * INV_255,
          wirePri.g * INV_255,
          wirePri.b * INV_255,
          0.1
        );
        gl.drawArrays(gl.LINES, 0, wireVertCount);
      } else if (ctx2d) {
        // Canvas2D fallback (zero per-frame closures, quantized color strings, flat grid)
        const nextBg = `rgb(${bgR | 0},${bgG | 0},${bgB | 0})`;
        if (nextBg !== fallbackBgStr) fallbackBgStr = nextBg;
        ctx2d.fillStyle = fallbackBgStr;
        ctx2d.fillRect(0, 0, internalWidth, internalHeight);

        for (let r = 0; r < maxRow; r++) {
          const r1 = r * stride;
          const r2 = r1 + stride;
          for (let c = 0; c < maxCol; c++) {
            const idxA = r1 + c;
            const idxB = idxA + 1;
            const idxC = r2 + c;
            const idxD = idxC + 1;

            emitCanvas2DFacet(
              ctx2d,
              gridX[idxA], gridY[idxA], gridZ[idxA],
              gridX[idxB], gridY[idxB], gridZ[idxB],
              gridX[idxC], gridY[idxC], gridZ[idxC],
              defPri, defAcc, mouseX, mouseY, waveCount
            );
            emitCanvas2DFacet(
              ctx2d,
              gridX[idxB], gridY[idxB], gridZ[idxB],
              gridX[idxD], gridY[idxD], gridZ[idxD],
              gridX[idxC], gridY[idxC], gridZ[idxC],
              defPri, defAcc, mouseX, mouseY, waveCount
            );
          }
        }

        ctx2d.beginPath();
        for (let r = 0; r < maxRow; r++) {
          const r1 = r * stride;
          const r2 = r1 + stride;
          for (let c = 0; c < maxCol; c++) {
            const idxA = r1 + c;
            const idxB = idxA + 1;
            const idxC = r2 + c;
            ctx2d.moveTo(gridX[idxA], gridY[idxA]);
            ctx2d.lineTo(gridX[idxB], gridY[idxB]);
            ctx2d.lineTo(gridX[idxC], gridY[idxC]);
            ctx2d.lineTo(gridX[idxA], gridY[idxA]);
          }
        }
        ctx2d.strokeStyle = `rgba(${wirePri.r},${wirePri.g},${wirePri.b},0.10)`;
        ctx2d.lineWidth = 0.55;
        ctx2d.stroke();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rightPointerResetTimer) clearTimeout(rightPointerResetTimer);
      if (textBlurTimerRef.current) clearTimeout(textBlurTimerRef.current);
      if (textUnblurTimerRef.current) clearTimeout(textUnblurTimerRef.current);
      activeWaveCountRef.current = 0;
      isWaveBlurPendingRef.current = false;
      pendingCommitPaletteIdRef.current = null;
      setIsTextBlurred(false);
      if (gl) {
        if (glTriBuf) gl.deleteBuffer(glTriBuf);
        if (glWireBuf) gl.deleteBuffer(glWireBuf);
        if (glGlintBuf) gl.deleteBuffer(glGlintBuf);
        if (glProgram) gl.deleteProgram(glProgram);
      }
    };
  }, [quality]);

  return (
    <div
      className="dark relative w-full h-[100dvh] md:h-screen overflow-hidden select-none"
      style={{ backgroundColor: displayPalette?.bgDark || '#06090e' }}
    >
      {/* Hardware-accelerated Simulation Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{
          imageRendering: quality === 'performance' ? 'pixelated' : 'auto',
        }}
      />

      {/* Floating Canvas Resolution / Performance Switcher */}
      <div
        className={`absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2 max-w-[calc(100vw-1.5rem)] transition-opacity duration-300 ${
          isTextBlurred ? 'opacity-70' : 'opacity-100'
        }`}
      >
        <div className="relative">
          <div className="flex items-center gap-1.5 p-1 rounded-full liquid-glass no-lift border border-white/10 shadow-lg text-xs">
            {/* Live FPS Badge (Direct DOM updates avoid React re-renders) */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/60 font-mono text-[11px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span ref={fpsTextRef}>60 FPS</span>
            </div>

            {/* Quick Preset Buttons */}
            {(['performance', 'balanced', 'ultra'] as QualityTier[]).map((tier) => {
              const active = quality === tier;
              const preset = QUALITY_PRESETS[tier];
              return (
                <button
                  key={tier}
                  onClick={() => handleQualityChange(tier)}
                  className={`px-2 md:px-3 py-1 rounded-full transition text-[11px] font-medium flex items-center gap-1 ${
                    active
                      ? 'shadow-sm font-semibold text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor:
                            displayPalette?.id === 'black-night'
                              ? 'rgba(255, 255, 255, 0.18)'
                              : `${displayPalette?.primary || '#f59e0b'}40`,
                          color: '#ffffff',
                          border:
                            displayPalette?.id === 'black-night'
                              ? '1px solid rgba(255, 255, 255, 0.35)'
                              : `1px solid ${displayPalette?.primary || '#f59e0b'}80`,
                          boxShadow:
                            displayPalette?.id === 'black-night'
                              ? '0 0 12px rgba(255, 255, 255, 0.15)'
                              : `0 0 12px ${displayPalette?.primary || '#f59e0b'}30`,
                        }
                      : {}
                  }
                  title={`${preset.desc} (${preset.badge})`}
                >
                  {tier === 'performance' && <Zap className="w-3 h-3 text-white" />}
                  {tier === 'balanced' && <Gauge className="w-3 h-3 text-white" />}
                  {tier === 'ultra' && <Sparkles className="w-3 h-3 text-white" />}
                  <span className="text-white">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4 md:px-6 pb-16 md:pb-0">
        <div
          className={`max-w-3xl text-center space-y-6 hero-text-blur-wrapper ${
            isTextBlurred ? 'hero-text-blurred' : 'hero-text-focused'
          }`}
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium tracking-wide bg-slate-900/60"
            style={{
              borderColor: `${displayPalette?.primary || '#f59e0b'}50`,
              color: displayPalette?.primary || '#f59e0b',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: displayPalette?.primary || '#f59e0b' }}
            />
            <span>Harmonizing Learning with Neural Synthesis</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white">
            Harness Learnings{' '}
            <span
              style={{
                backgroundImage:
                  displayPalette?.id === 'black-night'
                    ? 'linear-gradient(135deg, #f8fafc, #94a3b8)'
                    : `linear-gradient(135deg, ${displayPalette?.primary || '#f59e0b'}, ${displayPalette?.accent || '#dc2626'})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              With Aether
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            A fluid, flexible and capable knowledge studio, uniting note taking with artificial intelligence with topographic study tracking and fully customizable liquid glass aesthetics
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={onEnterApp}
              className="glow-button rounded-full shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-[transform,scale,box-shadow] duration-200 text-sm font-semibold"
              style={{
                ['--button-shine-left' as any]:
                  displayPalette?.id === 'black-night' ? '#27272a' : displayPalette?.primary || '#f59e0b',
                ['--button-shine-right' as any]:
                  displayPalette?.id === 'black-night' ? '#09090b' : displayPalette?.accent || '#dc2626',
                ['--button-glow-start' as any]:
                  displayPalette?.id === 'black-night' ? '#050505' : displayPalette?.primary || '#f59e0b',
                ['--button-glow-end' as any]:
                  displayPalette?.id === 'black-night' ? '#000000' : displayPalette?.accent || '#dc2626',
                ...(displayPalette?.id === 'black-night'
                  ? {
                      boxShadow: '0 0 35px 4px rgba(0, 0, 0, 0.95), inset 0 0 12px rgba(255, 255, 255, 0.08)',
                    }
                  : {}),
              }}
            >
              <div className="gradient" />
              <span className="px-7 py-3 rounded-full flex items-center gap-2.5">
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: displayPalette?.id === 'black-night' ? '#f1f5f9' : displayPalette?.primary }}
                />
                <span className="font-bold text-white tracking-wide">
                  {isLoggedIn ? 'To Dashboard' : 'Launch Aether'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
