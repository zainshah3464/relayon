import {
  Component,
  inject,
  signal,
  output,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, type ChatEvent } from '../../core/ai/ai.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls: Array<{ name: string; status: 'pending' | 'done' | 'error'; summary?: string }>;
  streaming?: boolean;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div
      class="fixed z-50 flex flex-col overflow-hidden border border-hairline bg-surface shadow-2xl animate-slide-up
             inset-x-2 top-2 bottom-20 rounded-2xl
             sm:inset-auto sm:bottom-24 sm:end-6 sm:h-[600px] sm:w-[420px] sm:max-w-[calc(100vw-3rem)]"
    >
      <!-- Header -->
      <div class="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-white">
            <app-icon name="sparkles" [size]="16" [strokeWidth]="2" />
          </div>
          <div>
            <p class="text-sm font-semibold text-foreground">Relayon Assistant</p>
            <p class="text-[10px] text-muted">Powered by Groq</p>
          </div>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Close assistant"
        >
          <app-icon name="x" [size]="16" [strokeWidth]="2" />
        </button>
      </div>

      <!-- Messages -->
      <div #scrollContainer class="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        @if (messages().length === 0) {
          <div class="space-y-2">
            <p class="px-1 text-xs text-muted">Hi! I can help you:</p>
            @for (s of suggestions; track s) {
              <button
                type="button"
                (click)="sendSuggestion(s)"
                class="block w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-3 hover:border-hairline-strong"
              >
                {{ s }}
              </button>
            }
          </div>
        }

        @for (m of messages(); track $index) {
          <div [class.text-end]="m.role === 'user'">
            <!-- Tool calls -->
            @if (m.toolCalls.length > 0) {
              <div class="mb-1.5 space-y-1" [class.ms-auto]="m.role === 'user'">
                @for (tc of m.toolCalls; track tc.name) {
                  <div class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] text-muted">
                    @if (tc.status === 'pending') {
                      <span class="inline-block h-2 w-2 rounded-full bg-relay-cyan animate-pulse"></span>
                    } @else if (tc.status === 'done') {
                      <app-icon name="check" [size]="10" [strokeWidth]="2.5" class="text-signal-green" />
                    } @else {
                      <app-icon name="x" [size]="10" [strokeWidth]="2.5" class="text-signal-rose" />
                    }
                    <span class="font-mono">{{ toolLabel(tc.name) }}</span>
                  </div>
                }
              </div>
            }

            <!-- Message bubble -->
            <div
              class="inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed text-left break-words whitespace-pre-wrap"
              [class.bg-relay-violet]="m.role === 'user'"
              [class.text-white]="m.role === 'user'"
              [class.bg-surface-2]="m.role === 'assistant'"
              [class.text-foreground]="m.role === 'assistant'"
            >
              {{ m.content }}
              @if (m.streaming) {
                <span class="ms-0.5 inline-block h-3.5 w-1 animate-pulse bg-current align-middle"></span>
              }
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <form (submit)="send($event)" class="shrink-0 border-t border-hairline bg-surface p-2.5 pb-safe">
        <div class="flex gap-2">
          <input
            [(ngModel)]="input"
            name="input"
            [disabled]="sending()"
            placeholder="Ask about workflows, docs, setup…"
            class="input flex-1 text-sm"
            autocomplete="off"
          />
          <button
            type="submit"
            [disabled]="!input.trim() || sending()"
            class="btn-primary px-3 py-2"
            aria-label="Send message"
          >
            @if (sending()) {
              <app-icon name="loader" [size]="16" [strokeWidth]="2" class="animate-spin" />
            } @else {
              <app-icon name="send" [size]="16" [strokeWidth]="2" />
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ChatPanelComponent implements AfterViewChecked {
  readonly close = output<void>();
  private readonly ai = inject(AiService);

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  readonly messages = signal<UiMessage[]>([]);
  readonly sending = signal(false);
  input = '';

  readonly suggestions = [
    'How do I create a Stripe → Slack workflow?',
    'Show me my workflows',
    'What is the Dead Letter Queue?',
  ];

  ngAfterViewChecked(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  sendSuggestion(s: string): void {
    this.input = s;
    this.send(new Event('submit'));
  }

  async send(evt: Event): Promise<void> {
    evt.preventDefault();
    const text = this.input.trim();
    if (!text || this.sending()) return;
    this.input = '';
    this.sending.set(true);

    this.messages.update((m) => [...m, { role: 'user', content: text, toolCalls: [] }]);

    const assistantIndex = this.messages().length;
    this.messages.update((m) => [
      ...m,
      { role: 'assistant', content: '', toolCalls: [], streaming: true },
    ]);

    const history = this.messages()
      .slice(0, -1)
      .filter((m) => m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      for await (const event of this.ai.streamChat(history)) {
        this.handleEvent(event, assistantIndex);
      }
    } catch (err) {
      this.messages.update((arr) => {
        const next = [...arr];
        const target = next[assistantIndex];
        if (target) {
          target.content = `Error: ${err instanceof Error ? err.message : 'Request failed'}`;
          target.streaming = false;
        }
        return next;
      });
    } finally {
      this.sending.set(false);
    }
  }

  private handleEvent(event: ChatEvent, assistantIndex: number): void {
    this.messages.update((arr) => {
      const next = [...arr];
      const target = next[assistantIndex];
      if (!target) return next;

      if (event.type === 'token') {
        const token = (event.data as { token: string }).token;
        target.content += token;
      } else if (event.type === 'tool_call') {
        const d = event.data as { name: string; requiresConfirmation?: boolean };
        target.toolCalls = [...target.toolCalls, { name: d.name, status: 'pending' }];
      } else if (event.type === 'tool_result') {
        const d = event.data as {
          name: string;
          error?: string;
          requiresConfirmation?: boolean;
        };
        target.toolCalls = target.toolCalls.map((tc) =>
          tc.name === d.name && tc.status === 'pending'
            ? { ...tc, status: d.error || d.requiresConfirmation ? 'error' : 'done' }
            : tc,
        );
      } else if (event.type === 'done') {
        target.streaming = false;
      } else if (event.type === 'error') {
        const d = event.data as { message: string };
        target.content += (target.content ? '\n\n' : '') + `⚠ ${d.message}`;
        target.streaming = false;
      }
      return next;
    });
  }

  toolLabel(name: string): string {
    const map: Record<string, string> = {
      search_docs: 'Searching docs',
      list_workflows: 'Reading workflows',
      get_workflow: 'Loading workflow',
      create_workflow: 'Creating workflow',
      get_delivery_stats: 'Fetching stats',
      list_dlq: 'Checking DLQ',
    };
    return map[name] ?? name;
  }
}