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
   * Postgres full-text search — no external embeddings needed.
   * Uses websearch_to_tsquery for natural language queries.
   *
   * ⚠️ CRITICAL: tenant_id is TEXT (not UUID). No ::uuid cast!
   * Schema: `tenantId String? @map("tenant_id")` → TEXT column.
   */
  async search(tenantId: string, query: string, topK = 5): Promise<RagResult[]> {
    const clean = query.trim().slice(0, 200);
    if (!clean) return [];

    const rows = await this.prisma.$queryRaw<
      Array<{ title: string; content: string; source_id: string; rank: number }>
    >`
      SELECT
        title,
        content,
        source_id,
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

    // Fallback to ILIKE if FTS returns nothing (typos, short words)
    if (rows.length === 0) {
      const fallback = await this.prisma.$queryRaw<
        Array<{ title: string; content: string; source_id: string }>
      >`
        SELECT title, content, source_id
        FROM knowledge_chunks
        WHERE (title ILIKE ${'%' + clean + '%'} OR content ILIKE ${'%' + clean + '%'})
          AND (tenant_id IS NULL OR tenant_id = ${tenantId})
        LIMIT ${topK}
      `;
      // ⚠️ FIX — explicit snake_case → camelCase mapping (spread `...r` doesn't rename)
      return fallback.map((r) => ({
        title: r.title,
        content: r.content,
        sourceId: r.source_id,
        rank: 0,
      }));
    }

    return rows.map((r) => ({
      title: r.title,
      content: r.content,
      sourceId: r.source_id,
      rank: Number(r.rank),
    }));
  }
}