import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssertionStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  assert!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class RunWorkflowTestDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssertionStepDto)
  steps!: AssertionStepDto[];
}