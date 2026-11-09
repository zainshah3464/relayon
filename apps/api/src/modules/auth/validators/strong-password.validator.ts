import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import zxcvbn from 'zxcvbn';

export interface StrongPasswordOptions { minScore?: 2 | 3 | 4; minLength?: number; }

export function IsStrongPassword(opts: StrongPasswordOptions = {}, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [opts],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const minScore = opts.minScore ?? 3;
          const minLength = opts.minLength ?? 12;
          if (value.length < minLength) return false;

          const obj = args.object as Record<string, unknown>;
          const userInputs = [obj['email'], obj['name']].filter(
            (x): x is string => typeof x === 'string' && x.length > 0,
          );

          const result = zxcvbn(value, userInputs);
          return result.score >= minScore;
        },
        defaultMessage(args: ValidationArguments): string {
          const minScore = opts.minScore ?? 3;
          const minLength = opts.minLength ?? 12;
          return `Password must be at least ${minLength} characters with strength score >= ${minScore}`;
        },
      },
    });
  };
}