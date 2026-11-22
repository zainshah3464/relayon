import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface Flag {
  key: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPct: number;
  tenantOverrides: Record<string, boolean>;
}

@Component({
  selector: 'app-admin-feature-flags',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Feature flags</h1>
          <p class="mt-1 text-sm text-muted">Gradual rollouts — no redeploy required</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading()" class="btn-secondary self-start">
          <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" [class.animate-spin]="loading()" />
          <span>Refresh</span>
        </button>
      </div>

      @if (loading() && flags().length === 0) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-40"></div>
              <div class="skeleton mt-2 h-3 w-64"></div>
              <div class="skeleton mt-3 h-2 w-full"></div>
            </div>
          }
        </div>
      } @else if (flags().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="flag" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No flags yet</p>
          <p class="mt-1 text-xs text-muted">Create via Prisma Studio or seed script.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (f of flags(); track f.key) {
            <div class="card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <code class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-relay-cyan">{{ f.key }}</code>
                  @if (f.description) {
                    <p class="mt-1.5 text-xs text-muted">{{ f.description }}</p>
                  }
                </div>
                <span
                  [ngClass]="f.isEnabled ? 'badge-success' : 'badge'"
                  class="badge shrink-0"
                >
                  <span
                    class="inline-block h-1.5 w-1.5 rounded-full"
                    [class.bg-signal-green]="f.isEnabled"
                    [class.bg-muted-2]="!f.isEnabled"
                  ></span>
                  {{ f.isEnabled ? 'ON' : 'OFF' }}
                </span>
              </div>

              <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] text-muted">Rollout</span>
                    <span class="font-mono text-[11px] tabular-nums text-foreground">{{ f.rolloutPct }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="f.rolloutPct"
                    (change)="updateRollout(f, +$any($event.target).value)"
                    class="mt-1 w-full accent-relay-violet"
                    [attr.aria-label]="'Rollout percentage for ' + f.key"
                  />
                </div>
                <button type="button" (click)="toggle(f)" class="btn-secondary text-xs self-start sm:self-auto">
                  <app-icon [name]="f.isEnabled ? 'pause' : 'play'" [size]="11" [strokeWidth]="2.5" />
                  <span>{{ f.isEnabled ? 'Disable' : 'Enable' }}</span>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminFeatureFlagsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly flags = signal<Flag[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<Flag[]>(`${environment.apiUrl}/api/admin/feature-flags`).subscribe({
      next: (r) => {
        this.flags.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(f: Flag): void {
    this.http
      .patch(`${environment.apiUrl}/api/admin/feature-flags/${f.key}`, { isEnabled: !f.isEnabled })
      .subscribe({
        next: () => {
          this.toast.success(`Flag "${f.key}" ${!f.isEnabled ? 'enabled' : 'disabled'}`);
          this.load();
        },
        error: () => this.toast.error('Failed to update flag'),
      });
  }

  updateRollout(f: Flag, pct: number): void {
    this.http
      .patch(`${environment.apiUrl}/api/admin/feature-flags/${f.key}`, { rolloutPct: pct })
      .subscribe({
        next: () => {
          this.toast.success(`Rollout set to ${pct}%`);
          this.load();
        },
        error: () => this.toast.error('Failed to update rollout'),
      });
  }
}