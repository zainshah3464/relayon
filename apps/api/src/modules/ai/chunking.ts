const TARGET_CHARS = 1800;
const OVERLAP_CHARS = 150;
const MIN_CHUNK_CHARS = 100;

export interface Chunk {
  content: string;
  index: number;
  section: string | null;
}

/**
 * Semantic chunker — preserves markdown section hierarchy.
 * Each chunk remembers which section it came from (e.g. "Common Tasks").
 */
export function chunkText(
  text: string,
  opts?: { targetChars?: number; overlapChars?: number },
): Chunk[] {
  const target = opts?.targetChars ?? TARGET_CHARS;
  const overlap = opts?.overlapChars ?? OVERLAP_CHARS;

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length === 0) return [];

  const sections = splitByHeadings(normalized);

  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    const sectionText = section.content.trim();
    if (sectionText.length < MIN_CHUNK_CHARS) continue;

    if (sectionText.length <= target) {
      chunks.push({
        content: sectionText,
        index: index++,
        section: section.heading,
      });
      continue;
    }

    const subChunks = splitLargeSection(sectionText, target, overlap);
    for (const sub of subChunks) {
      if (sub.length < MIN_CHUNK_CHARS) continue;
      chunks.push({
        content: sub,
        index: index++,
        section: section.heading,
      });
    }
  }

  return chunks;
}

interface Section {
  heading: string | null;
  content: string;
}

function splitByHeadings(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let current: Section = { heading: null, content: '' };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      if (current.content.trim().length > 0) {
        sections.push(current);
      }
      current = { heading: headingMatch[1]!.trim(), content: '' };
    } else {
      current.content += line + '\n';
    }
  }
  if (current.content.trim().length > 0) sections.push(current);

  return sections;
}

function splitLargeSection(
  text: string,
  target: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + target, text.length);

    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      if (paraBreak > start + target / 2) {
        end = paraBreak;
      } else {
        const sentBreak = Math.max(
          text.lastIndexOf('. ', end),
          text.lastIndexOf('! ', end),
          text.lastIndexOf('? ', end),
        );
        if (sentBreak > start + target / 2) end = sentBreak + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}