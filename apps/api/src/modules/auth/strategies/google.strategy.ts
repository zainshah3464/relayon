import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'disabled',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'disabled',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:3001/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile, done: VerifyCallback): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Google profile missing email'), undefined);

    done(null, {
      provider: 'google',
      providerId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || email.split('@')[0]!,
      emailVerified: profile.emails?.[0]?.verified !== false,
    } satisfies OAuthProfile);
  }
}