import { jsPDF } from "jspdf";

interface ExportOptions {
  templateName: string;
  scaleFactor: number; // pixels per mm
  imageUrl: string;
  drawingsData?: any;
  realDimensions?: { widthMm: number; heightMm: number };
}

/**
 * Exporte le gabarit en DXF (format CAD)
 * Note: Version simplifiée sans bibliothèque externe
 */
export async function exportToDXF(options: ExportOptions): Promise<Blob> {
  const { templateName, scaleFactor, drawingsData, realDimensions } = options;
  
  let dxfContent = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
TEMPLATE
70
0
62
4
6
CONTINUOUS
0
LAYER
2
DRAWINGS
70
0
62
1
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  // Ajouter le cadre du gabarit
  if (realDimensions) {
    const { widthMm, heightMm } = realDimensions;
    dxfContent += `0
LWPOLYLINE
8
TEMPLATE
90
5
70
1
10
0
20
0
10
${widthMm}
20
0
10
${widthMm}
20
${heightMm}
10
0
20
${heightMm}
10
0
20
0
`;
  }

  // Ajouter les dessins
  if (drawingsData && drawingsData.objects) {
    drawingsData.objects.forEach((obj: any) => {
      if (obj.type === "line") {
        const x1 = (obj.x1 || 0) / scaleFactor;
        const y1 = (obj.y1 || 0) / scaleFactor;
        const x2 = (obj.x2 || 0) / scaleFactor;
        const y2 = (obj.y2 || 0) / scaleFactor;
        dxfContent += `0
LINE
8
DRAWINGS
10
${x1}
20
${y1}
11
${x2}
21
${y2}
`;
      } else if (obj.type === "rect") {
        const x = (obj.left || 0) / scaleFactor;
        const y = (obj.top || 0) / scaleFactor;
        const w = (obj.width || 0) * (obj.scaleX || 1) / scaleFactor;
        const h = (obj.height || 0) * (obj.scaleY || 1) / scaleFactor;
        dxfContent += `0
LWPOLYLINE
8
DRAWINGS
90
5
70
1
10
${x}
20
${y}
10
${x + w}
20
${y}
10
${x + w}
20
${y + h}
10
${x}
20
${y + h}
10
${x}
20
${y}
`;
      } else if (obj.type === "circle") {
        const cx = ((obj.left || 0) + (obj.radius || 0)) / scaleFactor;
        const cy = ((obj.top || 0) + (obj.radius || 0)) / scaleFactor;
        const r = (obj.radius || 0) / scaleFactor;
        dxfContent += `0
CIRCLE
8
DRAWINGS
10
${cx}
20
${cy}
40
${r}
`;
      }
    });
  }

  dxfContent += `0
ENDSEC
0
EOF
`;

  return new Blob([dxfContent], { type: "application/dxf" });
}

/**
 * Exporte le gabarit en SVG
 */
export async function exportToSVG(options: ExportOptions): Promise<Blob> {
  const { templateName, scaleFactor, imageUrl, drawingsData, realDimensions } = options;
  
  // Charger l'image pour obtenir ses dimensions
  const img = await loadImage(imageUrl);
  const width = realDimensions?.widthMm || img.width / scaleFactor;
  const height = realDimensions?.heightMm || img.height / scaleFactor;
  
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}mm" 
     height="${height}mm" 
     viewBox="0 0 ${width} ${height}">
  <title>${templateName}</title>
  <defs>
    <style>
      .template-boundary { stroke: #000; stroke-width: 0.5; fill: none; }
      .drawing { stroke: #f00; stroke-width: 0.3; fill: none; }
      .dimension { fill: #0f0; font-size: 3px; font-family: Arial; }
    </style>
  </defs>
  
  <!-- Template boundary -->
  <rect class="template-boundary" x="0" y="0" width="${width}" height="${height}" />
  
  <!-- Template image as base64 -->
  <image xlink:href="${imageUrl}" x="0" y="0" width="${width}" height="${height}" opacity="0.5" />
  
  <!-- Drawings -->
  <g class="drawings">
`;

  // Convertir les dessins en SVG
  if (drawingsData && drawingsData.objects) {
    drawingsData.objects.forEach((obj: any) => {
      if (obj.type === "line") {
        const x1 = (obj.x1 || 0) / scaleFactor;
        const y1 = (obj.y1 || 0) / scaleFactor;
        const x2 = (obj.x2 || 0) / scaleFactor;
        const y2 = (obj.y2 || 0) / scaleFactor;
        svgContent += `    <line class="drawing" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />\n`;
      } else if (obj.type === "rect") {
        const x = (obj.left || 0) / scaleFactor;
        const y = (obj.top || 0) / scaleFactor;
        const w = (obj.width || 0) * (obj.scaleX || 1) / scaleFactor;
        const h = (obj.height || 0) * (obj.scaleY || 1) / scaleFactor;
        svgContent += `    <rect class="drawing" x="${x}" y="${y}" width="${w}" height="${h}" />\n`;
      } else if (obj.type === "circle") {
        const cx = ((obj.left || 0) + (obj.radius || 0)) / scaleFactor;
        const cy = ((obj.top || 0) + (obj.radius || 0)) / scaleFactor;
        const r = (obj.radius || 0) / scaleFactor;
        svgContent += `    <circle class="drawing" cx="${cx}" cy="${cy}" r="${r}" />\n`;
      } else if (obj.type === "path") {
        if (obj.path && Array.isArray(obj.path)) {
          let pathData = "";
          obj.path.forEach((cmd: any, idx: number) => {
            if (!Array.isArray(cmd) || cmd.length < 3) return;
            const type = cmd[0];
            const x = ((cmd[1] || 0) + (obj.left || 0)) / scaleFactor;
            const y = ((cmd[2] || 0) + (obj.top || 0)) / scaleFactor;
            
            if (idx === 0 || type === "M") {
              pathData += `M ${x} ${y} `;
            } else if (type === "L") {
              pathData += `L ${x} ${y} `;
            } else if (type === "Q" && cmd.length >= 5) {
              const x2 = ((cmd[3] || 0) + (obj.left || 0)) / scaleFactor;
              const y2 = ((cmd[4] || 0) + (obj.top || 0)) / scaleFactor;
              pathData += `Q ${x} ${y} ${x2} ${y2} `;
            }
          });
          if (pathData) {
            svgContent += `    <path class="drawing" d="${pathData}" />\n`;
          }
        }
      } else if (obj.type === "textbox" || obj.type === "text") {
        const x = (obj.left || 0) / scaleFactor;
        const y = (obj.top || 0) / scaleFactor;
        const fontSize = ((obj.fontSize || 12) * (obj.scaleY || 1)) / scaleFactor;
        const fill = obj.fill || "#f00";
        svgContent += `    <text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}">${obj.text || ""}</text>\n`;
      }
    });
  }
  
  svgContent += `  </g>
  
  <!-- Dimensions -->
  <text class="dimension" x="${width / 2}" y="${height + 5}" text-anchor="middle">${width.toFixed(1)} mm</text>
  <text class="dimension" x="-5" y="${height / 2}" text-anchor="end" transform="rotate(-90 -5 ${height / 2})">${height.toFixed(1)} mm</text>
</svg>`;

  return new Blob([svgContent], { type: "image/svg+xml" });
}

/**
 * Exporte le gabarit en PDF
 */
export async function exportToPDF(options: ExportOptions): Promise<Blob> {
  const { templateName, scaleFactor, imageUrl, drawingsData, realDimensions } = options;
  
  const img = await loadImage(imageUrl);
  const widthMm = realDimensions?.widthMm || img.width / scaleFactor;
  const heightMm = realDimensions?.heightMm || img.height / scaleFactor;
  
  // Créer un PDF au format correspondant
  const pdf = new jsPDF({
    orientation: widthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
  });
  
  // Ajouter le titre
  pdf.setFontSize(16);
  pdf.text(templateName, widthMm / 2, 10, { align: "center" });
  
  // Ajouter l'image calibrée
  pdf.addImage(imageUrl, "PNG", 0, 0, widthMm, heightMm);
  
  // Ajouter les dessins
  if (drawingsData && drawingsData.objects) {
    pdf.setDrawColor(255, 0, 0);
    pdf.setLineWidth(0.3);
    
    drawingsData.objects.forEach((obj: any) => {
      if (obj.type === "line") {
        const x1 = (obj.x1 || 0) / scaleFactor;
        const y1 = (obj.y1 || 0) / scaleFactor;
        const x2 = (obj.x2 || 0) / scaleFactor;
        const y2 = (obj.y2 || 0) / scaleFactor;
        pdf.line(x1, y1, x2, y2);
      } else if (obj.type === "rect") {
        const x = (obj.left || 0) / scaleFactor;
        const y = (obj.top || 0) / scaleFactor;
        const w = (obj.width || 0) * (obj.scaleX || 1) / scaleFactor;
        const h = (obj.height || 0) * (obj.scaleY || 1) / scaleFactor;
        pdf.rect(x, y, w, h);
      } else if (obj.type === "circle") {
        const x = ((obj.left || 0) + (obj.radius || 0)) / scaleFactor;
        const y = ((obj.top || 0) + (obj.radius || 0)) / scaleFactor;
        const r = (obj.radius || 0) / scaleFactor;
        pdf.circle(x, y, r);
      } else if (obj.type === "textbox" || obj.type === "text") {
        const x = (obj.left || 0) / scaleFactor;
        const y = (obj.top || 0) / scaleFactor;
        const fontSize = ((obj.fontSize || 12) * (obj.scaleY || 1)) / scaleFactor;
        pdf.setFontSize(fontSize);
        pdf.setTextColor(obj.fill || "#ff0000");
        pdf.text(obj.text || "", x, y);
      }
    });
  }
  
  // Ajouter les dimensions en pied de page
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Dimensions: ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`, widthMm / 2, heightMm - 5, {
    align: "center",
  });
  
  return pdf.output("blob");
}

/**
 * Utilitaire pour charger une image
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Télécharge un blob avec un nom de fichier
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
