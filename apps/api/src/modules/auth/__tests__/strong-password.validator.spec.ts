import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { IsStrongPassword } from '../validators/strong-password.validator';

class TestDto {
  @IsStrongPassword({ minScore: 3, minLength: 12 })
  password!: string;

  email = 'test@example.com';
  name = 'Test User';
}

describe('IsStrongPassword', () => {
  it('rejects Password123! (too common)', async () => {
    const dto = Object.assign(new TestDto(), { password: 'Password123!' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects short password', async () => {
    const dto = Object.assign(new TestDto(), { password: 'Xy9#aB2' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects password containing email', async () => {
    const dto = Object.assign(new TestDto(), { password: 'test@example.comX9' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('accepts strong random password', async () => {
    const dto = Object.assign(new TestDto(), {
      password: 'Thunder-Violet-Quartz-9-Maple',
    });
    const errs = await validate(dto);
    expect(errs).toEqual([]);
  });

  it('accepts long passphrase', async () => {
    const dto = Object.assign(new TestDto(), {
      password: 'correct-horse-battery-staple-zebra',
    });
    const errs = await validate(dto);
    expect(errs).toEqual([]);
  });
});