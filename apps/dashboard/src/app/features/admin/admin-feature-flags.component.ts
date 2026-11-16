import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Feature flags</h1>
        <p class="text-sm text-muted mt-1">Gradual rollouts, no redeploy</p>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (flags().length === 0) {
        <div class="card text-center py-8 text-sm text-muted">
          No flags yet. Create via Prisma Studio or seed script.
        </div>
      } @else {
        <div class="space-y-2">
          @for (f of flags(); track f.key) {
            <div class="card">
              <div class="flex justify-between items-start">
                <div>
                  <code class="text-sm text-relay-cyan font-mono">{{ f.key }}</code>
                  @if (f.description) {
                    <p class="text-xs text-muted mt-1">{{ f.description }}</p>
                  }
                </div>
                <span
                  class="text-xs px-2 py-0.5 rounded"
                  [ngClass]="{
                    'bg-signal-green/20': f.isEnabled,
                    'text-signal-green': f.isEnabled,
                    'bg-surface-2': !f.isEnabled,
                    'text-muted': !f.isEnabled
                  }">
                  {{ f.isEnabled ? 'ON' : 'OFF' }}
                </span>
              </div>
              <div class="mt-3 flex items-center gap-4">
                <div class="flex-1">
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-muted">Rollout</span>
                    <span class="text-white">{{ f.rolloutPct }}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5"
                    [value]="f.rolloutPct"
                    (change)="updateRollout(f, +$any($event.target).value)"
                    class="w-full" />
                </div>
                <button (click)="toggle(f)" class="btn-secondary text-xs">
                  {{ f.isEnabled ? 'Disable' : 'Enable' }}
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
  private http = inject(HttpClient);
  flags = signal<Flag[]>([]);
  loading = signal(true);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.http.get<Flag[]>(`${environment.apiUrl}/api/admin/feature-flags`).subscribe({
      next: (r) => { this.flags.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggle(f: Flag): void {
    this.http.patch(`${environment.apiUrl}/api/admin/feature-flags/${f.key}`, { isEnabled: !f.isEnabled })
      .subscribe({ next: () => this.load() });
  }

  updateRollout(f: Flag, pct: number): void {
    this.http.patch(`${environment.apiUrl}/api/admin/feature-flags/${f.key}`, { rolloutPct: pct })
      .subscribe({ next: () => this.load() });
  }
}