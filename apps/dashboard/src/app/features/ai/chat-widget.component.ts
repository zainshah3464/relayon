import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatPanelComponent } from './chat-panel.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, ChatPanelComponent, IconComponent],
  template: `
    @if (open()) {
      <app-chat-panel (close)="open.set(false)" />
    }

    <button
      type="button"
      (click)="open.set(!open())"
      class="fixed bottom-6 end-6 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-glow-violet active:scale-95 pb-safe"
      [attr.aria-label]="open() ? 'Close AI assistant' : 'Open AI assistant'"
      [attr.aria-expanded]="open()"
    >
      @if (open()) {
        <app-icon name="x" [size]="20" [strokeWidth]="2.25" />
      } @else {
        <app-icon name="bot" [size]="22" [strokeWidth]="1.75" />
      }
    </button>
  `,
})
export class ChatWidgetComponent {
  readonly open = signal(false);
}