import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-github2';
import type { VerifyCallback } from 'passport-oauth2';
import type { OAuthProfile } from './google.strategy';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? 'disabled',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? 'disabled',
      callbackURL: config.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:3001/api/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile, done: VerifyCallback): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('GitHub profile missing email. Grant user:email scope.'), undefined);
    done(null, {
      provider: 'github',
      providerId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || profile.username || email.split('@')[0]!,
      emailVerified: true,
    } satisfies OAuthProfile);
  }
}