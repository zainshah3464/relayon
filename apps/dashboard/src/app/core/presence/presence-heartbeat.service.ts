import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

const HEARTBEAT_INTERVAL_MS = 15_000;
const SESSION_KEY = 'relayon_presence_sid';

@Injectable({ providedIn: 'root' })
export class PresenceHeartbeatService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private sessionId = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentPath = '/';
  private started = false;

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.started) return;
    if (!this.auth.isAuthenticated()) return;
    this.started = true;

    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    this.sessionId = sid;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => (this.currentPath = e.urlAfterRedirects));

    this.startTimer();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.beat();
        this.startTimer();
      } else {
        this.stopTimer();
      }
    });
  }

  private startTimer(): void {
    if (this.timer) return;
    this.beat();
    this.timer = setInterval(() => this.beat(), HEARTBEAT_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private beat(): void {
    if (!this.auth.isAuthenticated()) {
      this.stopTimer();
      return;
    }
    this.http
      .post(`${environment.apiUrl}/api/presence/heartbeat`, {
        sessionId: this.sessionId,
        path: this.currentPath,
      })
      .subscribe({ error: () => undefined });
  }

  stop(): void {
    this.stopTimer();
    this.started = false;
  }
}