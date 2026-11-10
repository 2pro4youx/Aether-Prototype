import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Zap, Gauge } from 'lucide-react';
import { ColorPalette, ColorPaletteId } from '../types';
import { PALETTES } from '../data/mockData';

interface PolygonCanvasProps {
  onEnterApp?: () => void;
  activePalette?: ColorPalette;
  onPaletteChange?: (paletteId: ColorPaletteId) => void;
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

// Revolve forward through the curated 10-gradient order
const getNextThemeInOrder = (current: ColorPalette): ColorPalette => {
  const currentIndex = PALETTES.findIndex((p) => p.id === current.id);
  const nextIndex = (currentIndex + 1) % PALETTES.length;
  return PALETTES[nextIndex];
};

export const PolygonCanvas: React.FC<PolygonCanvasProps> = ({
  onEnterApp,
  activePalette,
  onPaletteChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePaletteRef = useRef<ColorPalette>(activePalette || PALETTES[0]);
  activePaletteRef.current = activePalette || PALETTES[0];

  const onPaletteChangeRef = useRef(onPaletteChange);
  onPaletteChangeRef.current = onPaletteChange;

  const [displayPalette, setDisplayPalette] = useState<ColorPalette>(
    () => activePalette || PALETTES[0]
  );
  const [isTextBlurred, setIsTextBlurred] = useState(false);
  const textBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textUnblurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activePalette) {
      activePaletteRef.current = activePalette;
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

  const [fps, setFps] = useState<number>(60);

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
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    const config = QUALITY_PRESETS[quality];
    const renderScale = config.scale;
    const step = config.step;

    // Internal buffer size (scaled for GPU fill-rate efficiency)
    let internalWidth = (canvas.width = Math.max(320, Math.round(window.innerWidth * renderScale)));
    let internalHeight = (canvas.height = Math.max(240, Math.round(window.innerHeight * renderScale)));

    const parseHex = (hex: string): RGB => {
      const clean = (hex || '#f59e0b').replace('#', '');
      return {
        r: parseInt(clean.substring(0, 2), 16) || 245,
        g: parseInt(clean.substring(2, 4), 16) || 158,
        b: parseInt(clean.substring(4, 6), 16) || 11,
      };
    };

    let currentPalette: ColorPalette = activePaletteRef.current;

    // Stackable animations
    const activeBursts: ClickBurst[] = [];
    const activeWaves: ThemeWave[] = [];
    let waveIdCounter = 0;

    // Mouse tracking in internal buffer coordinates
    const mouse = {
      x: internalWidth / 2,
      y: internalHeight / 2,
      targetX: internalWidth / 2,
      targetY: internalHeight / 2,
      radius: Math.round(180 * renderScale),
      radiusSq: Math.round(180 * renderScale) ** 2,
      active: false,
    };

    const handleResize = () => {
      if (!canvas) return;
      internalWidth = canvas.width = Math.max(320, Math.round(window.innerWidth * renderScale));
      internalHeight = canvas.height = Math.max(240, Math.round(window.innerHeight * renderScale));
      mouse.radius = Math.round(180 * renderScale);
      mouse.radiusSq = mouse.radius ** 2;
      initGrid();
    };

    window.addEventListener('resize', handleResize);

    let lastDragX = 0;
    let lastDragY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const currX = (e.clientX - rect.left) * scaleX;
      const currY = (e.clientY - rect.top) * scaleY;
      mouse.targetX = currX;
      mouse.targetY = currY;
      mouse.active = true;

      // When dragging with mouse button held down, spawn continuous ripples along the trail
      if (e.buttons & 1) {
        const dist = Math.hypot(currX - lastDragX, currY - lastDragY);
        if (dist > 36 * renderScale) {
          lastDragX = currX;
          lastDragY = currY;
          spawnBurstRipple(e.clientX, e.clientY, 0.75);
        }
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    // 1. Left-click / Drag: spawn instant stackable circular shockwave ripples
    const spawnBurstRipple = (clientX: number, clientY: number, strengthMultiplier = 1.0) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const originX = (clientX - rect.left) * scaleX;
      const originY = (clientY - rect.top) * scaleY;

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
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const originX = (clientX - rect.left) * scaleX;
      const originY = (clientY - rect.top) * scaleY;

      // Determine palette progression revolving in order
      let fromPal = currentPalette;
      if (activeWaves.length > 0) {
        fromPal = activeWaves[activeWaves.length - 1].toPalette;
      }
      const toPal = getNextThemeInOrder(fromPal);

      // Furthest distance to the 4 canvas corners
      const corners = [
        { x: 0, y: 0 },
        { x: internalWidth, y: 0 },
        { x: 0, y: internalHeight },
        { x: internalWidth, y: internalHeight },
      ];
      const maxCornerDist = Math.max(
        ...corners.map((c) => Math.hypot(c.x - originX, c.y - originY))
      );

      const waveWidth = Math.round(115 * renderScale);
      const maxRadius = maxCornerDist + waveWidth * 1.5;
      const speed = Math.max(16, Math.round(25 * renderScale));

      // Push stackable theme wave
      activeWaves.push({
        id: ++waveIdCounter,
        x: originX,
        y: originY,
        radius: 0,
        maxRadius,
        speed,
        waveWidth,
        fromPalette: fromPal,
        toPalette: toPal,
        fromPri: parseHex(fromPal.primary),
        fromAcc: parseHex(fromPal.accent),
        toPri: parseHex(toPal.primary),
        toAcc: parseHex(toPal.accent),
        fromBg: parseHex(fromPal.bgDark || '#06090e'),
        toBg: parseHex(toPal.bgDark || '#06090e'),
      });

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
      setIsTextBlurred(true);
      if (textBlurTimerRef.current) clearTimeout(textBlurTimerRef.current);
      if (textUnblurTimerRef.current) clearTimeout(textUnblurTimerRef.current);

      textBlurTimerRef.current = setTimeout(() => {
        setDisplayPalette(toPal);
        textUnblurTimerRef.current = setTimeout(() => {
          setIsTextBlurred(false);
        }, 90);
      }, 280);
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      // Do not trigger canvas ripples on interactive buttons
      if ((e.target as HTMLElement | null)?.closest?.('button, a, input, select')) {
        return;
      }

      if (e.button === 2) {
        // Right-click: trigger theme-flip wave & burst
        e.preventDefault();
        e.stopPropagation();
        triggerThemeFlipWave(e.clientX, e.clientY);
      } else if (e.button === 0) {
        // Left-click: spawn instant shockwave ripple on press
        spawnBurstRipple(e.clientX, e.clientY, 1.0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerThemeFlipWave(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('contextmenu', handleContextMenu);

    // Grid lattice setup
    let cols = Math.ceil(internalWidth / step) + 2;
    let rows = Math.ceil(internalHeight / step) + 2;

    interface Point {
      x0: number;
      y0: number;
      x: number;
      y: number;
      z: number;
    }

    let grid: Point[][] = [];

    const initGrid = () => {
      cols = Math.ceil(internalWidth / step) + 2;
      rows = Math.ceil(internalHeight / step) + 2;
      grid = [];

      for (let r = 0; r <= rows; r++) {
        const row: Point[] = [];
        for (let c = 0; c <= cols; c++) {
          const x = (c - 1) * step;
          const y = (r - 1) * step;
          row.push({
            x0: x,
            y0: y,
            x,
            y,
            z: 0,
          });
        }
        grid.push(row);
      }
    };

    initGrid();

    let time = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    // Reusable trigonometric wave arrays to eliminate redundant calculations
    const waveCols = new Float32Array(cols + 1);
    const waveRows = new Float32Array(rows + 1);

    const render = (now: number) => {
      // FPS measurement
      frameCount++;
      if (now - lastFpsTime >= 600) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      time += 0.025;

      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      // Progress stackable left-click shockwave bursts
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const b = activeBursts[i];
        b.radius += b.speed;
        b.strength *= 0.94;
        if (b.strength < 0.3 || b.radius >= b.maxRadius) {
          activeBursts.splice(i, 1);
        }
      }

      // Progress stackable theme-flip waves
      for (let i = activeWaves.length - 1; i >= 0; i--) {
        const w = activeWaves[i];
        w.radius += w.speed;
        if (w.radius >= w.maxRadius) {
          currentPalette = w.toPalette;
          activeWaves.splice(i, 1);
          if (activeWaves.length === 0) {
            onPaletteChangeRef.current?.(w.toPalette.id);
          }
        }
      }

      // Smooth canvas background transition toward newest wave
      if (activeWaves.length > 0) {
        const latestWave = activeWaves[activeWaves.length - 1];
        const waveProg = Math.min(1, latestWave.radius / (latestWave.maxRadius * 0.85));
        const bgR = Math.round(latestWave.fromBg.r + (latestWave.toBg.r - latestWave.fromBg.r) * waveProg);
        const bgG = Math.round(latestWave.fromBg.g + (latestWave.toBg.g - latestWave.fromBg.g) * waveProg);
        const bgB = Math.round(latestWave.fromBg.b + (latestWave.toBg.b - latestWave.fromBg.b) * waveProg);
        ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
      } else {
        ctx.fillStyle = currentPalette.bgDark || '#06090e';
      }
      ctx.fillRect(0, 0, internalWidth, internalHeight);

      // Precalculate 1D wave components
      for (let c = 0; c <= cols; c++) {
        const x0 = (c - 1) * step;
        waveCols[c] = Math.sin(x0 * 0.012 + time * 1.2) * 12;
      }
      for (let r = 0; r <= rows; r++) {
        const y0 = (r - 1) * step;
        waveRows[r] = Math.cos(y0 * 0.014 - time * 0.9) * 10;
      }

      const mouseRad = mouse.radius;
      const mouseRadSq = mouse.radiusSq;

      // Update point heights (z)
      for (let r = 0; r <= rows; r++) {
        const row = grid[r];
        const wRow = waveRows[r];
        for (let c = 0; c <= cols; c++) {
          const p = row[c];
          const wave3 = Math.sin((p.x0 + p.y0) * 0.008 + time * 1.5) * 8;
          let targetZ = waveCols[c] + wRow + wave3;

          const dx = p.x0 - mouse.x;
          const dy = p.y0 - mouse.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < mouseRadSq) {
            const dist = Math.sqrt(distSq);
            const factor = Math.cos((dist / mouseRad) * (Math.PI / 2));
            targetZ += factor * 48;
          }

          // Stackable left-click burst ripples
          for (let i = 0; i < activeBursts.length; i++) {
            const b = activeBursts[i];
            const bDist = Math.hypot(p.x0 - b.x, p.y0 - b.y);
            const burstDist = Math.abs(bDist - b.radius);
            if (burstDist < 50) {
              targetZ += (1 - burstDist / 50) * b.strength * 1.8;
            }
          }

          // Stackable theme-flip wave elevations
          for (let i = 0; i < activeWaves.length; i++) {
            const w = activeWaves[i];
            const wDist = Math.hypot(p.x0 - w.x, p.y0 - w.y);
            const distFromCrest = Math.abs(wDist - w.radius);
            if (distFromCrest < w.waveWidth) {
              const crestCos = Math.cos((distFromCrest / w.waveWidth) * (Math.PI / 2));
              targetZ += crestCos * (58 * renderScale);
            }
          }

          p.z += (targetZ - p.z) * 0.18;
          p.x = p.x0 + p.z * 0.25;
          p.y = p.y0 + p.z * 0.35;
        }
      }

      // PASS 1: Draw triangular facets with 3D polygon flipping as stacked waves pass
      const maxCol = cols - 1;
      const maxRow = rows - 1;

      const defPri = parseHex(currentPalette.primary);
      const defAcc = parseHex(currentPalette.accent);

      for (let r = 0; r < maxRow; r++) {
        const r1 = grid[r];
        const r2 = grid[r + 1];
        for (let c = 0; c < maxCol; c++) {
          const pA = r1[c];
          const pB = r1[c + 1];
          const pC = r2[c];
          const pD = r2[c + 1];

          drawFacet(ctx, pA, pB, pC);
          drawFacet(ctx, pB, pD, pC);
        }
      }

      function drawFacet(
        targetCtx: CanvasRenderingContext2D,
        p1: Point,
        p2: Point,
        p3: Point
      ) {
        const midX = (p1.x + p2.x + p3.x) * 0.3333;
        const midY = (p1.y + p2.y + p3.y) * 0.3333;
        const avgZ = (p1.z + p2.z + p3.z) * 0.3333;

        const mdx = midX - mouse.x;
        const mdy = midY - mouse.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        const hoverIntensity = mDistSq < 62500 ? Math.max(0, 1 - Math.sqrt(mDistSq) * 0.004) : 0;
        const t = Math.max(0, Math.min(1, (avgZ + 15) * 0.02));

        let pt1X = p1.x;
        let pt1Y = p1.y;
        let pt2X = p2.x;
        let pt2Y = p2.y;
        let pt3X = p3.x;
        let pt3Y = p3.y;

        let pri = defPri;
        let acc = defAcc;
        let specular = 0;
        let edgeGlint = 0;

        // Check active waves in reverse chronological order (newest wave has highest precedence)
        for (let w = activeWaves.length - 1; w >= 0; w--) {
          const wave = activeWaves[w];
          const dxW = midX - wave.x;
          const dyW = midY - wave.y;
          const distW = Math.hypot(dxW, dyW);
          const waveRadius = wave.radius;
          const wWidth = wave.waveWidth;

          if (distW > waveRadius + wWidth) {
            // Wave hasn't reached this facet yet, continue checking earlier wave
            continue;
          }

          if (distW < waveRadius - wWidth) {
            // Wave has completely passed: this facet is now in wave.toPalette
            pri = wave.toPri;
            acc = wave.toAcc;
            break;
          }

          // Actively flipping in this wave!
          const u = Math.max(0, Math.min(1, 0.5 - (distW - waveRadius) / (2 * wWidth)));
          const angle = u * Math.PI;

          // Compress across wave normal down to razor edge at u=0.5, then expand back
          const scaleN = Math.max(0.06, Math.abs(Math.cos(angle)));

          const len = distW || 1;
          const nx = dxW / len;
          const ny = dyW / len;
          const tx = -ny;
          const ty = nx;

          // Flip vertex 1
          const v1x = p1.x - midX;
          const v1y = p1.y - midY;
          pt1X = midX + (v1x * tx + v1y * ty) * tx + ((v1x * nx + v1y * ny) * scaleN) * nx;
          pt1Y = midY + (v1x * tx + v1y * ty) * ty + ((v1x * nx + v1y * ny) * scaleN) * ny;

          // Flip vertex 2
          const v2x = p2.x - midX;
          const v2y = p2.y - midY;
          pt2X = midX + (v2x * tx + v2y * ty) * tx + ((v2x * nx + v2y * ny) * scaleN) * nx;
          pt2Y = midY + (v2x * tx + v2y * ty) * ty + ((v2x * nx + v2y * ny) * scaleN) * ny;

          // Flip vertex 3
          const v3x = p3.x - midX;
          const v3y = p3.y - midY;
          pt3X = midX + (v3x * tx + v3y * ty) * tx + ((v3x * nx + v3y * ny) * scaleN) * nx;
          pt3Y = midY + (v3x * tx + v3y * ty) * ty + ((v3x * nx + v3y * ny) * scaleN) * ny;

          // Flip theme face at edge-on peak (u = 0.5)
          if (u < 0.5) {
            pri = wave.fromPri;
            acc = wave.fromAcc;
          } else {
            pri = wave.toPri;
            acc = wave.toAcc;
          }

          // Specular sheen peaks at 90° edge-on position
          specular = Math.sin(angle) * 70;

          // Brilliant white glint along the edge when facet is on-edge
          const edgeProximity = Math.abs(u - 0.5);
          if (edgeProximity < 0.14) {
            edgeGlint = 1 - edgeProximity / 0.14;
          }

          break; // Newest wave affecting this facet takes precedence
        }

        const red = Math.round(acc.r * (1 - t) + pri.r * t + hoverIntensity * 20 + specular);
        const green = Math.round(acc.g * (1 - t) + pri.g * t + hoverIntensity * 30 + specular);
        const blue = Math.round(acc.b * (1 - t) + pri.b * t + hoverIntensity * 20 + specular);
        const alpha = Math.max(0.25, Math.min(0.96, 0.35 + t * 0.45 + hoverIntensity * 0.25 + (specular / 70) * 0.3));

        targetCtx.beginPath();
        targetCtx.moveTo(pt1X, pt1Y);
        targetCtx.lineTo(pt2X, pt2Y);
        targetCtx.lineTo(pt3X, pt3Y);
        targetCtx.closePath();

        targetCtx.fillStyle = `rgba(${Math.min(255, red)}, ${Math.min(255, green)}, ${Math.min(255, blue)}, ${alpha})`;
        targetCtx.fill();

        if (edgeGlint > 0) {
          targetCtx.strokeStyle = `rgba(255, 255, 255, ${(edgeGlint * 0.65).toFixed(2)})`;
          targetCtx.lineWidth = 1.2;
          targetCtx.stroke();
        }
      }

      // PASS 2: Single-pass batched wireframe stroke
      ctx.beginPath();
      for (let r = 0; r < maxRow; r++) {
        const r1 = grid[r];
        const r2 = grid[r + 1];
        for (let c = 0; c < maxCol; c++) {
          const pA = r1[c];
          const pB = r1[c + 1];
          const pC = r2[c];

          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.lineTo(pC.x, pC.y);
          ctx.lineTo(pA.x, pA.y);
        }
      }
      const wirePri = activeWaves.length > 0 ? activeWaves[activeWaves.length - 1].toPri : defPri;
      ctx.strokeStyle = `rgba(${wirePri.r}, ${wirePri.g}, ${wirePri.b}, 0.10)`;
      ctx.lineWidth = 0.55;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (textBlurTimerRef.current) clearTimeout(textBlurTimerRef.current);
      if (textUnblurTimerRef.current) clearTimeout(textUnblurTimerRef.current);
    };
  }, [quality]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none transition-colors duration-300"
      style={{ backgroundColor: displayPalette?.bgDark || '#06090e' }}
    >
      {/* Hardware-scaled Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{
          imageRendering: quality === 'performance' ? 'pixelated' : 'auto',
        }}
      />

      {/* Floating Canvas Resolution / Performance Switcher */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2 hero-text-blur-wrapper ${
          isTextBlurred ? 'hero-text-blurred' : 'hero-text-focused'
        }`}
      >
        <div className="relative">
          <div className="flex items-center gap-1.5 p-1 rounded-full liquid-glass no-lift backdrop-blur-md border border-white/10 shadow-lg text-xs">
            {/* Live FPS Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/60 font-mono text-[11px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{fps} FPS</span>
            </div>

            {/* Quick Preset Buttons */}
            {(['performance', 'balanced', 'ultra'] as QualityTier[]).map((tier) => {
              const active = quality === tier;
              const preset = QUALITY_PRESETS[tier];
              return (
                <button
                  key={tier}
                  onClick={() => handleQualityChange(tier)}
                  className={`px-3 py-1 rounded-full transition text-[11px] font-medium flex items-center gap-1 ${
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
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-6">
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
              Like Google Notebook
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            A fluid, multi-source knowledge studio uniting NotebookLM source grounding, full-screen OneNote rich blocks, topographic study tracking, and Apple liquid glass aesthetics.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={onEnterApp}
              className="glow-button rounded-full shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 text-sm font-semibold"
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
                <span className="font-bold text-white tracking-wide">Launch Aether</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
