export type ReportChart = {
  title: string;
  dataUrl: string;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image du graphique illisible."));
    image.src = src;
  });
}

function whiteCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function svgToChartDataUrl(svg: SVGSVGElement): Promise<ReportChart["dataUrl"] | null> {
  const rect = svg.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 80 || height < 60) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Les couleurs Recharts reposent sur des variables CSS (var(--chart-1)) : on les
  // remplace par leur valeur calculée, sinon le SVG isolé s'affiche en noir.
  const originals = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const copies = [clone, ...Array.from(clone.querySelectorAll("*"))];
  originals.forEach((source, index) => {
    const target = copies[index];
    if (!target) return;
    const style = window.getComputedStyle(source);
    if (style.fill) target.setAttribute("fill", style.fill);
    if (style.stroke && style.stroke !== "none") {
      target.setAttribute("stroke", style.stroke);
      if (style.strokeWidth) target.setAttribute("stroke-width", style.strokeWidth);
    }
    if (style.opacity && style.opacity !== "1") target.setAttribute("opacity", style.opacity);
    if (source.tagName.toLowerCase() === "text") {
      target.setAttribute("font-family", "Helvetica, Arial, sans-serif");
      if (style.fontSize) target.setAttribute("font-size", style.fontSize);
      if (style.fontWeight) target.setAttribute("font-weight", style.fontWeight);
    }
  });

  const xml = new XMLSerializer().serializeToString(clone);
  const blobUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(blobUrl);
    const scale = 2;
    const canvas = whiteCanvas(width * scale, height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function canvasToChartDataUrl(canvas: HTMLCanvasElement): ReportChart["dataUrl"] | null {
  if (canvas.width < 80 || canvas.height < 60) return null;
  try {
    const scale = Math.min(2, 1600 / canvas.width);
    const target = whiteCanvas(canvas.width * scale, canvas.height * scale);
    const context = target.getContext("2d");
    if (!context) return null;
    context.drawImage(canvas, 0, 0, target.width, target.height);
    return target.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Capture les graphiques rendus dans la conversation pour les insérer dans le PDF.
 * Les figures sans SVG ni canvas (tableaux, cartes de texte) sont ignorées.
 */
export async function captureChartImages(
  root: ParentNode = document,
  max = 8,
): Promise<ReportChart[]> {
  const figures = Array.from(root.querySelectorAll("figure"));
  const charts: ReportChart[] = [];
  for (const figure of figures) {
    if (charts.length >= max) break;
    const canvas = figure.querySelector("canvas");
    const svg = figure.querySelector("svg");
    let dataUrl: string | null = null;
    if (canvas) dataUrl = canvasToChartDataUrl(canvas);
    else if (svg) dataUrl = await svgToChartDataUrl(svg as SVGSVGElement);
    if (!dataUrl) continue;
    const rect = (svg ?? canvas)!.getBoundingClientRect();
    const width = Math.round(rect.width) || 700;
    const height = Math.round(rect.height) || 280;
    const title = figure.querySelector("figcaption")?.textContent?.trim() ?? "";
    charts.push({ title, dataUrl, width, height });
  }
  return charts;
}
