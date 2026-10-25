import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { DESTINATION_TYPES, type DestinationTypeValue } from './destination.dto';

export class ValidateDestinationDto {
  @IsString()
  @IsIn(DESTINATION_TYPES)
  type!: DestinationTypeValue;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}