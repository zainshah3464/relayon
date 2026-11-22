import { Component, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface StateAt {
  timestamp: string;
  tenant: { id: string; name: string; slug: string; plan: string; createdAt: string };
  workflows: Array<{
    id: string;
    name: string;
    sourceType: string;
    isActive: boolean;
    version: number;
    versionCreatedAt: string;
  }>;
  auditTrail: Array<{
    action: string;
    adminId: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }>;
  usage: Record<string, number>;
  note: string;
}

@Component({
  selector: 'app-time-travel-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="card">
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-relay-cyan/10 text-relay-cyan">
          <app-icon name="clock" [size]="16" [strokeWidth]="2" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold text-foreground">Time travel</h2>
          <p class="mt-0.5 text-xs text-muted">View tenant state at any past moment</p>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          [(ngModel)]="timestamp"
          class="input max-w-xs"
          aria-label="Date and time to inspect"
        />
        <button
          type="button"
          (click)="load()"
          [disabled]="loading() || !timestamp"
          class="btn-primary self-start"
        >
          @if (loading()) {
            <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
          } @else {
            <app-icon name="search" [size]="12" [strokeWidth]="2.5" />
          }
          <span>{{ loading() ? 'Loading…' : 'View state' }}</span>
        </button>
      </div>

      @if (error()) {
        <div class="mt-3 flex items-start gap-2 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-xs text-signal-rose">
          <app-icon name="alert-circle" [size]="13" [strokeWidth]="2" class="mt-0.5 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      }

      @if (data(); as d) {
        <div class="mt-4 space-y-4">
          <p class="rounded-md bg-surface-2 px-2.5 py-1.5 text-[11px] italic text-muted">{{ d.note }}</p>

          <div>
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              State at {{ d.timestamp | date: 'medium' }}
            </p>
            <div class="mt-2 rounded-lg border border-hairline bg-surface-2 p-3">
              <p class="text-sm font-medium text-foreground">{{ d.tenant.name }}</p>
              <p class="mt-0.5 text-xs text-muted">Plan: <span class="capitalize text-foreground">{{ d.tenant.plan }}</span></p>
            </div>
          </div>

          <div>
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              Workflows ({{ d.workflows.length }})
            </p>
            @if (d.workflows.length === 0) {
              <p class="mt-2 rounded-md bg-surface-2/50 px-3 py-3 text-xs text-muted">
                No workflows at this time
              </p>
            } @else {
              <div class="mt-2 space-y-1">
                @for (w of d.workflows; track w.id) {
                  <div class="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface-2 p-2 text-xs">
                    <span class="truncate text-foreground">{{ w.name }}</span>
                    <span class="shrink-0 font-mono text-[10px] text-muted">
                      v{{ w.version }} · {{ w.isActive ? 'active' : 'paused' }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>

          @if (d.auditTrail.length > 0) {
            <div>
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                Admin actions ({{ d.auditTrail.length }})
              </p>
              <div class="mt-2 max-h-64 space-y-1 overflow-y-auto">
                @for (a of d.auditTrail; track $index) {
                  <div class="flex items-center justify-between gap-2 rounded-md bg-surface-2 p-2 text-xs">
                    <span class="font-mono text-[11px] text-signal-amber">{{ a.action }}</span>
                    <span class="text-[10px] text-muted-2">{{ a.createdAt | date: 'short' }}</span>
                  </div>
                }
              </div>
            </div>
          }

          @if (usageKeys(d).length > 0) {
            <div>
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Usage</p>
              <div class="mt-2 space-y-1 rounded-md border border-hairline bg-surface-2 p-3">
                @for (k of usageKeys(d); track k) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted">{{ k }}</span>
                    <span class="font-mono tabular-nums text-foreground">{{ d.usage[k] }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimeTravelPanelComponent {
  readonly tenantId = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  timestamp = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<StateAt | null>(null);

  load(): void {
    if (!this.timestamp) return;
    this.loading.set(true);
    this.error.set(null);

    const iso = new Date(this.timestamp).toISOString();
    this.http
      .get<StateAt>(
        `${environment.apiUrl}/api/admin/time-travel/tenants/${this.tenantId()}?at=${encodeURIComponent(iso)}`,
      )
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load state');
          this.loading.set(false);
        },
      });
  }

  usageKeys(d: StateAt): string[] {
    return Object.keys(d.usage ?? {});
  }
}