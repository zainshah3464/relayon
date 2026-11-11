import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  WorkflowsService,
  Workflow,
  SourceType,
} from '../../core/api/workflows.service';

@Component({
  selector: 'app-workflows-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslocoModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'workflows.list.title' | transloco }}</h1>
          <p class="text-sm text-muted mt-1">{{ 'workflows.list.subtitle' | transloco }}</p>
        </div>
        <button (click)="openCreate()" class="btn-primary">{{ 'workflows.list.newWorkflow' | transloco }}</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">{{ 'workflows.list.loading' | transloco }}</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() | transloco }}</div>
      } @else if (workflows().length === 0) {
        <div class="card text-center py-12">
          <div class="text-3xl mb-2">🔄</div>
          <h3 class="text-lg font-semibold text-white">{{ 'workflows.list.emptyTitle' | transloco }}</h3>
          <p class="text-sm text-muted mt-1">{{ 'workflows.list.emptyBody' | transloco }}</p>
          <button (click)="openCreate()" class="btn-primary mt-4">{{ 'workflows.list.createWorkflow' | transloco }}</button>
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
                      <span class="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted">{{ 'workflows.list.inactive' | transloco }}</span>
                    }
                    @if (wf.enrichmentEnabled) {
                      <span class="text-xs px-2 py-0.5 rounded bg-relay-cyan/20 text-relay-cyan">{{ 'workflows.list.ai' | transloco }}</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-1 font-mono">
                    {{ wf.sourceType }} · {{ wf._count?.destinations ?? 0 }} {{ 'workflows.list.destinations' | transloco }}
                  </p>
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
            <h2 class="text-lg font-semibold text-white mb-4">{{ 'workflows.list.modal.title' | transloco }}</h2>
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label class="label">{{ 'workflows.list.modal.name' | transloco }}</label>
                <input formControlName="name" class="input" [placeholder]="'workflows.list.modal.namePlaceholder' | transloco" />
              </div>
              <div>
                <label class="label">{{ 'workflows.list.modal.sourceType' | transloco }}</label>
                <select formControlName="sourceType" class="input">
                  <option value="stripe">Stripe</option>
                  <option value="github">GitHub</option>
                  <option value="shopify">Shopify</option>
                  <option value="slack">Slack</option>
                  <option value="generic">{{ 'workflows.list.modal.genericHmac' | transloco }}</option>
                </select>
              </div>
              <div>
                <label class="label">{{ 'workflows.list.modal.signingSecret' | transloco }}</label>
                <input formControlName="secret" class="input font-mono" placeholder="whsec_..." />
                <p class="text-xs text-muted mt-1">{{ 'workflows.list.modal.signingSecretHint' | transloco }}</p>
              </div>
              <div class="flex items-center gap-2">
                <input id="enrich" type="checkbox" formControlName="enrichmentEnabled" class="rounded border-hairline" />
                <label for="enrich" class="text-sm text-white">{{ 'workflows.list.modal.enableAI' | transloco }}</label>
              </div>
              @if (createError()) {
                <div class="text-sm text-signal-rose">{{ createError() | transloco }}</div>
              }
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="closeCreate()" class="btn-secondary">{{ 'common.cancel' | transloco }}</button>
                <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
                  {{ (saving() ? 'workflows.list.modal.creating' : 'workflows.list.modal.create') | transloco }}
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
        this.error.set(err?.error?.message ?? 'workflows.list.errors.loadFailed');
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
          this.createError.set(err?.error?.message ?? 'workflows.list.errors.createFailed');
        },
      });
  }
}