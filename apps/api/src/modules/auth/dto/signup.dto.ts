import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/strong-password.validator';

export class SignupDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) tenantName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @IsStrongPassword({ minScore: 3, minLength: 12 }) password!: string;
}