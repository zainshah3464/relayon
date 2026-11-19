import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RagResult {
  title: string;
  content: string;
  sourceId: string;
  rank: number;
}

@Injectable()
export class RagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 4-tier Postgres full-text search (no embeddings).
   * Tier 1: websearch_to_tsquery (natural language)
   * Tier 2: plainto_tsquery (fallback for edge cases)
   * Tier 3: keyword OR-match (typo tolerance)
   * Tier 4: full-phrase ILIKE (last resort)
   *
   * ⚠️ tenant_id is TEXT — no ::uuid cast
   */
  async search(tenantId: string, query: string, topK = 5): Promise<RagResult[]> {
    const clean = query.trim().slice(0, 300);
    if (!clean) return [];

    // ═══ Tier 1: websearch_to_tsquery ═══
    const websearchResults = await this.prisma.$queryRaw<
      Array<{ title: string; content: string; source_id: string; rank: number }>
    >`
      SELECT
        title, content, source_id,
        ts_rank_cd(
          to_tsvector('english', title || ' ' || content),
          websearch_to_tsquery('english', ${clean})
        ) AS rank
      FROM knowledge_chunks
      WHERE to_tsvector('english', title || ' ' || content)
            @@ websearch_to_tsquery('english', ${clean})
        AND (tenant_id IS NULL OR tenant_id = ${tenantId})
      ORDER BY rank DESC
      LIMIT ${topK}
    `;

    if (websearchResults.length >= 2) {
      return websearchResults.map((r) => ({
        title: r.title,
        content: r.content,
        sourceId: r.source_id,
        rank: Number(r.rank),
      }));
    }

    // ═══ Tier 2: plainto_tsquery ═══
    try {
      const plainResults = await this.prisma.$queryRaw<
        Array<{ title: string; content: string; source_id: string; rank: number }>
      >`
        SELECT
          title, content, source_id,
          ts_rank_cd(
            to_tsvector('english', title || ' ' || content),
            plainto_tsquery('english', ${clean})
          ) AS rank
        FROM knowledge_chunks
        WHERE to_tsvector('english', title || ' ' || content)
              @@ plainto_tsquery('english', ${clean})
          AND (tenant_id IS NULL OR tenant_id = ${tenantId})
        ORDER BY rank DESC
        LIMIT ${topK}
      `;

      if (plainResults.length >= 2) {
        return plainResults.map((r) => ({
          title: r.title,
          content: r.content,
          sourceId: r.source_id,
          rank: Number(r.rank),
        }));
      }
    } catch {
      // continue to fallback
    }

    // ═══ Tier 3: keyword OR-match ═══
    const keywords = clean
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length > 0) {
      try {
        const conditions = keywords
          .map(
            (k) =>
              `(title ILIKE '%${k.replace(/'/g, "''")}%' OR content ILIKE '%${k.replace(/'/g, "''")}%')`,
          )
          .join(' OR ');

        const keywordResults = await this.prisma.$queryRawUnsafe<
          Array<{ title: string; content: string; source_id: string }>
        >(
          `SELECT title, content, source_id
           FROM knowledge_chunks
           WHERE (${conditions})
             AND (tenant_id IS NULL OR tenant_id = $1)
           LIMIT $2`,
          tenantId,
          topK,
        );

        if (keywordResults.length > 0) {
          return keywordResults.map((r) => ({
            title: r.title,
            content: r.content,
            sourceId: r.source_id,
            rank: 0,
          }));
        }
      } catch {
        // continue
      }
    }

    // ═══ Tier 4: full-phrase ILIKE ═══
    const likeResults = await this.prisma.$queryRaw<
      Array<{ title: string; content: string; source_id: string }>
    >`
      SELECT title, content, source_id
      FROM knowledge_chunks
      WHERE (title ILIKE ${'%' + clean + '%'} OR content ILIKE ${'%' + clean + '%'})
        AND (tenant_id IS NULL OR tenant_id = ${tenantId})
      LIMIT ${topK}
    `;

    return likeResults.map((r) => ({
      title: r.title,
      content: r.content,
      sourceId: r.source_id,
      rank: 0,
    }));
  }
}