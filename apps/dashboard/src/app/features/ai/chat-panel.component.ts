import { Component, inject, signal, output, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, type ChatEvent } from '../../core/ai/ai.service';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls: Array<{ name: string; status: 'pending' | 'done' | 'error'; summary?: string }>;
  streaming?: boolean;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed bottom-24 end-6 z-50 flex h-[600px] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-hairline bg-surface shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-white text-sm font-bold">AI</div>
          <div>
            <p class="text-sm font-semibold text-white">Relayon Assistant</p>
            <p class="text-[10px] text-muted">Powered by Groq · gpt-oss-120b</p>
          </div>
        </div>
        <button (click)="close.emit()" class="text-muted hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Messages -->
      <div #scrollContainer class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        @if (messages().length === 0) {
          <div class="space-y-3">
            <p class="text-sm text-muted">Hi! I can help you:</p>
            @for (s of suggestions; track s) {
              <button
                (click)="sendSuggestion(s)"
                class="block w-full text-start rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-white hover:bg-surface-2/70 transition"
              >{{ s }}</button>
            }
          </div>
        }
        @for (m of messages(); track $index) {
          <div [class.text-end]="m.role === 'user'">
            @if (m.toolCalls.length > 0) {
              <div class="space-y-1 mb-2" [class.ms-auto]="m.role === 'user'">
                @for (tc of m.toolCalls; track tc.name) {
                  <div class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] text-muted">
                    @if (tc.status === 'pending') {
                      <span class="inline-block w-2 h-2 rounded-full bg-relay-cyan animate-pulse"></span>
                    } @else if (tc.status === 'done') {
                      <span class="text-signal-green">✓</span>
                    } @else {
                      <span class="text-signal-rose">✗</span>
                    }
                    <span class="font-mono">{{ toolLabel(tc.name) }}</span>
                  </div>
                }
              </div>
            }
            <div
              class="inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm text-start whitespace-pre-wrap break-words"
              [class.bg-relay-violet]="m.role === 'user'"
              [class.text-white]="m.role === 'user'"
              [class.bg-surface-2]="m.role === 'assistant'"
              [class.text-white]="m.role === 'assistant'"
            >
              {{ m.content }}
              @if (m.streaming) {
                <span class="inline-block w-1.5 h-3 ms-0.5 bg-white animate-pulse"></span>
              }
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <form (submit)="send($event)" class="border-t border-hairline p-3">
        <div class="flex gap-2">
          <input
            [(ngModel)]="input"
            name="input"
            [disabled]="sending()"
            placeholder="Ask about workflows, docs, setup..."
            class="input flex-1 text-sm"
          />
          <button type="submit" [disabled]="!input.trim() || sending()" class="btn-primary px-3">
            @if (sending()) { … } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"/></svg>
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ChatPanelComponent implements AfterViewChecked {
  readonly close = output<void>();
  private ai = inject(AiService);

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  messages = signal<UiMessage[]>([]);
  input = '';
  sending = signal(false);

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
        target.toolCalls = [
          ...target.toolCalls,
          { name: d.name, status: 'pending' },
        ];
      } else if (event.type === 'tool_result') {
        const d = event.data as { name: string; error?: string; requiresConfirmation?: boolean };
        target.toolCalls = target.toolCalls.map((tc) =>
          tc.name === d.name && tc.status === 'pending'
            ? { ...tc, status: d.error || d.requiresConfirmation ? 'error' : 'done' }
            : tc,
        );
      } else if (event.type === 'done') {
        target.streaming = false;
      } else if (event.type === 'error') {
        const d = event.data as { message: string };
        target.content += (target.content ? '\n\n' : '') + `⚠️ ${d.message}`;
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