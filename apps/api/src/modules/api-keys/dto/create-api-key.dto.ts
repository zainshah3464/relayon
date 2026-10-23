import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const API_KEY_SCOPES = [
  'events:read',
  'workflows:read',
  'workflows:write',
  'destinations:read',
  'destinations:write',
  'dlq:read',
  'dlq:write',
  'analytics:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: ApiKeyScope[];

  @IsOptional()
  @IsIn(['live', 'test'])
  environment?: 'live' | 'test';

  @IsOptional()
  @IsBoolean()
  neverExpires?: boolean;
}