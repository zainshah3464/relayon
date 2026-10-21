import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DESTINATION_TYPES = [
  'http',
  'slack',
  'email',
  'sheets',
  'postgres',
  'mongodb',
] as const;

export type DestinationTypeValue = (typeof DESTINATION_TYPES)[number];

export class CreateDestinationDto {
  @IsString()
  @IsIn(DESTINATION_TYPES)
  type!: DestinationTypeValue;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateDestinationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}