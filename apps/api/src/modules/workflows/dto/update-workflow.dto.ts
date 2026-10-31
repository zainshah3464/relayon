import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SOURCE_TYPES, type SourceTypeValue } from './create-workflow.dto';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(SOURCE_TYPES)
  sourceType?: SourceTypeValue;

  @IsOptional()
  @IsObject()
  sourceConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enrichmentEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  enrichmentPrompt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transformExpression?: string | null;

  @IsOptional()
  @IsArray()
  routingRules?: Array<{ when: string; destinationIds: string[] }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}