import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ShareAnnouncementDto {
  @IsIn(['twitter', 'linkedin'])
  platform!: 'twitter' | 'linkedin';

  @IsOptional()
  @IsString()
  @MaxLength(280)
  customText?: string;
}