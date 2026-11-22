import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import {
  WorkflowsService,
  Workflow,
  SourceType,
} from '../../core/api/workflows.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface SourceOption {
  value: SourceType;
  label: string;
}

@Component({
  selector: 'app-workflows-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    TranslocoModule,
    IconComponent,
    ModalComponent,
  ],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            {{ 'workflows.list.title' | transloco }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ 'workflows.list.subtitle' | transloco }}
          </p>
        </div>

        <button
          type="button"
          (click)="openCreate()"
          class="btn-primary self-start sm:self-auto"
        >
          <app-icon name="plus" [size]="14" [strokeWidth]="2.5" />
          <span>{{ 'workflows.list.newWorkflow' | transloco }}</span>
        </button>
      </div>

      <!-- ═══════════════ SEARCH ═══════════════ -->
      @if (!loading() && workflows().length > 0) {
        <div class="relative">
          <app-icon
            name="search"
            [size]="14"
            [strokeWidth]="2"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
          />
          <input
            type="text"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="Search workflows by name or source…"
            class="input pl-9"
            aria-label="Search workflows"
          />
          @if (query()) {
            <button
              type="button"
              (click)="query.set('')"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-2 hover:bg-surface-3 hover:text-foreground"
              aria-label="Clear search"
            >
              <app-icon name="x" [size]="12" [strokeWidth]="2.5" />
            </button>
          }
        </div>
      }

      <!-- ═══════════════ CONTENT ═══════════════ -->
      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card">
              <div class="flex items-center justify-between gap-3">
                <div class="flex-1">
                  <div class="skeleton h-4 w-48"></div>
                  <div class="skeleton mt-2 h-3 w-32"></div>
                </div>
                <div class="skeleton h-3 w-16"></div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="20" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm font-medium text-signal-rose">
            {{ error() | transloco }}
          </p>
          <button type="button" (click)="load()" class="btn-secondary text-xs">
            <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
            <span>Retry</span>
          </button>
        </div>
      } @else if (workflows().length === 0) {
        <!-- Empty state -->
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-relay-violet/30 bg-relay-violet/10 text-relay-violet">
            <app-icon name="workflow" [size]="28" [strokeWidth]="1.75" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-foreground">
            {{ 'workflows.list.emptyTitle' | transloco }}
          </h3>
          <p class="mt-1.5 max-w-sm text-sm text-muted">
            {{ 'workflows.list.emptyBody' | transloco }}
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" (click)="openCreate()" class="btn-primary">
              <app-icon name="plus" [size]="14" [strokeWidth]="2.5" />
              <span>{{ 'workflows.list.createWorkflow' | transloco }}</span>
            </button>
            <a routerLink="/guide" class="btn-secondary">
              <app-icon name="book" [size]="14" [strokeWidth]="2" />
              <span>Read guide</span>
            </a>
          </div>
        </div>
      } @else if (filtered().length === 0) {
        <!-- Search empty -->
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="search" [size]="20" [strokeWidth]="2" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No matches</p>
          <p class="mt-1 text-xs text-muted">No workflows match "{{ query() }}"</p>
          <button type="button" (click)="query.set('')" class="btn-ghost mt-3 text-xs">
            Clear search
          </button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (wf of filtered(); track wf.id) {
            <a
              [routerLink]="['/workflows', wf.id]"
              class="card-interactive group block"
            >
              <div class="flex items-center gap-3">
                <!-- Source color chip -->
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  [ngClass]="sourceColor(wf.sourceType)"
                >
                  <app-icon name="workflow" [size]="18" [strokeWidth]="2" />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <h3 class="truncate text-sm font-semibold text-foreground group-hover:text-foreground">
                      {{ wf.name }}
                    </h3>
                    @if (!wf.isActive) {
                      <span class="badge">{{ 'workflows.list.inactive' | transloco }}</span>
                    }
                    @if (wf.enrichmentEnabled) {
                      <span class="badge badge-info">
                        <app-icon name="sparkles" [size]="9" [strokeWidth]="2.5" />
                        {{ 'workflows.list.ai' | transloco }}
                      </span>
                    }
                  </div>
                  <p class="mt-1 truncate text-xs text-muted">
                    <span class="font-mono">{{ wf.sourceType }}</span>
                    <span class="mx-1.5 text-muted-2">·</span>
                    {{ wf._count?.destinations ?? 0 }} {{ 'workflows.list.destinations' | transloco }}
                    <span class="mx-1.5 text-muted-2">·</span>
                    {{ wf.createdAt | date: 'short' }}
                  </p>
                </div>

                <app-icon
                  name="arrow-right"
                  [size]="16"
                  [strokeWidth]="2"
                  class="shrink-0 text-muted-2 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </div>
            </a>
          }
        </div>
      }

      <!-- ═══════════════ CREATE MODAL ═══════════════ -->
      @if (showCreate()) {
        <app-modal
          title="{{ 'workflows.list.modal.title' | transloco }}"
          subtitle="A workflow receives webhooks, enriches them, and routes to destinations."
          size="md"
          (closed)="closeCreate()"
        >
          <form [formGroup]="form" (ngSubmit)="submit()" id="create-workflow-form" class="space-y-4">
            <div>
              <label for="wf-name" class="label">{{ 'workflows.list.modal.name' | transloco }}</label>
              <input
                id="wf-name"
                formControlName="name"
                class="input"
                [placeholder]="'workflows.list.modal.namePlaceholder' | transloco"
                autocomplete="off"
              />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <p class="mt-1.5 text-xs text-signal-rose">Name required (min 2 chars)</p>
              }
            </div>

            <div>
              <label for="wf-source" class="label">{{ 'workflows.list.modal.sourceType' | transloco }}</label>
              <select id="wf-source" formControlName="sourceType" class="input">
                @for (opt of sourceOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div>
              <label for="wf-secret" class="label">{{ 'workflows.list.modal.signingSecret' | transloco }}</label>
              <input
                id="wf-secret"
                formControlName="secret"
                class="input font-mono text-xs"
                placeholder="whsec_..."
                autocomplete="off"
              />
              <p class="mt-1.5 text-xs text-muted">
                {{ 'workflows.list.modal.signingSecretHint' | transloco }}
              </p>
              @if (form.controls.secret.touched && form.controls.secret.invalid) {
                <p class="mt-1.5 text-xs text-signal-rose">Signing secret required (min 8 chars)</p>
              }
            </div>

            <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface-2 p-3 transition-colors hover:border-hairline-strong">
              <input
                type="checkbox"
                formControlName="enrichmentEnabled"
                class="h-4 w-4 cursor-pointer rounded border-hairline-strong bg-surface-3 text-relay-violet focus:ring-2 focus:ring-relay-violet focus:ring-offset-0"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">
                  {{ 'workflows.list.modal.enableAI' | transloco }}
                </p>
                <p class="text-[11px] text-muted">
                  Optional · Summarize, classify, or extract fields
                </p>
              </div>
              <app-icon name="sparkles" [size]="16" [strokeWidth]="2" class="text-relay-cyan" />
            </label>

            @if (createError()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ createError() }}</span>
              </div>
            }
          </form>

          <div modal-footer>
            <button type="button" (click)="closeCreate()" class="btn-secondary">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="form.invalid || saving()"
              class="btn-primary"
            >
              @if (saving()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              }
              <span>{{ (saving() ? 'workflows.list.modal.creating' : 'workflows.list.modal.create') | transloco }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class WorkflowsListComponent implements OnInit, OnDestroy {
  private readonly svc = inject(WorkflowsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly destroy$ = new Subject<void>();

  readonly workflows = signal<Workflow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly createError = signal<string | null>(null);
  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const list = this.workflows();
    if (!q) return list;
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.sourceType.toLowerCase().includes(q),
    );
  });

  readonly sourceOptions: SourceOption[] = [
    { value: 'stripe' as SourceType, label: 'Stripe' },
    { value: 'github' as SourceType, label: 'GitHub' },
    { value: 'shopify' as SourceType, label: 'Shopify' },
    { value: 'slack' as SourceType, label: 'Slack' },
    { value: 'generic' as SourceType, label: 'Generic (HMAC)' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sourceType: ['stripe' as SourceType, Validators.required],
    secret: ['', [Validators.required, Validators.minLength(8)]],
    enrichmentEnabled: [false],
  });

  ngOnInit(): void {
    this.load();

    // Handle ?new=1 from header/dashboard button
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        if (params['new'] === '1') {
          this.openCreate();
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { new: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: (list) => {
        this.workflows.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'workflows.list.errors.loadFailed',
        );
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.form.reset({
      name: '',
      sourceType: 'stripe',
      secret: '',
      enrichmentEnabled: false,
    });
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
        next: (wf) => {
          this.saving.set(false);
          this.showCreate.set(false);
          this.toast.success(`Workflow "${wf.name}" created`);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.createError.set(
            err?.error?.message ?? 'workflows.list.errors.createFailed',
          );
        },
      });
  }

  sourceColor(type: string): string {
    switch (type) {
      case 'stripe':
        return 'bg-relay-violet/10 text-relay-violet';
      case 'github':
        return 'bg-surface-3 text-foreground';
      case 'shopify':
        return 'bg-signal-green/10 text-signal-green';
      case 'slack':
        return 'bg-relay-cyan/10 text-relay-cyan';
      default:
        return 'bg-surface-2 text-muted';
    }
  }
}