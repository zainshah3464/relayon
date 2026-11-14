import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-midnight">
      <header class="border-b border-hairline bg-surface">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-signal-rose to-signal-amber text-sm font-bold text-white">A</div>
            <span class="text-white font-semibold">Relayon Admin</span>
            <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose font-mono">SUPER</span>
          </div>
          <a routerLink="/dashboard" class="text-xs text-muted hover:text-white">← Back to app</a>
        </div>
      </header>

      <div class="mx-auto max-w-7xl px-6 py-6 flex gap-6">
        <nav class="w-56 shrink-0 space-y-1">
          <a routerLink="/admin" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">📊 Overview</a>
          <a routerLink="/admin/tenants" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">🏢 Tenants</a>
          <!-- ⚠️ v2.9 -->
          <a routerLink="/admin/users" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">👥 Users</a>
          <a routerLink="/admin/health" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">💚 System health</a>
          <!-- ⚠️ v2.8 -->
          <a routerLink="/admin/moderation" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">🛡️ Moderation</a>
          <a routerLink="/admin/announcements" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">📢 Announcements</a>
          <!-- ⚠️ v2.9 -->
          <a routerLink="/admin/audit" routerLinkActive="bg-surface-2 text-white" class="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-white">📜 Audit log</a>
        </nav>
        <main class="flex-1 min-w-0">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {}