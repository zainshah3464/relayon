import {
  IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';

export const PROVIDERS = ['groq', 'openai', 'anthropic', 'resend'] as const;
export type ProviderDto = (typeof PROVIDERS)[number];

export class UpsertIntegrationDto {
  @IsString()
  @IsIn(PROVIDERS as unknown as string[])
  provider!: ProviderDto;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestIntegrationDto {
  @IsString()
  @IsIn(PROVIDERS as unknown as string[])
  provider!: ProviderDto;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  apiKey!: string;
}