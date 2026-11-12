const TARGET_CHARS = 2000;
const OVERLAP_CHARS = 200;

export interface Chunk {
  content: string;
  index: number;
}

export function chunkText(
  text: string,
  opts?: { targetChars?: number; overlapChars?: number },
): Chunk[] {
  const target = opts?.targetChars ?? TARGET_CHARS;
  const overlap = opts?.overlapChars ?? OVERLAP_CHARS;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= target) {
    return [{ content: normalized, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + target, normalized.length);

    if (end < normalized.length) {
      const paraBreak = normalized.lastIndexOf('\n\n', end);
      if (paraBreak > start + target / 2) end = paraBreak;
      else {
        const sentBreak = Math.max(
          normalized.lastIndexOf('. ', end),
          normalized.lastIndexOf('! ', end),
          normalized.lastIndexOf('? ', end),
        );
        if (sentBreak > start + target / 2) end = sentBreak + 1;
      }
    }

    chunks.push({ content: normalized.slice(start, end).trim(), index: index++ });
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}