import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateQuotaDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  eventsPerMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  aiTokensPerMonth?: number;

  @IsOptional()
  @IsIn(['hard', 'soft'])
  quotaMode?: 'hard' | 'soft';
}