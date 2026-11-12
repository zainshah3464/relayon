import {
  Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('ai/admin')
@UseGuards(JwtAuthGuard)
export class AiAdminController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(@CurrentUser() user: JwtUser) {
    if (user.role !== 'owner') throw new ForbiddenException('Owner only');
    return this.knowledge.ingestDocs();
  }
}