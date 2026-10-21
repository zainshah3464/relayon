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

  readonly isAuthenticated = computed(() => this._token() !== null && this._user() !== null);
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
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/refresh`, { refreshToken })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/api/auth/logout`, {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

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