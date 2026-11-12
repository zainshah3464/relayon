import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { ChatPanelComponent } from './chat-panel.component';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ChatPanelComponent],
  template: `
    @if (open()) {
      <app-chat-panel (close)="open.set(false)" />
    }
    <button
      (click)="open.set(!open())"
      class="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-white shadow-lg hover:scale-105 transition-transform"
      [attr.aria-label]="open() ? 'Close assistant' : 'Open AI assistant'"
    >
      @if (open()) {
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      } @else {
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
      }
    </button>
  `,
})
export class ChatWidgetComponent {
  open = signal(false);
}