import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommunityService } from './community.service';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreatePostDto,
  CreateReplyDto,
  FlagDto,
  ListPostsQuery,
  ToggleLikeDto,
} from './dto/community.dto';

/**
 * Optional auth helper — extracts user from request if JWT is provided.
 * Uses the token's payload without verifying (guard does that).
 * Actually, we decode via the guard-set req.user when JwtAuthGuard runs;
 * here we just check if req has been populated.
 */
@Controller('community')
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly templates: TemplatesService,
  ) {}

  // Public — no auth required
  @Get('posts')
  list(@Query() q: ListPostsQuery) {
    return this.community.listPosts(q);
  }

  @Get('posts/:idOrSlug')
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.community.getPost(idOrSlug, null);
  }

  @Get('announcements')
  announcements(@Query('limit') limit?: string) {
    return this.community.listAnnouncements(Number(limit) || 3);
  }

  // Auth required
  @Post('posts')
  @UseGuards(JwtAuthGuard)
  createPost(@CurrentUser() user: JwtUser, @Body() dto: CreatePostDto) {
    return this.community.createPost(user.sub, user.tenantId, dto);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deletePost(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.community.deletePost(user.sub, user.tenantId, id, false);
  }

  @Post('replies')
  @UseGuards(JwtAuthGuard)
  createReply(@CurrentUser() user: JwtUser, @Body() dto: CreateReplyDto) {
    return this.community.createReply(user.sub, dto);
  }

  @Post('replies/:id/solution')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  markSolution(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.community.markSolution(user.sub, id);
  }

  @Post('like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  toggleLike(@CurrentUser() user: JwtUser, @Body() dto: ToggleLikeDto) {
    return this.community.toggleLike(user.sub, dto);
  }

  @Post('flag')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  flag(@CurrentUser() user: JwtUser, @Body() dto: FlagDto) {
    return this.community.flag(user.sub, dto);
  }

  @Get('templates/:postId/preview')
  previewTemplate(@Param('postId') postId: string) {
    return this.templates.getTemplateYaml(postId);
  }

  @Post('templates/:postId/import')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  importTemplate(
    @CurrentUser() user: JwtUser,
    @Param('postId') postId: string,
    @Body() body: { yaml: string },
  ) {
    return this.templates.importTemplate(
      user.tenantId,
      user.sub,
      postId,
      body.yaml ?? '',
    );
  }
}