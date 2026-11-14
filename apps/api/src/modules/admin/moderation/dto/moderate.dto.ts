import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveFlagDto {
  @IsIn(['dismiss', 'action'])
  resolution!: 'dismiss' | 'action';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ModeratePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}