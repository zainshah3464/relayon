import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PageViewEventDto {
  @IsString()
  @MaxLength(500)
  path!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @IsIn(['pageview', 'click', 'custom'])
  eventType!: 'pageview' | 'click' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventName?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class TrackBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PageViewEventDto)
  events!: PageViewEventDto[];
}