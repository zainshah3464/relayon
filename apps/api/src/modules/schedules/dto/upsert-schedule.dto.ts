import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertScheduleDto {
  /** Standard 5-field cron: minute hour day-of-month month day-of-week */
  @IsString()
  @MinLength(9)
  @MaxLength(120)
  @Matches(/^[\d*,\-/ ]+$/, {
    message: 'cronExpression may only contain digits, *, ,, -, / and spaces',
  })
  cronExpression!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsObject()
  payloadTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}