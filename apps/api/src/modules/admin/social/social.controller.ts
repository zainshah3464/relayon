import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../super-admin.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { ShareAnnouncementDto } from './dto/share.dto';

@Controller('admin/social')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('announcements/:id/intents')
  getIntents(@Param('id') id: string) {
    return this.social.getShareIntents(id);
  }

  @Post('announcements/:id/share')
  @HttpCode(HttpStatus.OK)
  share(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ShareAnnouncementDto,
  ) {
    if (dto.platform === 'twitter') {
      return this.social.postToTwitter(user.sub, id, dto.customText);
    }
    return this.social.getShareIntents(id, dto.customText).then((r) => ({
      posted: false,
      intentUrl: r.linkedin.intentUrl,
      mode: 'intent' as const,
    }));
  }

  @Get('announcements/:id/shares')
  history(@Param('id') id: string) {
    return this.social.getShareHistory(id);
  }
}