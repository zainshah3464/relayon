import { IsObject, IsOptional } from 'class-validator';

export class TestRunDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}