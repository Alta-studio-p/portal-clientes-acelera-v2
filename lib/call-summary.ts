// Los resúmenes de Fathom (calls.summary y clients.context_summary, este
// último generado a partir de la primera llamada) siguen siempre la misma
// forma: secciones "## Encabezado" con viñetas "- " a veces envueltas en un
// link [texto](url) a un momento del video, y subtemas "### Encabezado"
// anidados dentro de la sección de temas. Este módulo parsea esa forma fija
// para poder mostrar partes específicas (una frase, puntos clave, temas,
// próximos pasos) sin re-implementar un parser de markdown genérico.
//
// Nunca inventa contenido: si una sección no existe en el texto real, los
// extractores devuelven null/[] y el llamador simplemente no la muestra.

export interface MarkdownSection {
  heading: string;
  body: string;
}

const PURPOSE_RE = /^(meeting purpose|session purpose|call purpose|purpose|prop[oó]sito)/i;
const HIGHLIGHTS_RE = /^(key takeaways|important points|main points|principales conclusiones|puntos (clave|importantes))/i;
const TOPICS_RE = /^(topics discussed|discussion topics|temas)/i;
const NEXTSTEPS_RE = /^(action items|next steps|pr[oó]ximos pasos)/i;

function matchH2(line: string): string | null {
  const m = line.match(/^##(?!#)\s+(.+)$/);
  return m ? m[1].trim() : null;
}

export function splitIntoSections(markdown: string): MarkdownSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (heading !== null) {
      sections.push({ heading, body: bodyLines.join("\n").trim() });
    }
    bodyLines = [];
  };

  for (const line of lines) {
    const h2 = matchH2(line);
    if (h2 !== null) {
      flush();
      heading = h2;
    } else if (heading !== null) {
      bodyLines.push(line);
    }
  }
  flush();

  return sections;
}

function findSection(sections: MarkdownSection[], pattern: RegExp): MarkdownSection | undefined {
  return sections.find((s) => pattern.test(s.heading.trim()));
}

function stripLinkWrapper(text: string): string {
  const m = text.trim().match(/^\[(.+)\]\([^)]+\)$/);
  return (m ? m[1] : text).trim();
}

interface RawBullet {
  indent: number;
  text: string;
}

function extractBullets(body: string): RawBullet[] {
  const bullets: RawBullet[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^(\s*)(?:[-*]|\d+[.)])\s+(.*)$/);
    if (m) bullets.push({ indent: m[1].length, text: m[2].trim() });
  }
  return bullets;
}

// Aplana viñetas: si una viñeta de primer nivel es solo una etiqueta con
// nombre ("**Diana:**"), sus hijas anidadas se toman como los items reales
// (ej. "Próximos pasos" agrupados por persona). El resto de viñetas de
// primer nivel se toman tal cual.
function extractFlatItems(body: string): string[] {
  const bullets = extractBullets(body);
  if (bullets.length === 0) return [];
  const minIndent = Math.min(...bullets.map((b) => b.indent));

  const items: string[] = [];
  let insideLabelGroup = false;

  for (const b of bullets) {
    const isTop = b.indent <= minIndent;
    if (isTop) {
      const stripped = stripLinkWrapper(b.text);
      const isBareLabel = /^\*\*[^*]+:\*\*\s*$/.test(stripped);
      if (isBareLabel) {
        insideLabelGroup = true;
      } else {
        items.push(b.text);
        insideLabelGroup = false;
      }
    } else if (insideLabelGroup) {
      items.push(b.text);
    }
  }

  return items;
}

function extractSubheadings(body: string): string[] {
  const titles: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^###(?!#)\s+(.+)$/);
    if (m) titles.push(m[1].trim());
  }
  return titles;
}

function extractOneLiner(body: string): string | null {
  const firstLine = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ?? null;
}

export interface ParsedSummary {
  sections: MarkdownSection[];
  oneLiner: string | null;
  highlights: string[];
  topics: string[];
  actionItems: string[];
  purposeHeading: string | null;
  highlightsHeading: string | null;
}

export function parseSummaryMarkdown(markdown: string | null | undefined): ParsedSummary | null {
  if (!markdown || !markdown.trim()) return null;
  const sections = splitIntoSections(markdown);
  if (sections.length === 0) return null;

  const purposeSection = findSection(sections, PURPOSE_RE);
  const highlightsSection = findSection(sections, HIGHLIGHTS_RE);
  const topicsSection = findSection(sections, TOPICS_RE);
  const nextStepsSection = findSection(sections, NEXTSTEPS_RE);

  return {
    sections,
    oneLiner: purposeSection ? extractOneLiner(purposeSection.body) : null,
    highlights: highlightsSection ? extractFlatItems(highlightsSection.body) : [],
    topics: topicsSection ? extractSubheadings(topicsSection.body) : [],
    actionItems: nextStepsSection ? extractFlatItems(nextStepsSection.body) : [],
    purposeHeading: purposeSection?.heading ?? null,
    highlightsHeading: highlightsSection?.heading ?? null,
  };
}

// Markdown de las secciones restantes (todas menos las ya mostradas aparte
// como "en una frase" / "lo más importante"), para renderizar con
// MarkdownLite sin duplicar contenido.
export function buildRemainingMarkdown(parsed: ParsedSummary): string {
  const exclude = new Set([parsed.purposeHeading, parsed.highlightsHeading].filter(Boolean));
  return parsed.sections
    .filter((s) => !exclude.has(s.heading))
    .map((s) => `## ${s.heading}\n\n${s.body}`)
    .join("\n\n")
    .trim();
}

// Extracto en texto plano (sin sintaxis de markdown) para vistas compactas
// cuando no hay una sección de "propósito" de la que tomar una frase corta.
export function plainTextPreview(markdown: string, maxChars = 220): string {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars).trim()}…`;
}
