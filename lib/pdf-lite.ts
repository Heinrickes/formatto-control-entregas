const pageWidth = 612;
const pageHeight = 842;

export function cleanPdfText(value: string | number | null | undefined) {
  return String(value ?? "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

function escapePdf(value: string | number | null | undefined) {
  return cleanPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function wrapPdfText(value: string | number | null | undefined, maxChars: number) {
  const words = cleanPdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars) {
      if (current) lines.push(current);
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}.` : word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

export class PdfLite {
  private pages: string[][] = [];
  private current: string[] = [];
  y = 0;

  constructor(private title: string, private subtitle: string) {
    this.newPage();
  }

  newPage() {
    this.current = [];
    this.pages.push(this.current);
    this.y = 782;
    this.fill(0, 0, pageWidth, pageHeight, "0.985 0.982 0.972 rg");
    this.fill(36, 34, 540, 774, "1 1 1 rg");
    this.stroke(36, 34, 540, 774, "0.88 0.86 0.82 RG");
    this.fill(36, 791, 540, 2, "0.81 0.27 0.13 rg");
    this.fill(540, 760, 22, 22, "0.81 0.27 0.13 rg");
    this.text("FORMATTO", 50, 770, 16, "0.07 0.07 0.07 rg");
    this.text(this.title.toUpperCase(), 50, 750, 12, "0.07 0.07 0.07 rg");
    this.text(this.subtitle, 50, 734, 8, "0.38 0.38 0.38 rg");
    this.line(50, 720, 562, 720, "0.88 0.86 0.82 RG");
    this.y = 698;
  }

  ensure(height: number) {
    if (this.y - height < 58) this.newPage();
  }

  fill(x: number, y: number, width: number, height: number, color: string) {
    this.current.push(color, `${x} ${y} ${width} ${height} re f`);
  }

  stroke(x: number, y: number, width: number, height: number, color = "0.88 0.86 0.82 RG") {
    this.current.push(color, `${x} ${y} ${width} ${height} re S`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "0.88 0.86 0.82 RG") {
    this.current.push(color, `${x1} ${y1} m ${x2} ${y2} l S`);
  }

  text(value: string | number | null | undefined, x: number, y: number, size = 8, color = "0.07 0.07 0.07 rg") {
    this.current.push("BT", color, `/F1 ${size} Tf`, `${x} ${y} Td`, `(${escapePdf(value)}) Tj`, "ET");
  }

  wrappedText(value: string | number | null | undefined, x: number, y: number, maxChars: number, maxLines = 2, size = 7, color = "0.07 0.07 0.07 rg", lineHeight = 9) {
    const lines = wrapPdfText(value, maxChars).slice(0, maxLines);
    lines.forEach((line, index) => this.text(index === maxLines - 1 && wrapPdfText(value, maxChars).length > maxLines ? `${line.slice(0, Math.max(0, line.length - 3))}...` : line, x, y - index * lineHeight, size, color));
  }

  section(title: string) {
    this.ensure(28);
    this.text(title.toUpperCase(), 50, this.y, 10, "0.07 0.07 0.07 rg");
    this.line(50, this.y - 7, 562, this.y - 7, "0.81 0.27 0.13 RG");
    this.y -= 26;
  }

  card(label: string, value: string | number, x: number, y: number, width: number, height = 42) {
    this.fill(x, y - height, width, height, "0.995 0.995 0.99 rg");
    this.stroke(x, y - height, width, height, "0.90 0.89 0.86 RG");
    this.fill(x, y - 3, width, 1, "0.81 0.27 0.13 rg");
    const compact = height <= 34;
    this.text(label.toUpperCase(), x + 6, y - (compact ? 12 : 16), 5.5, "0.45 0.45 0.45 rg");
    this.text(value, x + 6, y - (compact ? 25 : 34), compact ? 10 : 14, "0.07 0.07 0.07 rg");
  }

  tableHeader(x: number, y: number, widths: number[], labels: string[]) {
    this.fill(x, y - 15, widths.reduce((sum, width) => sum + width, 0), 15, "0.955 0.952 0.94 rg");
    this.stroke(x, y - 15, widths.reduce((sum, width) => sum + width, 0), 15, "0.88 0.86 0.82 RG");
    let cursor = x;
    labels.forEach((label, index) => {
      this.text(label.toUpperCase(), cursor + 4, y - 10, 6, "0.25 0.25 0.25 rg");
      cursor += widths[index];
    });
  }

  tableRow(x: number, y: number, widths: number[], values: Array<string | number | null | undefined>, options: { height?: number; color?: string; maxLines?: number } = {}) {
    const height = options.height ?? 22;
    this.fill(x, y - height, widths.reduce((sum, width) => sum + width, 0), height, options.color ?? "1 1 1 rg");
    this.stroke(x, y - height, widths.reduce((sum, width) => sum + width, 0), height, "0.91 0.90 0.87 RG");
    let cursor = x;
    values.forEach((value, index) => {
      this.wrappedText(value, cursor + 4, y - 9, Math.max(5, Math.floor(widths[index] / 4.2)), options.maxLines ?? 2, 6.5, "0.10 0.10 0.10 rg", 8);
      cursor += widths[index];
    });
  }

  output() {
    const objects: string[] = [];
    const pageIds: number[] = [];
    const fontId = 3;
    const pagesId = 2;
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

    this.pages.forEach((pageCommands) => {
      const body = pageCommands.join("\n");
      const contentId = objects.length + 1;
      objects.push(`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
      const pageId = objects.length + 1;
      objects.push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });
    objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets[index + 1] = Buffer.byteLength(pdf, "latin1");
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "latin1");
  }
}
