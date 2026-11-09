import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole = 'owner' | 'admin' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  // ⚠️ v2.1 — new fields
  emailVerified: boolean;
  hasPassword: boolean;
  provider: 'local' | 'google' | 'github';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  name: string;
  tenantName: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly ACCESS_KEY = 'relayon_access_token';
  private readonly REFRESH_KEY = 'relayon_refresh_token';
  private readonly USER_KEY = 'relayon_user';

  private _user = signal<User | null>(this.loadUser());
  private _token = signal<string | null>(localStorage.getItem(this.ACCESS_KEY));

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();

  readonly isAuthenticated = computed(
    () => this._token() !== null && this._user() !== null,
  );
  readonly isOwner = computed(() => this._user()?.role === 'owner');
  readonly isAdmin = computed(() => {
    const r = this._user()?.role;
    return r === 'owner' || r === 'admin';
  });
  readonly displayName = computed(() => {
    const u = this._user();
    if (!u) return '';
    return u.name || u.email.split('@')[0];
  });

  // ⚠️ v2.1 — new computed helpers
  readonly emailVerified = computed(() => this._user()?.emailVerified ?? true);
  readonly hasPassword = computed(() => this._user()?.hasPassword ?? true);
  readonly authProvider = computed(() => this._user()?.provider ?? 'local');

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, payload)
      .pipe(tap((res) => this.setSession(res)));
  }

  signup(payload: SignupPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/signup`, payload)
      .pipe(tap((res) => this.setSession(res)));
  }

  refresh(): Observable<AuthResponse> | null {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) return null;
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/refresh`, {
        refreshToken,
      })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    this.http
      .post(`${environment.apiUrl}/api/auth/logout`, { refreshToken })
      .subscribe({
        next: () => this.clearSession(),
        error: () => this.clearSession(),
      });
  }

  // ── OAuth ──────────────────────────────────────────────────────────

  startGoogleOAuth(returnTo = '/dashboard'): void {
    window.location.href = `${environment.apiUrl}/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  }

  startGitHubOAuth(returnTo = '/dashboard'): void {
    window.location.href = `${environment.apiUrl}/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
  }

  exchangeOAuthTicket(
    ticket: string,
  ): Observable<AuthResponse & { returnTo: string }> {
    return this.http
      .post<AuthResponse & { returnTo: string }>(
        `${environment.apiUrl}/api/auth/oauth-exchange`,
        { ticket },
      )
      .pipe(tap((res) => this.setSession(res)));
  }

  // ── Email verification ────────────────────────────────────────────

  verifyEmail(token: string): Observable<{ verified: boolean }> {
    return this.http.post<{ verified: boolean }>(
      `${environment.apiUrl}/api/auth/verify-email`,
      { token },
    );
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/auth/resend-verification`,
      { email },
    );
  }

  // ── Password reset ────────────────────────────────────────────────

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/auth/forgot-password`,
      { email },
    );
  }

  resetPassword(
    token: string,
    password: string,
  ): Observable<{ reset: boolean }> {
    return this.http.post<{ reset: boolean }>(
      `${environment.apiUrl}/api/auth/reset-password`,
      { token, password },
    );
  }

  // ── Internal ──────────────────────────────────────────────────────

  private setSession(res: AuthResponse): void {
    localStorage.setItem(this.ACCESS_KEY, res.accessToken);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  private clearSession(): void {
    localStorage.removeItem(this.ACCESS_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private loadUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}