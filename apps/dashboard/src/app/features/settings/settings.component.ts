import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  quotaEventsPerMonth: number;
  quotaAiTokensPerMonth: number;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">Settings</h1>
        <p class="text-sm text-muted mt-1">Workspace configuration.</p>
      </div>

      @if (tenant(); as t) {
        <div class="card">
          <h2 class="text-sm font-medium text-white mb-4">Workspace</h2>
          <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
            <div>
              <label class="label">Name</label>
              <input formControlName="name" class="input" />
            </div>
            <div>
              <label class="label">Slug</label>
              <input [value]="t.slug" disabled class="input opacity-60" />
            </div>
            <div>
              <label class="label">Plan</label>
              <input [value]="t.plan" disabled class="input opacity-60" />
            </div>
            <div class="flex gap-2">
              <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
                {{ saving() ? 'Saving...' : 'Save changes' }}
              </button>
              @if (saved()) {
                <span class="text-sm text-signal-green self-center">Saved</span>
              }
            </div>
          </form>
        </div>

        <div class="card">
          <h2 class="text-sm font-medium text-white mb-2">Quotas</h2>
          <p class="text-xs text-muted">Events/month: {{ t.quotaEventsPerMonth.toLocaleString() }}</p>
          <p class="text-xs text-muted">AI tokens/month: {{ t.quotaAiTokensPerMonth.toLocaleString() }}</p>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  tenant = signal<TenantInfo | null>(null);
  saving = signal(false);
  saved = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.http.get<TenantInfo>(`${environment.apiUrl}/api/tenants/me`).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.form.patchValue({ name: t.name });
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saved.set(false);

    this.http
      .patch<TenantInfo>(`${environment.apiUrl}/api/tenants/me`, this.form.getRawValue())
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.saving.set(false);
          this.saved.set(true);
          setTimeout(() => this.saved.set(false), 2000);
          void this.auth;
        },
        error: () => this.saving.set(false),
      });
  }
}