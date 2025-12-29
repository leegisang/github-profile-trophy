function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderErrorSvg(title: string, lines: string[]): string {
  const safeTitle = escapeXml(title);
  const safeLines = lines.map((l) => escapeXml(l));

  const width = 900;
  const lineHeight = 22;
  const paddingTop = 44;
  const height = Math.max(120, paddingTop + safeLines.length * lineHeight + 24);

  const text = safeLines.map((line, i) =>
    `<text x="32" y="${paddingTop + i * lineHeight}" class="body">${line}</text>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .bg { fill: #0d1117; }
    .border { fill: none; stroke: #30363d; stroke-width: 1; }
    .title { fill: #f85149; font: 700 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
    .body { fill: #c9d1d9; font: 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  </style>
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" class="bg"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" class="border"/>
  <text x="32" y="28" class="title">${safeTitle}</text>
  ${text}
</svg>`;
}


