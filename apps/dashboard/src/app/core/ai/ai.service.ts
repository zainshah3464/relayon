import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface ChatEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: unknown;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  status(): Observable<{ enabled: boolean; model: string }> {
    return this.http.get<{ enabled: boolean; model: string }>(
      `${environment.apiUrl}/api/ai/status`,
    );
  }

  /**
   * Stream chat via SSE (POST + ReadableStream, not EventSource).
   * Yields parsed events. Caller handles UI state.
   */
  async *streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const res = await fetch(`${environment.apiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`,
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Chat failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const evt of events) {
        const line = evt.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          yield JSON.parse(line.slice(6)) as ChatEvent;
        } catch {
          // ignore malformed
        }
      }
    }
  }
}