import { IsString, MinLength } from 'class-validator';
export class VerifyEmailDto {
  @IsString() @MinLength(64) token!: string;
}