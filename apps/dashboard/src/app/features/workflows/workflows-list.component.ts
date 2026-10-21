import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  WorkflowsService,
  Workflow,
  SourceType,
} from '../../core/api/workflows.service';

@Component({
  selector: 'app-workflows-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Workflows</h1>
          <p class="text-sm text-muted mt-1">Webhook pipelines that receive, enrich, and route events.</p>
        </div>
        <button (click)="openCreate()" class="btn-primary">+ New workflow</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading workflows...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else if (workflows().length === 0) {
        <div class="card text-center py-12">
          <div class="text-3xl mb-2">🔄</div>
          <h3 class="text-lg font-semibold text-white">No workflows yet</h3>
          <p class="text-sm text-muted mt-1">Create your first workflow to start receiving webhooks.</p>
          <button (click)="openCreate()" class="btn-primary mt-4">Create workflow</button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (wf of workflows(); track wf.id) {
            <a [routerLink]="['/workflows', wf.id]" class="card block hover:bg-surface-2 transition">
              <div class="flex items-center justify-between">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-white font-medium truncate">{{ wf.name }}</h3>
                    @if (!wf.isActive) {
                      <span class="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted">Inactive</span>
                    }
                    @if (wf.enrichmentEnabled) {
                      <span class="text-xs px-2 py-0.5 rounded bg-relay-cyan/20 text-relay-cyan">AI</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-1 font-mono">{{ wf.sourceType }} · {{ wf._count?.destinations ?? 0 }} destination(s)</p>
                </div>
                <div class="text-xs text-muted">
                  {{ wf.createdAt | date: 'short' }}
                </div>
              </div>
            </a>
          }
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreate()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">New workflow</h2>
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label class="label">Name</label>
                <input formControlName="name" class="input" placeholder="Stripe → Slack alerts" />
              </div>
              <div>
                <label class="label">Source type</label>
                <select formControlName="sourceType" class="input">
                  <option value="stripe">Stripe</option>
                  <option value="github">GitHub</option>
                  <option value="shopify">Shopify</option>
                  <option value="slack">Slack</option>
                  <option value="generic">Generic (HMAC)</option>
                </select>
              </div>
              <div>
                <label class="label">Signing secret</label>
                <input formControlName="secret" class="input font-mono" placeholder="whsec_..." />
                <p class="text-xs text-muted mt-1">Shared HMAC secret from the source platform.</p>
              </div>
              <div class="flex items-center gap-2">
                <input id="enrich" type="checkbox" formControlName="enrichmentEnabled" class="rounded border-hairline" />
                <label for="enrich" class="text-sm text-white">Enable AI enrichment (Groq)</label>
              </div>
              @if (createError()) {
                <div class="text-sm text-signal-rose">{{ createError() }}</div>
              }
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="closeCreate()" class="btn-secondary">Cancel</button>
                <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
                  {{ saving() ? 'Creating...' : 'Create' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowsListComponent implements OnInit {
  private svc = inject(WorkflowsService);
  private fb = inject(FormBuilder);

  workflows = signal<Workflow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  showCreate = signal(false);
  saving = signal(false);
  createError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sourceType: ['stripe' as SourceType, Validators.required],
    secret: ['', [Validators.required, Validators.minLength(8)]],
    enrichmentEnabled: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: (list) => {
        this.workflows.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load workflows');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.form.reset({ name: '', sourceType: 'stripe', secret: '', enrichmentEnabled: false });
    this.createError.set(null);
    this.showCreate.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.showCreate.set(false);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();

    this.saving.set(true);
    this.createError.set(null);

    this.svc
      .create({
        name: v.name,
        sourceType: v.sourceType,
        sourceConfig: { secret: v.secret },
        enrichmentEnabled: v.enrichmentEnabled,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreate.set(false);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.createError.set(err?.error?.message ?? 'Failed to create workflow');
        },
      });
  }
}