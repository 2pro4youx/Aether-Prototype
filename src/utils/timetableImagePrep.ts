export interface PreparedTimetableImage {
  dataUrl: string;
  mimeType: string;
  label: string;
}

export interface TimetableImagePrepResult {
  images: PreparedTimetableImage[];
  isWidePanoramic: boolean;
  originalWidth: number;
  originalHeight: number;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for preprocessing.'));
    img.src = dataUrl;
  });
}

function renderCroppedRegion(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  scale: number
): string {
  const targetW = Math.max(1, Math.round(sw * scale));
  const targetH = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/png');
}

function renderStitchedHeaderAndSlice(
  img: HTMLImageElement,
  headerRatio: number,
  sliceStartRatio: number,
  sliceEndRatio: number,
  scale: number
): string {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const headerW = Math.max(1, Math.round(W * headerRatio));
  const sliceX = Math.max(0, Math.round(W * sliceStartRatio));
  const sliceW = Math.max(1, Math.round(W * sliceEndRatio) - sliceX);
  const gapPx = 6;

  const targetHeaderW = Math.round(headerW * scale);
  const targetSliceW = Math.round(sliceW * scale);
  const targetH = Math.max(1, Math.round(H * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetHeaderW + gapPx + targetSliceW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Left row-label column (weekdays or time headers)
  ctx.drawImage(img, 0, 0, headerW, H, 0, 0, targetHeaderW, targetH);

  // Subtle dark divider so Gemini sees the stitched seam clearly
  ctx.fillStyle = '#334155';
  ctx.fillRect(targetHeaderW + 2, 0, 2, targetH);

  // Target right-side columns
  ctx.drawImage(
    img,
    sliceX,
    0,
    sliceW,
    H,
    targetHeaderW + gapPx,
    0,
    targetSliceW,
    targetH
  );

  return canvas.toDataURL('image/png');
}

/**
 * Prepares a timetable photo for high-accuracy multimodal decoding.
 * Wide panoramic ERP timetables (e.g. 1727x185) shrink down to unreadable 10px-tall rows
 * if sent whole at default vision resolution. This upscales cleanly and—for wide grids—generates
 * zoomed overlapping left and right panels (both with row-label headers anchored on the left).
 */
export async function prepareTimetableImagesForDecoding(
  rawDataUrl: string,
  fallbackMime = 'image/png'
): Promise<TimetableImagePrepResult> {
  if (typeof document === 'undefined' || !rawDataUrl.startsWith('data:image/')) {
    return {
      images: [{ dataUrl: rawDataUrl, mimeType: fallbackMime, label: 'original' }],
      isWidePanoramic: false,
      originalWidth: 0,
      originalHeight: 0,
    };
  }

  try {
    const img = await loadImageElement(rawDataUrl);
    const W = img.naturalWidth || 0;
    const H = img.naturalHeight || 0;
    if (!W || !H) {
      return {
        images: [{ dataUrl: rawDataUrl, mimeType: fallbackMime, label: 'original' }],
        isWidePanoramic: false,
        originalWidth: W,
        originalHeight: H,
      };
    }

    const aspect = W / H;

    // Wide panoramic table (like university slot grids e.g. 1727x185)
    if (aspect >= 2.2) {
      // Scale factor so rows have comfortable legible height (~480-680px total) while keeping panel width <= 2400px
      const zoomScale = Math.min(3.4, Math.max(1.8, 560 / H));
      const leftPanelEndW = Math.round(W * 0.62);
      const leftScale = Math.min(zoomScale, 2400 / leftPanelEndW);
      const leftPanel = renderCroppedRegion(img, 0, 0, leftPanelEndW, H, leftScale);

      // Right panel: leftmost 27% (day/time row header) + 46%..100% (overlapping middle column for continuity)
      const rightCombinedW = Math.round(W * 0.27) + Math.round(W * 0.54);
      const rightScale = Math.min(zoomScale, 2400 / rightCombinedW);
      const rightPanel = renderStitchedHeaderAndSlice(img, 0.27, 0.46, 1.0, rightScale);

      // Full upscaled overview (capped cleanly)
      const overviewScale = Math.min(2.0, 2400 / W);
      const overview = renderCroppedRegion(img, 0, 0, W, H, overviewScale);

      const result: PreparedTimetableImage[] = [];
      if (leftPanel) {
        result.push({
          dataUrl: leftPanel,
          mimeType: 'image/png',
          label: 'left_half_zoomed',
        });
      }
      if (rightPanel) {
        result.push({
          dataUrl: rightPanel,
          mimeType: 'image/png',
          label: 'right_half_zoomed_with_row_headers',
        });
      }
      if (overview) {
        result.push({
          dataUrl: overview,
          mimeType: 'image/png',
          label: 'full_table_overview',
        });
      }

      if (result.length > 0) {
        return {
          images: result,
          isWidePanoramic: true,
          originalWidth: W,
          originalHeight: H,
        };
      }
    }

    // Standard aspect ratio: upscale small screenshots so text is crisp
    if (W < 1500 && H < 1500) {
      const scale = Math.min(2.5, Math.max(1500 / W, 1100 / H));
      const upscaled = renderCroppedRegion(img, 0, 0, W, H, scale);
      if (upscaled) {
        return {
          images: [{ dataUrl: upscaled, mimeType: 'image/png', label: 'upscaled' }],
          isWidePanoramic: false,
          originalWidth: W,
          originalHeight: H,
        };
      }
    }

    return {
      images: [{ dataUrl: rawDataUrl, mimeType: fallbackMime, label: 'original' }],
      isWidePanoramic: false,
      originalWidth: W,
      originalHeight: H,
    };
  } catch {
    return {
      images: [{ dataUrl: rawDataUrl, mimeType: fallbackMime, label: 'original' }],
      isWidePanoramic: false,
      originalWidth: 0,
      originalHeight: 0,
    };
  }
}
