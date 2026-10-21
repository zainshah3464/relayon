import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/shell/shell.component').then((m) => m.ShellComponent),
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
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];