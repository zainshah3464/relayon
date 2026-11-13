import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

interface QueuedEvent {
  path: string;
  referrer?: string;
  sessionId: string;
  eventType: 'pageview' | 'click' | 'custom';
  eventName?: string;
  properties?: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;

@Injectable({ providedIn: 'root' })
export class TrackerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly SESSION_KEY = 'relayon_track_sid';
  private readonly sessionId: string;
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialReferrer = typeof document !== 'undefined' ? document.referrer : '';
  private initialized = false;

  readonly lastSentAt = signal<number | null>(null);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.sessionId = '';
      return;
    }

    let sid = sessionStorage.getItem(this.SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(this.SESSION_KEY, sid);
    }
    this.sessionId = sid;
  }

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.initialized) return;
    this.initialized = true;

    this.trackPageView(window.location.pathname);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.trackPageView(e.urlAfterRedirects));

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
  }

  trackPageView(path: string): void {
    if (!this.initialized) return;
    this.enqueue({
      path,
      referrer: this.initialReferrer || undefined,
      sessionId: this.sessionId,
      eventType: 'pageview',
    });
    this.initialReferrer = '';
  }

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return;
    this.enqueue({
      path: window.location.pathname,
      sessionId: this.sessionId,
      eventType: 'custom',
      eventName: name,
      properties,
    });
  }

  private enqueue(evt: QueuedEvent): void {
    this.queue.push(evt);
    if (this.queue.length >= MAX_BATCH) this.flush();
  }

  private flush(useBeacon = false): void {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, MAX_BATCH);
    const payload = JSON.stringify({ events: batch });
    const endpoint = `${environment.apiUrl}/api/track`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.auth.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = this.auth.user()?.tenantId;
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    if (useBeacon && !token && 'sendBeacon' in navigator) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }

    this.lastSentAt.set(Date.now());
  }
}