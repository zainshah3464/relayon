import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ImportWorkflowDto {
  @IsString()
  @MinLength(20)
  yaml!: string;

  @IsOptional()
  @IsIn(['create', 'upsert'])
  mode?: 'create' | 'upsert';
}