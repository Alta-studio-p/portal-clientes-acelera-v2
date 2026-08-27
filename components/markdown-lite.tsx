import type { ReactNode } from "react";

// Fathom summaries always use a small, predictable subset of markdown
// (## headings, **bold**, [text](url) links, "- " bullets). A full markdown
// dependency is overkill for that fixed shape, so this renders it directly.
//
// Fathom wraps almost every bullet in a [text](url) link to a timestamped
// moment in the recording — one per line. Turning every line into a link
// makes the summary unreadable, and the call already has a single "Ver
// grabación" link, so link syntax here is stripped down to plain text.

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] && match[2]) {
      // Fathom wraps whole bullets in a link, e.g. "[**Bold:** rest](url)" —
      // the link text itself can contain bold markup, so parse it too.
      nodes.push(...parseInline(match[1], `${keyPrefix}-${i++}`));
    } else if (match[3]) {
      nodes.push(
        <strong key={`${keyPrefix}-${i++}`} className="font-semibold text-foreground">
          {match[3]}
        </strong>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blockKey++}`} className="list-disc space-y-1.5 pl-5 marker:text-muted-2">
        {listBuffer.map((item, idx) => (
          <li key={idx} className="text-sm leading-relaxed text-foreground">
            {parseInline(item, `li-${blockKey}-${idx}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;

      if (level <= 2) {
        // Section-level heading (Meeting Purpose, Puntos clave, Temas…)
        blocks.push(
          <h3
            key={`h-${blockKey++}`}
            className="mt-5 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted-2 first:mt-0 first:border-t-0 first:pt-0"
          >
            {parseInline(heading[2], `h-${blockKey}`)}
          </h3>
        );
      } else {
        // Topic subheading within a section
        blocks.push(
          <h4 key={`h-${blockKey++}`} className="mt-3 text-sm font-semibold text-foreground">
            {parseInline(heading[2], `h-${blockKey}`)}
          </h4>
        );
      }
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      listBuffer.push(bullet[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blockKey++}`} className="text-sm leading-relaxed text-foreground">
        {parseInline(line, `p-${blockKey}`)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-2.5">{blocks}</div>;
}
