import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { chunkText } from './chunking';

const DOCS_DIR = join(process.cwd(), 'docs');

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestDocs(): Promise<{ files: number; chunks: number }> {
    let files = 0;
    let totalChunks = 0;

    let entries: string[];
    try {
      entries = await readdir(DOCS_DIR);
    } catch {
      this.logger.warn(`docs/ directory not found at ${DOCS_DIR}`);
      return { files: 0, chunks: 0 };
    }

    for (const file of entries.filter((f) => f.endsWith('.md'))) {
      const sourceId = file.replace(/\.md$/, '');
      const path = join(DOCS_DIR, file);
      const raw = await readFile(path, 'utf8');

      await this.prisma.withoutTenant((c) =>
        c.knowledgeChunk.deleteMany({ where: { sourceType: 'doc', sourceId } }),
      );

      const chunks = chunkText(raw);
      if (chunks.length === 0) continue;

      const titleMatch = raw.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1]?.trim() ?? file;

      for (const chunk of chunks) {
        await this.prisma.withoutTenant((c) =>
          c.knowledgeChunk.create({
            data: {
              sourceType: 'doc',
              sourceId,
              title,
              content: chunk.content,
              metadata: { chunkIndex: chunk.index },
            },
          }),
        );
      }

      files++;
      totalChunks += chunks.length;
      this.logger.log(`Ingested ${file}: ${chunks.length} chunks`);
    }

    return { files, chunks: totalChunks };
  }
}