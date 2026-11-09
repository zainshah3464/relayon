import type { ConfigService } from '@nestjs/config';

export function buildGoogleAuthUrl(state: string, config: ConfigService): string {
  const clientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  const callbackUrl = config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:3001/api/auth/google/callback';
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: callbackUrl, response_type: 'code',
    scope: 'email profile', state, access_type: 'online', prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function buildGitHubAuthUrl(state: string, config: ConfigService): string {
  const clientId = config.getOrThrow<string>('GITHUB_CLIENT_ID');
  const callbackUrl = config.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:3001/api/auth/github/callback';
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: callbackUrl, scope: 'user:email', state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}