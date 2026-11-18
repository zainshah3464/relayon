import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './core/seo/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Relayon — Reliable Webhook Infrastructure for the Serverless Era',
      description:
        'Receive, enrich with AI, and route webhooks reliably. At-least-once delivery, dead-letter queue, multi-destination fan-out. Free tier, open source, self-hostable.',
      path: '/',
      keywords: [
        'webhook relay',
        'webhook infrastructure',
        'webhook management platform',
        'iPaaS',
        'serverless webhooks',
        'free webhook service',
      ],
    });
  }
}