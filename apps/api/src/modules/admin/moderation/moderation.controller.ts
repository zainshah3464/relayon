import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../super-admin.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { ModeratePostDto, ResolveFlagDto } from './dto/moderate.dto';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('flags')
  listFlags(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.moderation.listFlags({
      status,
      limit: limit ? parseInt(limit, 10) : 25,
      cursor,
    });
  }

  @Post('flags/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolveFlag(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResolveFlagDto,
  ) {
    return this.moderation.resolveFlag(
      user.sub,
      id,
      dto.resolution,
      dto.reason,
    );
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  hidePost(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.moderation.hidePost(user.sub, id, dto.reason);
  }

  @Post('posts/:id/restore')
  @HttpCode(HttpStatus.OK)
  restorePost(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.moderation.restorePost(user.sub, id, dto.reason);
  }

  @Post('posts/:id/remove')
  @HttpCode(HttpStatus.OK)
  removePost(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.moderation.removePost(user.sub, id, dto.reason);
  }

  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.moderation.listAudit(Number(limit) || 100);
  }
}