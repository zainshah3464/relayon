import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/strong-password.validator';
export class ResetPasswordDto {
  @IsString() @MinLength(64) token!: string;
  @IsString() @IsStrongPassword({ minScore: 3, minLength: 12 }) password!: string;
}