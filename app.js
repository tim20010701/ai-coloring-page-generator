(() => {
  'use strict';
  const PAPER = { a4: { name: 'A4', width: 2480, height: 3508, points: [595.28, 841.89] }, letter: { name: 'US Letter', width: 2550, height: 3300, points: [612, 792] } };
  const fileInput = document.querySelector('#file-input');
  const dropzone = document.querySelector('#dropzone');
  const sourceCanvas = document.querySelector('#source-canvas');
  const resultCanvas = document.querySelector('#result-canvas');
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
  const detail = document.querySelector('#detail'); const thickness = document.querySelector('#thickness'); const invert = document.querySelector('#invert'); const paperSize = document.querySelector('#paper-size');
  const detailValue = document.querySelector('#detail-value'); const thicknessValue = document.querySelector('#thickness-value'); const status = document.querySelector('#status'); const note = document.querySelector('#export-note');
  const controls = document.querySelector('#controls'); const exportsBox = document.querySelector('#exports');
  let sourceImage = null; let outputCanvas = null; let sourceName = 'coloring-page'; let renderTimer = null;

  function setStatus(message, ready = false) { status.textContent = message; status.classList.toggle('ready', ready); }
  function setEnabled(enabled) { controls.classList.toggle('is-disabled', !enabled); controls.setAttribute('aria-disabled', String(!enabled)); exportsBox.classList.toggle('is-disabled', !enabled); exportsBox.setAttribute('aria-disabled', String(!enabled)); }
  function fileBaseName(name) { return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'coloring-page'; }
  function fit(width, height, maxSide) { const scale = Math.min(1, maxSide / Math.max(width, height)); return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }; }
  function drawSourcePreview() { const size = fit(sourceImage.naturalWidth, sourceImage.naturalHeight, 1200); sourceCanvas.width = size.width; sourceCanvas.height = size.height; sourceCtx.clearRect(0, 0, size.width, size.height); sourceCtx.drawImage(sourceImage, 0, 0, size.width, size.height); }
  function sourcePixels(width, height) { const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); const ratio = Math.min(width / sourceImage.naturalWidth, height / sourceImage.naturalHeight); const w = Math.round(sourceImage.naturalWidth * ratio); const h = Math.round(sourceImage.naturalHeight * ratio); ctx.drawImage(sourceImage, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h); return ctx.getImageData(0, 0, width, height); }
  function createLineArt(width, height) {
    const input = sourcePixels(width, height); const data = input.data; const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) gray[p] = Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114);
    const edge = new Uint8Array(width * height); const level = Number(detail.value); const threshold = 270 - level * 2.25;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] + gray[i - width + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + width - 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      if (Math.hypot(gx, gy) > threshold) edge[i] = 1;
    }
    const radius = Number(thickness.value) - 1; const out = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let black = edge[y * width + x] === 1;
      if (!black && radius) for (let dy = -radius; dy <= radius && !black; dy++) for (let dx = -radius; dx <= radius; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < width && yy >= 0 && yy < height && edge[yy * width + xx]) { black = true; break; } }
      const v = (black !== invert.checked) ? 0 : 255; const p = (y * width + x) * 4; out[p] = out[p + 1] = out[p + 2] = v; out[p + 3] = 255;
    }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.getContext('2d').putImageData(new ImageData(out, width, height), 0, 0); return canvas;
  }
  function renderPreview() { if (!sourceImage) return; const size = fit(sourceImage.naturalWidth, sourceImage.naturalHeight, 1150); setStatus('Refreshing preview…'); const art = createLineArt(size.width, size.height); resultCanvas.width = art.width; resultCanvas.height = art.height; resultCtx.drawImage(art, 0, 0); setStatus('Preview ready', true); }
  function schedulePreview() { detailValue.textContent = detail.value; thicknessValue.textContent = thickness.value; clearTimeout(renderTimer); renderTimer = setTimeout(renderPreview, 80); }
  async function ensureOutput() { const paper = PAPER[paperSize.value]; setStatus('Preparing 300 DPI export…'); await new Promise(requestAnimationFrame); outputCanvas = createLineArt(paper.width, paper.height); setStatus('Export ready', true); note.textContent = `${paper.name} export: ${paper.width} × ${paper.height} px at 300 DPI.`; return { canvas: outputCanvas, paper }; }
  function download(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  function canvasBlob(canvas, type, quality) { return new Promise(resolve => canvas.toBlob(resolve, type, quality)); }
  async function downloadPng() { const { canvas, paper } = await ensureOutput(); const blob = await canvasBlob(canvas, 'image/png'); download(blob, `${sourceName}-${paper.name.toLowerCase().replace(' ', '-')}-300dpi.png`); }
  function jpegBytes(canvas) { const base64 = canvas.toDataURL('image/jpeg', .96).split(',')[1]; const raw = atob(base64); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); return bytes; }
  function printablePdf(canvas, paper) {
    const image = jpegBytes(canvas); const [pw, ph] = paper.points; const encoder = new TextEncoder(); const parts = []; const offsets = []; let length = 0;
    const add = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; parts.push(bytes); length += bytes.length; };
    add('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
    const obj = (n, body) => { offsets[n] = length; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = length; add('4 0 obj\n'); add(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`); add(image); add('\nendstream\nendobj\n');
    const stream = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`; obj(5, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
    const xref = length; add('xref\n0 6\n0000000000 65535 f \n'); for (let i = 1; i <= 5; i++) add(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`); add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const total = parts.reduce((n, p) => n + p.length, 0); const pdf = new Uint8Array(total); let at = 0; for (const part of parts) { pdf.set(part, at); at += part.length; } return new Blob([pdf], { type: 'application/pdf' });
  }
  async function downloadPdf() { const { canvas, paper } = await ensureOutput(); download(printablePdf(canvas, paper), `${sourceName}-${paper.name.toLowerCase().replace(' ', '-')}-300dpi.pdf`); }
  async function printPage() { const { canvas, paper } = await ensureOutput(); const win = window.open('', '_blank'); if (!win) { setStatus('Allow pop-ups to print this page'); return; } const image = canvas.toDataURL('image/png'); win.document.write(`<!doctype html><title>Print coloring page</title><style>@page{size:${paper.name === 'A4' ? 'A4' : 'letter'};margin:0}html,body{margin:0}img{width:100%;height:100%;display:block;object-fit:contain}</style><img src="${image}" onload="window.print()">`); win.document.close(); }
  function loadFile(file) { if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); setStatus('Reading photo…'); reader.onload = () => { sourceImage = new Image(); sourceImage.onload = () => { sourceName = fileBaseName(file.name); drawSourcePreview(); setEnabled(true); schedulePreview(); note.textContent = 'Preview is ready. Downloads are prepared at the selected 300 DPI paper size.'; }; sourceImage.src = reader.result; }; reader.readAsDataURL(file); }
  fileInput.addEventListener('change', e => loadFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add('is-dragging'); }));
  ['dragleave','drop'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove('is-dragging'); })); dropzone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  [detail, thickness, invert].forEach(el => el.addEventListener('input', schedulePreview)); paperSize.addEventListener('change', () => { if (sourceImage) note.textContent = `Selected ${PAPER[paperSize.value].name}. Exports will be rendered at 300 DPI.`; });
  document.querySelector('#download-png').addEventListener('click', downloadPng); document.querySelector('#download-pdf').addEventListener('click', downloadPdf); document.querySelector('#print-page').addEventListener('click', printPage);
})();
