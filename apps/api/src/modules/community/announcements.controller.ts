import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../admin/super-admin.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

class CreateAnnouncementDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  content!: string;
}

@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AnnouncementsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const slug = `announcement-${Date.now().toString(36)}`;
    return this.prisma.withoutTenant((c) =>
      c.communityPost.create({
        data: {
          tenantId: null,
          authorId: user.sub,
          type: 'announcement',
          title: dto.title,
          slug,
          content: dto.content,
        },
      }),
    );
  }
}