import { IsIn } from 'class-validator';

export const SUPPORTED_LOCALES = ['en', 'ur', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export class UpdateLocaleDto {
  @IsIn(SUPPORTED_LOCALES as unknown as string[])
  locale!: SupportedLocale;
}