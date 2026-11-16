import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // ── Public auth pages (guest only) ─────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then(
        (m) => m.SignupComponent,
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },

  // ── Public legal + guide pages (no auth, no guard) ─────────
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/privacy.component').then(
        (m) => m.PrivacyComponent,
      ),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./features/legal/terms.component').then(
        (m) => m.TermsComponent,
      ),
  },
  {
    path: 'guide',
    loadComponent: () =>
      import('./features/guide/guide.component').then(
        (m) => m.GuideComponent,
      ),
  },

  // ── Public utility pages (no guard) ────────────────────────
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'auth/oauth-callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback/oauth-callback.component').then(
        (m) => m.OAuthCallbackComponent,
      ),
  },

  // ── Protected routes (auth required) ───────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/shell/shell.component').then(
        (m) => m.ShellComponent,
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'workflows',
        loadComponent: () =>
          import('./features/workflows/workflows-list.component').then(
            (m) => m.WorkflowsListComponent,
          ),
      },
      {
        path: 'workflows/:id',
        loadComponent: () =>
          import('./features/workflows/workflow-detail.component').then(
            (m) => m.WorkflowDetailComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/events-list.component').then(
            (m) => m.EventsListComponent,
          ),
      },
      {
        path: 'dlq',
        loadComponent: () =>
          import('./features/dlq/dlq-list.component').then(
            (m) => m.DlqListComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },

      // ── ⚠️ v2.5 — Community marketplace ────────────────────
      {
        path: 'community',
        loadComponent: () =>
          import('./features/community/community-list.component').then(
            (m) => m.CommunityListComponent,
          ),
      },
      {
        path: 'community/new',
        loadComponent: () =>
          import('./features/community/create-post.component').then(
            (m) => m.CreatePostComponent,
          ),
      },
      {
        path: 'community/:slug',
        loadComponent: () =>
          import('./features/community/post-detail.component').then(
            (m) => m.PostDetailComponent,
          ),
      },

      // ── ⚠️ v3.0 Wave 4 — webhook playground ────────────────
      {
        path: 'playground',
        loadComponent: () =>
          import('./features/playground/playground.component').then(
            (m) => m.PlaygroundComponent,
          ),
      },
    ],
  },

  // ── Admin routes (⚠️ v2.4 — Phase A: platform admin panel) ─
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/admin-overview.component').then(
            (m) => m.AdminOverviewComponent,
          ),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/admin/admin-tenants.component').then(
            (m) => m.AdminTenantsComponent,
          ),
      },
      {
        path: 'health',
        loadComponent: () =>
          import('./features/admin/admin-health.component').then(
            (m) => m.AdminHealthComponent,
          ),
      },
      // ── ⚠️ v2.9 — tenant detail + users + audit ────────────
      {
        path: 'tenants/:id',
        loadComponent: () =>
          import('./features/admin/admin-tenant-detail.component').then(
            (m) => m.AdminTenantDetailComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/admin-users.component').then(
            (m) => m.AdminUsersComponent,
          ),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/admin/admin-audit.component').then(
            (m) => m.AdminAuditComponent,
          ),
      },
      // ── ⚠️ v2.8 — moderation + announcements ──────────────
      {
        path: 'moderation',
        loadComponent: () =>
          import('./features/admin/admin-moderation.component').then(
            (m) => m.AdminModerationComponent,
          ),
      },
      {
        path: 'announcements',
        loadComponent: () =>
          import('./features/admin/admin-announcements.component').then(
            (m) => m.AdminAnnouncementsComponent,
          ),
      },
      // ── ⚠️ v3.0 Wave 4 — feature flags admin ───────────────
      {
        path: 'feature-flags',
        loadComponent: () =>
          import('./features/admin/admin-feature-flags.component').then(
            (m) => m.AdminFeatureFlagsComponent,
          ),
      },
    ],
  },

  { path: '**', redirectTo: '/dashboard' },
];