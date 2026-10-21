import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const SOURCE_TYPES = [
  'stripe',
  'github',
  'shopify',
  'slack',
  'generic',
] as const;

export type SourceTypeValue = (typeof SOURCE_TYPES)[number];

export class CreateWorkflowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsIn(SOURCE_TYPES)
  sourceType!: SourceTypeValue;

  @IsOptional()
  @IsObject()
  sourceConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enrichmentEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  enrichmentPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transformExpression?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}