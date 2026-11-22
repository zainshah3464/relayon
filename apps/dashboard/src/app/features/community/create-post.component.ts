import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import {
  CommunityApiService,
  type PostType,
} from '../../core/community/community.service';
import {
  WorkflowsService,
  type Workflow,
} from '../../core/api/workflows.service';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface TypeOption {
  value: PostType;
  label: string;
  desc: string;
  icon: IconName;
}

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MarkdownComponent,
    IconComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl space-y-5">
      <!-- ═══════════ HEADER ═══════════ -->
      <div>
        <a
          routerLink="/community"
          class="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          <app-icon name="arrow-left" [size]="12" [strokeWidth]="2.5" />
          <span>Back to community</span>
        </a>
        <h1 class="mt-2 text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
          Create post
        </h1>
        <p class="mt-1 text-sm text-muted">
          Share a discussion, workflow template, or article.
        </p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <!-- ═══════════ TYPE SELECTOR ═══════════ -->
        <div>
          <label class="label">Post type</label>
          <div class="grid gap-2 sm:grid-cols-3">
            @for (t of types; track t.value) {
              <button
                type="button"
                (click)="setType(t.value)"
                class="card-interactive flex items-start gap-2.5 text-left transition-all"
                [ngClass]="{
                  'border-relay-violet': form.controls.type.value === t.value,
                  'bg-relay-violet/[0.06]': form.controls.type.value === t.value
                }"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  [ngClass]="{
                    'bg-relay-violet/15': form.controls.type.value === t.value,
                    'text-relay-violet': form.controls.type.value === t.value,
                    'bg-surface-2': form.controls.type.value !== t.value,
                    'text-muted': form.controls.type.value !== t.value
                  }"
                >
                  <app-icon [name]="t.icon" [size]="15" [strokeWidth]="2" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground">{{ t.label }}</p>
                  <p class="mt-0.5 text-[11px] leading-tight text-muted">{{ t.desc }}</p>
                </div>
              </button>
            }
          </div>
        </div>

        <!-- ═══════════ TITLE + CONTENT CARD ═══════════ -->
        <div class="card space-y-4">
          <div>
            <label for="post-title" class="label">Title</label>
            <input
              id="post-title"
              formControlName="title"
              class="input"
              placeholder="Short, descriptive title"
              autocomplete="off"
            />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <p class="mt-1.5 text-xs text-signal-rose">
                Title required (5–200 characters)
              </p>
            }
          </div>

          <!-- ═══════════ WORKFLOW SELECTOR (template only) ═══════════ -->
          @if (form.controls.type.value === 'template') {
            <div>
              <label for="wf-select" class="label">Workflow to share</label>
              <select
                id="wf-select"
                (change)="onWorkflowSelect($event)"
                class="input"
              >
                <option value="">— Select a workflow —</option>
                @for (w of workflows(); track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select>
              <p class="mt-1.5 text-[11px] text-muted">
                Workflow config is included with secrets redacted. Users can import it as their own workflow.
              </p>
              @if (selectedWorkflowYaml()) {
                <p class="mt-1.5 flex items-center gap-1.5 text-xs text-signal-green">
                  <app-icon name="check-circle" [size]="12" [strokeWidth]="2" />
                  Workflow loaded and ready
                </p>
              }
            </div>
          }

          <!-- ═══════════ CONTENT ═══════════ -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <label for="post-content" class="label mb-0">
                Content
                <span class="ml-1 font-normal normal-case text-muted-2">(Markdown supported)</span>
              </label>
              <button
                type="button"
                (click)="togglePreview()"
                class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <app-icon
                  [name]="showPreview() ? 'edit' : 'eye'"
                  [size]="11"
                  [strokeWidth]="2"
                />
                <span>{{ showPreview() ? 'Edit' : 'Preview' }}</span>
              </button>
            </div>

            @if (showPreview()) {
              <div class="prose prose-invert min-h-[16rem] max-w-none rounded-lg border border-hairline bg-surface-2 p-4">
                @if (form.controls.content.value) {
                  <markdown [data]="form.controls.content.value" />
                } @else {
                  <p class="text-sm text-muted">Nothing to preview yet.</p>
                }
              </div>
            } @else {
              <textarea
                id="post-content"
                formControlName="content"
                rows="14"
                class="input font-mono text-sm"
                placeholder="# What I want to share…&#10;&#10;Explain the context, what problem it solves, and how to use it."
              ></textarea>
            }

            @if (form.controls.content.touched && form.controls.content.invalid) {
              <p class="mt-1.5 text-xs text-signal-rose">
                Content required (min 20 characters)
              </p>
            }
          </div>

          <!-- ═══════════ TAGS ═══════════ -->
          <div>
            <label for="post-tags" class="label">Tags</label>
            <div class="flex flex-wrap gap-1.5 rounded-lg border border-hairline bg-surface-2 p-2">
              @for (tag of tags(); track tag) {
                <span class="inline-flex items-center gap-1 rounded-md bg-relay-violet/15 px-2 py-0.5 text-xs text-relay-violet">
                  <span class="font-mono">{{ tag }}</span>
                  <button
                    type="button"
                    (click)="removeTag(tag)"
                    class="rounded p-0.5 hover:bg-relay-violet/25"
                    [attr.aria-label]="'Remove tag ' + tag"
                  >
                    <app-icon name="x" [size]="9" [strokeWidth]="3" />
                  </button>
                </span>
              }
              <input
                id="post-tags"
                [value]="tagInput()"
                (input)="onTagInput($any($event.target).value)"
                (keydown)="onTagKeydown($event)"
                (blur)="commitTagInput()"
                placeholder="Type a tag and press Enter"
                class="min-w-0 flex-1 border-0 bg-transparent p-0.5 text-xs text-foreground placeholder:text-muted-2 focus:outline-none"
                autocomplete="off"
              />
            </div>
            <p class="mt-1.5 text-[11px] text-muted-2">
              Press Enter or comma to add. Up to 8 tags.
            </p>
          </div>

          <!-- ═══════════ ERROR ═══════════ -->
          @if (error()) {
            <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
              <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ error() }}</span>
            </div>
          }
        </div>

        <!-- ═══════════ ACTIONS ═══════════ -->
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <a routerLink="/community" class="btn-secondary justify-center">
            Cancel
          </a>
          <button
            type="submit"
            [disabled]="form.invalid || submitting() || (form.controls.type.value === 'template' && !selectedWorkflowYaml())"
            class="btn-primary justify-center"
          >
            @if (submitting()) {
              <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
            } @else {
              <app-icon name="send" [size]="13" [strokeWidth]="2" />
            }
            <span>{{ submitting() ? 'Publishing…' : 'Publish post' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CreatePostComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunityApiService);
  private readonly wfSvc = inject(WorkflowsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly types: TypeOption[] = [
    {
      value: 'discussion',
      label: 'Discussion',
      desc: 'Ask a question or start a conversation',
      icon: 'message-square',
    },
    {
      value: 'template',
      label: 'Template',
      desc: 'Share a reusable workflow config',
      icon: 'code',
    },
    {
      value: 'article',
      label: 'Article',
      desc: 'Write a long-form post or tutorial',
      icon: 'file-text',
    },
  ];

  readonly workflows = signal<Workflow[]>([]);
  readonly selectedWorkflowYaml = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPreview = signal(false);

  readonly tags = signal<string[]>([]);
  readonly tagInput = signal('');

  readonly form = this.fb.nonNullable.group({
    type: ['discussion' as PostType, Validators.required],
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    content: ['', [Validators.required, Validators.minLength(20)]],
  });

  constructor() {
    this.wfSvc.list().subscribe({
      next: (w) => this.workflows.set(w),
      error: () => this.workflows.set([]),
    });
  }

  setType(t: PostType): void {
    this.form.patchValue({ type: t });
    if (t !== 'template') {
      this.selectedWorkflowYaml.set(null);
    }
  }

  onWorkflowSelect(evt: Event): void {
    const id = (evt.target as HTMLSelectElement).value;
    if (!id) {
      this.selectedWorkflowYaml.set(null);
      return;
    }
    this.wfSvc.exportYaml(id).subscribe({
      next: (yaml) => this.selectedWorkflowYaml.set(yaml),
      error: () => {
        this.error.set('Failed to export workflow');
        this.selectedWorkflowYaml.set(null);
      },
    });
  }

  togglePreview(): void {
    this.showPreview.update((v) => !v);
  }

  onTagInput(value: string): void {
    this.tagInput.set(value);
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitTagInput();
    } else if (event.key === 'Backspace' && !this.tagInput()) {
      this.tags.update((list) => list.slice(0, -1));
    }
  }

  commitTagInput(): void {
    const tag = this.tagInput().trim().toLowerCase().replace(/^,|,$/g, '');
    if (!tag) {
      this.tagInput.set('');
      return;
    }
    if (this.tags().length >= 8) {
      this.tagInput.set('');
      return;
    }
    if (this.tags().includes(tag)) {
      this.tagInput.set('');
      return;
    }
    this.tags.update((list) => [...list, tag]);
    this.tagInput.set('');
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((t) => t !== tag));
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;

    // Flush any pending tag input
    if (this.tagInput().trim()) {
      this.commitTagInput();
    }

    if (
      this.form.controls.type.value === 'template' &&
      !this.selectedWorkflowYaml()
    ) {
      this.error.set('Please select a workflow to share');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const metadata: Record<string, unknown> = {};
    if (v.type === 'template' && this.selectedWorkflowYaml()) {
      metadata['workflowYaml'] = this.selectedWorkflowYaml();
    }

    this.api
      .createPost({
        type: v.type,
        title: v.title,
        content: v.content,
        tags: this.tags(),
        metadata,
      })
      .subscribe({
        next: (p) => {
          this.toast.success('Post published');
          void this.router.navigate(['/community', p.slug]);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message ?? 'Failed to publish');
        },
      });
  }
}