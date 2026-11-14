import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CommunityApiService,
  type PostType,
} from '../../core/community/community.service';
import { WorkflowsService, type Workflow } from '../../core/api/workflows.service';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="max-w-3xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Create post</h1>
        <p class="text-sm text-muted mt-1">Share a discussion, workflow template, or article</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="card space-y-4">
        <div>
          <label class="label">Type</label>
          <div class="flex gap-2">
            @for (t of types; track t.value) {
              <button
                type="button"
                (click)="setType(t.value)"
                class="px-3 py-1.5 rounded text-xs border"
                [class.border-relay-violet]="form.controls.type.value === t.value"
                [class.text-white]="form.controls.type.value === t.value"
                [class.bg-surface-2]="form.controls.type.value === t.value"
                [class.border-hairline]="form.controls.type.value !== t.value"
                [class.text-muted]="form.controls.type.value !== t.value"
              >{{ t.label }}</button>
            }
          </div>
        </div>

        <div>
          <label class="label">Title</label>
          <input formControlName="title" class="input" placeholder="Short, descriptive title" />
        </div>

        @if (form.controls.type.value === 'template') {
          <div>
            <label class="label">Select workflow to share</label>
            <select (change)="onWorkflowSelect($event)" class="input">
              <option value="">— Select a workflow —</option>
              @for (w of workflows(); track w.id) {
                <option [value]="w.id">{{ w.name }}</option>
              }
            </select>
            <p class="text-xs text-muted mt-1">
              Workflow config (with secrets redacted) will be included as a shareable template.
            </p>
            @if (selectedWorkflowYaml()) {
              <p class="text-xs text-signal-green mt-1">✓ Workflow loaded</p>
            }
          </div>
        }

        <div>
          <label class="label">Content (Markdown)</label>
          <textarea formControlName="content" rows="12" class="input font-mono text-sm" placeholder="# What I want to share..."></textarea>
        </div>

        <div>
          <label class="label">Tags (comma-separated)</label>
          <input formControlName="tagsInput" class="input" placeholder="stripe, slack, alerts" />
        </div>

        @if (error()) {
          <div class="text-sm text-signal-rose">{{ error() }}</div>
        }

        <div class="flex justify-end gap-2">
          <a routerLink="/community" class="btn-secondary">Cancel</a>
          <button type="submit" [disabled]="form.invalid || submitting()" class="btn-primary">
            {{ submitting() ? 'Publishing...' : 'Publish post' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CreatePostComponent {
  private fb = inject(FormBuilder);
  private api = inject(CommunityApiService);
  private wfSvc = inject(WorkflowsService);
  private router = inject(Router);

  readonly types: Array<{ value: PostType; label: string }> = [
    { value: 'discussion', label: 'Discussion' },
    { value: 'template', label: 'Workflow template' },
    { value: 'article', label: 'Article' },
  ];

  workflows = signal<Workflow[]>([]);
  selectedWorkflowYaml = signal<string | null>(null);
  submitting = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    type: ['discussion' as PostType, Validators.required],
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    content: ['', [Validators.required, Validators.minLength(20)]],
    tagsInput: [''],
  });

  constructor() {
    this.wfSvc.list().subscribe({ next: (w) => this.workflows.set(w) });
  }

  setType(t: PostType): void {
    this.form.patchValue({ type: t });
  }

  onWorkflowSelect(evt: Event): void {
    const id = (evt.target as HTMLSelectElement).value;
    if (!id) {
      this.selectedWorkflowYaml.set(null);
      return;
    }
    this.wfSvc.exportYaml(id).subscribe({
      next: (yaml) => this.selectedWorkflowYaml.set(yaml),
      error: () => this.error.set('Failed to export workflow'),
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
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
    const tags = v.tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const metadata: Record<string, unknown> = {};
    if (v.type === 'template' && this.selectedWorkflowYaml()) {
      metadata['workflowYaml'] = this.selectedWorkflowYaml();
    }

    this.api
      .createPost({
        type: v.type,
        title: v.title,
        content: v.content,
        tags,
        metadata,
      })
      .subscribe({
        next: (p) => this.router.navigate(['/community', p.slug]),
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message ?? 'Failed to publish');
        },
      });
  }
}