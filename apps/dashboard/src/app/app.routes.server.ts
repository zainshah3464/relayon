import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // ═══════════════════════════════════════════════════════
  // PRERENDER — static HTML at build time (public content)
  // ═══════════════════════════════════════════════════════
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'guide', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'signup', renderMode: RenderMode.Prerender },

  // ═══════════════════════════════════════════════════════
  // CLIENT — auth-protected + redirect routes (no SEO value)
  // ═══════════════════════════════════════════════════════
  { path: '', renderMode: RenderMode.Client }, // root redirects to /dashboard

  // Community is inside authGuard shell — prerender would redirect to /login
  { path: 'community', renderMode: RenderMode.Client },
  { path: 'community/new', renderMode: RenderMode.Client },
  { path: 'community/:slug', renderMode: RenderMode.Client },

  // All dashboard routes (behind authGuard)
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'workflows/**', renderMode: RenderMode.Client },
  { path: 'events/**', renderMode: RenderMode.Client },
  { path: 'dlq/**', renderMode: RenderMode.Client },
  { path: 'analytics/**', renderMode: RenderMode.Client },
  { path: 'settings/**', renderMode: RenderMode.Client },
  { path: 'playground/**', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },

  // Public utility (no auth, but no SEO value)
  { path: 'verify-email', renderMode: RenderMode.Client },
  { path: 'auth/oauth-callback', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },

  // Fallback
  { path: '**', renderMode: RenderMode.Client },
];