import type {
  CanvasCommand,
  FillCommand,
  NormalizedPoint,
  RoundArtwork,
  StrokeCommand,
} from '../shared/types.ts';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b, 255];
}

export function clearCanvasToWhite(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();
}

export function drawStrokeCommand(
  ctx: CanvasRenderingContext2D,
  cmd: StrokeCommand
): void {
  const pts = cmd.points;
  if (!pts || pts.length === 0) return;

  const toX = (p: NormalizedPoint) => p.x * CANVAS_WIDTH;
  const toY = (p: NormalizedPoint) => p.y * CANVAS_HEIGHT;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const color = cmd.tool === 'eraser' ? '#FFFFFF' : cmd.color;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = cmd.size;
  ctx.globalAlpha = 1;

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(toX(pts[0]), toY(pts[0]), Math.max(1, cmd.size / 2), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(toX(pts[0]), toY(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (toX(pts[i]) + toX(pts[i + 1])) / 2;
      const midY = (toY(pts[i]) + toY(pts[i + 1])) / 2;
      ctx.quadraticCurveTo(toX(pts[i]), toY(pts[i]), midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(toX(last), toY(last));
    ctx.stroke();
  }

  ctx.restore();
}

export function applyFloodFill(
  ctx: CanvasRenderingContext2D,
  cmd: FillCommand
): void {
  const startX = Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(cmd.x * CANVAS_WIDTH)));
  const startY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(cmd.y * CANVAS_HEIGHT)));

  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const [fillR, fillG, fillB, fillA] = hexToRgba(cmd.color);

  const startIdx = (startY * CANVAS_WIDTH + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];

  if (
    Math.abs(targetR - fillR) <= 2 &&
    Math.abs(targetG - fillG) <= 2 &&
    Math.abs(targetB - fillB) <= 2
  ) {
    return;
  }

  const tolerance = 32;
  const matchesTarget = (pixelPos: number) => {
    const i = pixelPos * 4;
    return (
      Math.abs(data[i] - targetR) <= tolerance &&
      Math.abs(data[i + 1] - targetG) <= tolerance &&
      Math.abs(data[i + 2] - targetB) <= tolerance
    );
  };

  const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
  const stack: number[] = [startY * CANVAS_WIDTH + startX];

  while (stack.length > 0) {
    const pos = stack.pop()!;
    if (visited[pos]) continue;

    let x = pos % CANVAS_WIDTH;
    const y = (pos - x) / CANVAS_WIDTH;

    while (
      x > 0 &&
      !visited[y * CANVAS_WIDTH + (x - 1)] &&
      matchesTarget(y * CANVAS_WIDTH + (x - 1))
    ) {
      x -= 1;
    }

    let spanAbove = false;
    let spanBelow = false;

    while (x < CANVAS_WIDTH) {
      const idx = y * CANVAS_WIDTH + x;
      if (visited[idx] || !matchesTarget(idx)) break;

      visited[idx] = 1;
      const d = idx * 4;
      data[d] = fillR;
      data[d + 1] = fillG;
      data[d + 2] = fillB;
      data[d + 3] = fillA;

      if (y > 0) {
        const upIdx = (y - 1) * CANVAS_WIDTH + x;
        const upMatch = !visited[upIdx] && matchesTarget(upIdx);
        if (!spanAbove && upMatch) {
          stack.push(upIdx);
          spanAbove = true;
        } else if (spanAbove && !upMatch) {
          spanAbove = false;
        }
      }

      if (y < CANVAS_HEIGHT - 1) {
        const downIdx = (y + 1) * CANVAS_WIDTH + x;
        const downMatch = !visited[downIdx] && matchesTarget(downIdx);
        if (!spanBelow && downMatch) {
          stack.push(downIdx);
          spanBelow = true;
        } else if (spanBelow && !downMatch) {
          spanBelow = false;
        }
      }

      x += 1;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function applyCanvasCommand(
  ctx: CanvasRenderingContext2D,
  cmd: CanvasCommand
): void {
  if (cmd.kind === 'stroke') {
    drawStrokeCommand(ctx, cmd);
  } else if (cmd.kind === 'fill') {
    applyFloodFill(ctx, cmd);
  }
}

export function renderCommandsToCanvas(
  ctx: CanvasRenderingContext2D,
  commands: CanvasCommand[]
): void {
  clearCanvasToWhite(ctx);
  for (const cmd of commands) {
    applyCanvasCommand(ctx, cmd);
  }
}

export function renderCommandsToDataUrl(
  commands: CanvasCommand[],
  options?: { framed?: boolean; word?: string; artistName?: string; roomName?: string }
): string {
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = CANVAS_WIDTH;
  baseCanvas.height = CANVAS_HEIGHT;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!baseCtx) return '';
  renderCommandsToCanvas(baseCtx, commands);

  if (!options?.framed) {
    return baseCanvas.toDataURL('image/png');
  }

  const pad = 28;
  const footerHeight = 68;
  const out = document.createElement('canvas');
  out.width = CANVAS_WIDTH + pad * 2;
  out.height = CANVAS_HEIGHT + pad * 2 + footerHeight;
  const ctx = out.getContext('2d');
  if (!ctx) return baseCanvas.toDataURL('image/png');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad - 1, pad - 1, CANVAS_WIDTH + 2, CANVAS_HEIGHT + 2);
  ctx.drawImage(baseCanvas, pad, pad);

  const footerY = pad + CANVAS_HEIGHT + 34;
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 24px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(
    options.word ? `"${options.word}"` : 'InkStream Artwork',
    pad,
    footerY
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
  const meta = `Drawn by ${options.artistName ?? 'Artist'}${
    options.roomName ? ` · ${options.roomName}` : ''
  }`;
  ctx.fillText(meta, pad, footerY + 24);

  ctx.fillStyle = '#2563EB';
  ctx.font = '700 16px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('InkStream', out.width - pad, footerY + 12);

  return out.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${safeName || 'inkstream-artwork'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function renderArtworkThumbnail(artwork: RoundArtwork): string {
  return renderCommandsToDataUrl(artwork.commands, { framed: false });
}
