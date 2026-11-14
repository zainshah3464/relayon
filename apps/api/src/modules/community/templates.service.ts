import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowsService,
  ) {}

  async getTemplateYaml(postId: string): Promise<{
    yaml: string;
    placeholders: string[];
  }> {
    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findUnique({ where: { id: postId } }),
    );
    if (!post || post.type !== 'template' || post.status !== 'published') {
      throw new NotFoundException('Template not found');
    }

    const meta = (post.metadata ?? {}) as Record<string, unknown>;
    const yaml = meta['workflowYaml'];
    if (typeof yaml !== 'string') {
      throw new BadRequestException('Template has no YAML');
    }

    const placeholders = Array.from(
      new Set(
        Array.from(yaml.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g)).map((m) => m[1]!),
      ),
    );

    return { yaml, placeholders };
  }

  async importTemplate(
    tenantId: string,
    actorId: string,
    postId: string,
    filledYaml: string,
  ): Promise<{ workflowId: string; name: string }> {
    await this.getTemplateYaml(postId);

    const result = await this.workflows.importYaml(
      tenantId,
      filledYaml,
      actorId,
      'create',
    );

    return { workflowId: result.id, name: result.name };
  }
}