import { Component, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface StateAt {
  timestamp: string;
  tenant: { id: string; name: string; slug: string; plan: string; createdAt: string };
  workflows: Array<{ id: string; name: string; sourceType: string; isActive: boolean; version: number; versionCreatedAt: string }>;
  auditTrail: Array<{ action: string; adminId: string; targetType: string | null; targetId: string | null; createdAt: string }>;
  usage: Record<string, number>;
  note: string;
}

@Component({
  selector: 'app-time-travel-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-lg font-semibold text-white">Time travel</h2>
          <p class="text-xs text-muted mt-1">View tenant state at any past moment</p>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <input type="datetime-local" [(ngModel)]="timestamp" class="input max-w-xs" />
        <button (click)="load()" [disabled]="loading() || !timestamp" class="btn-primary text-xs">
          {{ loading() ? 'Loading...' : 'View state' }}
        </button>
      </div>

      @if (error()) {
        <p class="text-sm text-signal-rose">{{ error() }}</p>
      }

      @if (data(); as d) {
        <div class="space-y-4 mt-4">
          <div class="text-xs text-muted italic">{{ d.note }}</div>

          <div>
            <p class="text-xs uppercase text-muted mb-2">State at {{ d.timestamp | date: 'medium' }}</p>
            <div class="bg-surface-2 p-3 rounded">
              <p class="text-white font-medium">{{ d.tenant.name }}</p>
              <p class="text-xs text-muted mt-1">Plan: {{ d.tenant.plan }}</p>
            </div>
          </div>

          <div>
            <p class="text-xs uppercase text-muted mb-2">Workflows ({{ d.workflows.length }})</p>
            @if (d.workflows.length === 0) {
              <p class="text-xs text-muted">No workflows at this time</p>
            } @else {
              <div class="space-y-1">
                @for (w of d.workflows; track w.id) {
                  <div class="bg-surface-2 p-2 rounded text-xs flex justify-between">
                    <span class="text-white">{{ w.name }}</span>
                    <span class="text-muted font-mono">v{{ w.version }} · {{ w.isActive ? 'active' : 'paused' }}</span>
                  </div>
                }
              </div>
            }
          </div>

          @if (d.auditTrail.length > 0) {
            <div>
              <p class="text-xs uppercase text-muted mb-2">Admin actions ({{ d.auditTrail.length }})</p>
              <div class="space-y-1 max-h-64 overflow-y-auto">
                @for (a of d.auditTrail; track $index) {
                  <div class="bg-surface-2 p-2 rounded text-xs">
                    <span class="text-signal-amber font-mono">{{ a.action }}</span>
                    <span class="text-muted ms-2">{{ a.createdAt | date: 'short' }}</span>
                  </div>
                }
              </div>
            </div>
          }

          @if (usageKeys(d).length > 0) {
            <div>
              <p class="text-xs uppercase text-muted mb-2">Usage</p>
              <div class="bg-surface-2 p-3 rounded space-y-1">
                @for (k of usageKeys(d); track k) {
                  <div class="flex justify-between text-xs">
                    <span class="text-muted">{{ k }}</span>
                    <span class="text-white font-mono">{{ d.usage[k] }}</span>
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
  private http = inject(HttpClient);

  timestamp = '';
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<StateAt | null>(null);

  load(): void {
    if (!this.timestamp) return;
    this.loading.set(true);
    this.error.set(null);
    const iso = new Date(this.timestamp).toISOString();
    this.http
      .get<StateAt>(`${environment.apiUrl}/api/admin/time-travel/tenants/${this.tenantId()}?at=${encodeURIComponent(iso)}`)
      .subscribe({
        next: (d) => { this.data.set(d); this.loading.set(false); },
        error: (err) => { this.error.set(err?.error?.message ?? 'Failed'); this.loading.set(false); },
      });
  }

  usageKeys(d: StateAt): string[] {
    return Object.keys(d.usage ?? {});
  }
}