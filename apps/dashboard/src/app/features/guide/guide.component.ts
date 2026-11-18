import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SeoService } from '../../core/seo/seo.service';

type Tab = 'overview' | 'how-it-works' | 'setup' | 'workflows' | 'destinations' | 'faq';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-midnight text-white">
      <!-- Header -->
      <header class="border-b border-hairline bg-surface">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a routerLink="/" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold">R</div>
            <span class="text-lg font-bold">Relayon</span>
          </a>
          <nav class="flex gap-4 text-sm">
            @if (auth.isAuthenticated()) {
              <a routerLink="/dashboard" class="text-relay-cyan hover:underline">Dashboard</a>
            } @else {
              <a routerLink="/login" class="text-muted hover:text-white">Sign in</a>
              <a routerLink="/signup" class="btn-primary text-xs">Get started free</a>
            }
          </nav>
        </div>
      </header>

      <!-- Hero -->
      <section class="border-b border-hairline bg-gradient-to-b from-surface to-midnight">
        <div class="mx-auto max-w-4xl px-6 py-12 text-center">
          <p class="text-xs uppercase tracking-widest text-relay-cyan">Complete Guide</p>
          <h1 class="text-4xl font-bold tracking-tight mt-3">
            Everything you need to know about Relayon
          </h1>
          <p class="text-lg text-muted mt-3 max-w-2xl mx-auto">
            From what it is to your first working webhook — in 10 minutes.
            No docs to read. No tutorials to watch. Just this page.
          </p>
        </div>
      </section>

      <!-- Tabs -->
      <div class="border-b border-hairline bg-surface sticky top-0 z-10">
        <div class="mx-auto max-w-6xl px-6 flex gap-1 overflow-x-auto">
          @for (t of tabs; track t.value) {
            <button
              (click)="tab.set(t.value)"
              class="px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition"
              [class.border-relay-violet]="tab() === t.value"
              [class.text-white]="tab() === t.value"
              [class.text-muted]="tab() !== t.value"
              [class.border-transparent]="tab() !== t.value"
            >{{ t.label }}</button>
          }
        </div>
      </div>

      <!-- Content -->
      <main class="mx-auto max-w-4xl px-6 py-10">

        <!-- ═════════ OVERVIEW ═════════ -->
        @if (tab() === 'overview') {
          <div class="space-y-8">
            <div class="card bg-gradient-to-br from-relay-violet/10 to-relay-cyan/10 border-relay-violet/30">
              <h2 class="text-2xl font-bold mb-3">What is Relayon?</h2>
              <p class="text-lg text-white/90 leading-relaxed">
                Relayon is the <strong>smart post office for your webhooks</strong>.
                When Stripe, GitHub, Shopify, or any service sends you a notification
                (a "webhook"), Relayon receives it, optionally enriches it with AI,
                transforms the data, and delivers it reliably to Slack, email,
                databases, or your own APIs.
              </p>
              <p class="text-white/70 mt-3">
                Think of it as a Zapier or Make alternative — but serverless, open-source,
                and built for developers who care about reliability.
              </p>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="card">
                <div class="text-3xl mb-2">📥</div>
                <h3 class="text-lg font-semibold mb-2">Receives webhooks</h3>
                <p class="text-sm text-muted">From Stripe, GitHub, Shopify, Slack, or any service that sends webhooks via HTTPS.</p>
              </div>
              <div class="card">
                <div class="text-3xl mb-2">🧠</div>
                <h3 class="text-lg font-semibold mb-2">Enriches with AI</h3>
                <p class="text-sm text-muted">Optional: AI summarizes, classifies, extracts entities, translates. Powered by Groq (fast + free).</p>
              </div>
              <div class="card">
                <div class="text-3xl mb-2">🔄</div>
                <h3 class="text-lg font-semibold mb-2">Transforms data</h3>
                <p class="text-sm text-muted">Reshape payloads with JSONata expressions — no code, just expressions.</p>
              </div>
              <div class="card">
                <div class="text-3xl mb-2">🚚</div>
                <h3 class="text-lg font-semibold mb-2">Delivers reliably</h3>
                <p class="text-sm text-muted">At-least-once delivery with retries, exponential backoff, and a dead-letter queue for failures.</p>
              </div>
            </div>

            <div class="card">
              <h3 class="text-lg font-semibold mb-3">Who is Relayon for?</h3>
              <ul class="space-y-2 text-sm text-muted">
                <li>👨‍💻 <strong class="text-white">Developers</strong> — test webhooks locally with our CLI, debug production issues with full event history</li>
                <li>🏢 <strong class="text-white">Startups</strong> — connect Stripe to Slack, Shopify to Sheets, without writing integration code</li>
                <li>🔧 <strong class="text-white">Internal tools teams</strong> — replace "Yet another integration service" with one reliable platform</li>
                <li>🏛️ <strong class="text-white">Enterprises</strong> — self-host with Docker, own your data, stay compliant</li>
              </ul>
            </div>

            <div class="flex gap-3">
              <button (click)="tab.set('how-it-works')" class="btn-primary">
                See how it works →
              </button>
              <button (click)="tab.set('setup')" class="btn-secondary">
                Get started in 5 minutes
              </button>
            </div>
          </div>
        }

        <!-- ═════════ HOW IT WORKS ═════════ -->
        @if (tab() === 'how-it-works') {
          <div class="space-y-8">
            <div>
              <h2 class="text-2xl font-bold mb-4">How Relayon works</h2>
              <p class="text-muted mb-6">
                Every webhook passes through the same pipeline. You configure the pieces;
                Relayon handles the plumbing.
              </p>
            </div>

            <!-- Visual flow -->
            <div class="card p-6 space-y-3">
              <div class="flex items-center gap-3 p-3 rounded-lg bg-relay-violet/10 border border-relay-violet/30">
                <div class="text-2xl">📤</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">1. Source sends webhook</p>
                  <p class="text-xs text-muted">Stripe says "payment succeeded". It POSTs to your unique Relayon URL.</p>
                </div>
              </div>
              <div class="text-center text-muted text-xs">↓</div>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-relay-cyan/10 border border-relay-cyan/30">
                <div class="text-2xl">🔐</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">2. Signature verified</p>
                  <p class="text-xs text-muted">Relayon verifies the HMAC signature. Fake webhooks are rejected immediately.</p>
                </div>
              </div>
              <div class="text-center text-muted text-xs">↓</div>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-relay-cyan/10 border border-relay-cyan/30">
                <div class="text-2xl">🧠</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">3. AI enrichment (optional)</p>
                  <p class="text-xs text-muted">Groq summarizes: "Customer paid $500 for 3 items. Delivery to Karachi."</p>
                </div>
              </div>
              <div class="text-center text-muted text-xs">↓</div>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-signal-green/10 border border-signal-green/30">
                <div class="text-2xl">🔄</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">4. Transform (optional)</p>
                  <p class="text-xs text-muted">Reshape for your destination with JSONata — e.g. flatten Stripe's nested response.</p>
                </div>
              </div>
              <div class="text-center text-muted text-xs">↓</div>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-signal-amber/10 border border-signal-amber/30">
                <div class="text-2xl">🎯</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">5. Routes to destinations</p>
                  <p class="text-xs text-muted">Send to Slack, Sheets, your API, or all three in parallel — each with independent retries.</p>
                </div>
              </div>
              <div class="text-center text-muted text-xs">↓</div>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-signal-green/10 border border-signal-green/30">
                <div class="text-2xl">📊</div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-white">6. Full audit trail</p>
                  <p class="text-xs text-muted">Every event, every attempt, every response — searchable in your dashboard.</p>
                </div>
              </div>
            </div>

            <div class="card">
              <h3 class="text-lg font-semibold mb-3">Reliability guarantees</h3>
              <ul class="space-y-2 text-sm">
                <li>✅ <strong class="text-white">At-least-once delivery</strong> — your webhook will be delivered or end up in the Dead Letter Queue</li>
                <li>✅ <strong class="text-white">Automatic retries</strong> — 10s, 30s, 1m, 5m, 15m exponential backoff</li>
                <li>✅ <strong class="text-white">Circuit breaker</strong> — unhealthy destinations are paused automatically</li>
                <li>✅ <strong class="text-white">Replay anytime</strong> — any failed event can be re-delivered with one click</li>
                <li>✅ <strong class="text-white">Zero data loss</strong> — Redis queue + MongoDB persistence + transactional outbox</li>
              </ul>
            </div>
          </div>
        }

        <!-- ═════════ SETUP ═════════ -->
        @if (tab() === 'setup') {
          <div class="space-y-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Get started in 5 minutes</h2>
              <p class="text-muted">Follow these steps exactly. Everything is free — no credit card.</p>
            </div>

            <div class="space-y-4">
              <div class="card border-relay-violet/30">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white font-bold">1</div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white mb-2">Create your account</h3>
                    <p class="text-sm text-muted mb-3">
                      Sign up with email, Google, or GitHub. Verify your email. Choose a workspace name
                      (e.g. "Acme Corp" or "My Tools").
                    </p>
                    @if (!auth.isAuthenticated()) {
                      <a routerLink="/signup" class="btn-primary text-xs">Create free account →</a>
                    } @else {
                      <span class="text-xs text-signal-green">✓ You're signed in</span>
                    }
                  </div>
                </div>
              </div>

              <div class="card border-relay-violet/30">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white font-bold">2</div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white mb-2">Create your first workflow</h3>
                    <p class="text-sm text-muted mb-3">
                      Go to <strong>Workflows → + New workflow</strong>. Pick your source (e.g. Stripe),
                      paste the signing secret (found in Stripe Dashboard → Webhooks), give it a name.
                    </p>
                    <p class="text-xs text-muted">
                      💡 Not sure what to name it? Try "Stripe → Slack alerts"
                    </p>
                  </div>
                </div>
              </div>

              <div class="card border-relay-violet/30">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white font-bold">3</div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white mb-2">Copy the webhook URL</h3>
                    <p class="text-sm text-muted mb-3">
                      On the workflow page, click <strong>"Copy webhook URL"</strong>. Paste this URL
                      into your source platform (Stripe → Webhooks → Add endpoint).
                    </p>
                    <p class="text-xs text-muted">
                      💡 The URL looks like: <code class="bg-midnight px-2 py-1 rounded">https://relayon-ingress.vercel.app/webhook/&lt;tenantId&gt;/&lt;workflowId&gt;</code>
                    </p>
                  </div>
                </div>
              </div>

              <div class="card border-relay-violet/30">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white font-bold">4</div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white mb-2">Add a destination</h3>
                    <p class="text-sm text-muted mb-3">
                      Back on the workflow page, click <strong>"+ Add destination"</strong>.
                      Pick Slack, Discord, Email, HTTP, Google Sheets, or any supported type.
                      Test the connection — Relayon validates before saving.
                    </p>
                  </div>
                </div>
              </div>

              <div class="card border-signal-green/30">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal-green text-white font-bold">✓</div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white mb-2">You're done!</h3>
                    <p class="text-sm text-muted mb-3">
                      The next webhook Stripe sends will flow through Relayon automatically.
                      Test it: trigger a test event in Stripe → watch it appear in <strong>Events</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="card bg-relay-cyan/5 border-relay-cyan/30">
              <h3 class="text-lg font-semibold mb-3">🧪 Want to test locally first?</h3>
              <p class="text-sm text-muted mb-3">
                Use our CLI to forward production webhooks to your laptop:
              </p>
              <pre class="bg-midnight p-3 rounded text-xs font-mono text-relay-cyan overflow-x-auto">npx &#64;relayon/cli listen --port 3000 --api-key rlk_live_...</pre>
              <p class="text-xs text-muted mt-2">
                Get your API key from <strong>Settings → API Keys</strong>.
              </p>
            </div>
          </div>
        }

        <!-- ═════════ WORKFLOWS ═════════ -->
        @if (tab() === 'workflows') {
          <div class="space-y-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Creating workflows</h2>
              <p class="text-muted">A workflow = source + optional transform + destinations. That's it.</p>
            </div>

            <div class="card">
              <h3 class="text-lg font-semibold mb-4">Anatomy of a workflow</h3>
              <div class="space-y-4">
                <div class="border-s-4 border-relay-violet ps-4">
                  <p class="text-sm font-semibold text-white">Source</p>
                  <p class="text-xs text-muted">Where webhooks come from — Stripe, GitHub, Shopify, Slack, or generic HMAC.</p>
                  <p class="text-xs text-muted mt-1">Required: signing secret from the source platform.</p>
                </div>
                <div class="border-s-4 border-relay-cyan ps-4">
                  <p class="text-sm font-semibold text-white">AI Enrichment (optional)</p>
                  <p class="text-xs text-muted">Groq analyzes the payload. Choose summarize, classify, extract, or write custom instructions.</p>
                  <p class="text-xs text-muted mt-1">Toggle in the workflow settings. Adds ~500ms latency, uses your AI token quota.</p>
                </div>
                <div class="border-s-4 border-signal-amber ps-4">
                  <p class="text-sm font-semibold text-white">Transform (optional)</p>
                  <p class="text-xs text-muted">JSONata expression to reshape the payload. Example: divide amount by 100 for cents → dollars.</p>
                  <p class="text-xs text-muted mt-1">Test expressions with the "Test with sample payload" button.</p>
                </div>
                <div class="border-s-4 border-signal-green ps-4">
                  <p class="text-sm font-semibold text-white">Destinations</p>
                  <p class="text-xs text-muted">Where to send. Multiple allowed — each gets its own retry budget.</p>
                  <p class="text-xs text-muted mt-1">HTTP, Slack, Discord, Email, Sheets, Airtable, Notion, PostgreSQL, MongoDB.</p>
                </div>
              </div>
            </div>

            <div class="card">
              <h3 class="text-lg font-semibold mb-3">Common workflow examples</h3>
              <div class="space-y-3">
                <div class="bg-surface-2 p-3 rounded">
                  <p class="text-sm font-semibold text-white">Stripe payment → Slack channel</p>
                  <p class="text-xs text-muted">Source: Stripe. Enrichment: ON (summary). Destination: Slack #sales.</p>
                </div>
                <div class="bg-surface-2 p-3 rounded">
                  <p class="text-sm font-semibold text-white">GitHub PR → Google Sheets</p>
                  <p class="text-xs text-muted">Source: GitHub. Transform: extract PR number, author. Destination: Sheets.</p>
                </div>
                <div class="bg-surface-2 p-3 rounded">
                  <p class="text-sm font-semibold text-white">Shopify order → Email + Database</p>
                  <p class="text-xs text-muted">Source: Shopify. Destinations: Email to fulfillment team + PostgreSQL insert.</p>
                </div>
              </div>
            </div>

            <div class="card bg-signal-amber/5 border-signal-amber/30">
              <h3 class="text-lg font-semibold mb-3">⚠️ Common mistakes to avoid</h3>
              <ul class="space-y-2 text-sm text-muted">
                <li>❌ <strong class="text-white">Wrong secret:</strong> Copy the signing secret, not the API key. Stripe has both.</li>
                <li>❌ <strong class="text-white">Untested destination:</strong> Always use "Test connection" before saving — it catches typos.</li>
                <li>❌ <strong class="text-white">Missing transform:</strong> If your destination expects a specific shape, transform first.</li>
                <li>❌ <strong class="text-white">Over-enriching:</strong> AI adds latency + quota. Only enable when you need it.</li>
              </ul>
            </div>
          </div>
        }

        <!-- ═════════ DESTINATIONS ═════════ -->
        @if (tab() === 'destinations') {
          <div class="space-y-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Destinations</h2>
              <p class="text-muted">Where Relayon sends your events. Pick one or many.</p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              @for (d of destinations; track d.name) {
                <div class="card">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">{{ d.icon }}</span>
                    <h3 class="text-sm font-semibold text-white">{{ d.name }}</h3>
                  </div>
                  <p class="text-xs text-muted">{{ d.description }}</p>
                  <p class="text-xs text-relay-cyan mt-2">{{ d.setup }}</p>
                </div>
              }
            </div>

            <div class="card">
              <h3 class="text-lg font-semibold mb-3">Security</h3>
              <p class="text-sm text-muted mb-2">
                All destination credentials are <strong>encrypted at rest</strong> with AES-256-GCM.
                Once saved, you only see masked values (••••••••). To change a secret,
                re-enter it — the old value is never shown again.
              </p>
              <p class="text-sm text-muted">
                Every outbound webhook is signed with Standard Webhooks headers.
                Your destination can verify authenticity with the shared secret.
              </p>
            </div>
          </div>
        }

        <!-- ═════════ FAQ ═════════ -->
        @if (tab() === 'faq') {
          <div class="space-y-4">
            <h2 class="text-2xl font-bold mb-6">Frequently asked questions</h2>

            @for (faq of faqs; track faq.q) {
              <details class="card cursor-pointer group">
                <summary class="flex justify-between items-center font-semibold text-white">
                  <span>{{ faq.q }}</span>
                  <span class="text-muted group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div class="mt-3 text-sm text-muted leading-relaxed" [innerHTML]="faq.a"></div>
              </details>
            }
          </div>
        }

      </main>

      <!-- Footer -->
      <footer class="border-t border-hairline mt-12">
        <div class="mx-auto max-w-4xl px-6 py-8 text-center text-sm text-muted">
          <p>Can't find what you need? 📧 <a href="mailto:hello@relayon.dev" class="text-relay-cyan hover:underline">hello&#64;relayon.dev</a></p>
          <div class="flex justify-center gap-4 mt-3">
            <a routerLink="/privacy" class="hover:text-white">Privacy</a>
            <a routerLink="/terms" class="hover:text-white">Terms</a>
            <a routerLink="/" class="hover:text-white">Home</a>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class GuideComponent {
  auth = inject(AuthService);
  tab = signal<Tab>('overview');

  // ⚠️ v3.3 — SEO metadata
  constructor() {
    inject(SeoService).set({
      title: 'Complete Guide — Setup, Workflows, Destinations',
      description: 'Learn how Relayon works: create workflows, connect sources (Stripe, GitHub, Shopify), configure destinations (Slack, email, databases). Step-by-step guide with examples.',
      path: '/guide',
      keywords: ['relayon guide', 'webhook tutorial', 'how to setup webhooks', 'webhook relay tutorial'],
    });
  }

  readonly tabs: Array<{ value: Tab; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'how-it-works', label: 'How it works' },
    { value: 'setup', label: 'Setup' },
    { value: 'workflows', label: 'Workflows' },
    { value: 'destinations', label: 'Destinations' },
    { value: 'faq', label: 'FAQ' },
  ];

  readonly destinations = [
    { icon: '💬', name: 'Slack', description: 'Send to a Slack channel via incoming webhook', setup: 'Needs: Slack webhook URL' },
    { icon: '🎮', name: 'Discord', description: 'Send to a Discord channel', setup: 'Needs: Discord webhook URL' },
    { icon: '📧', name: 'Email', description: 'Send via Resend', setup: 'Needs: Resend API key, to/from' },
    { icon: '🌐', name: 'HTTP', description: 'POST/PUT to any URL', setup: 'Needs: URL, optional headers' },
    { icon: '📊', name: 'Google Sheets', description: 'Append rows', setup: 'Needs: service account + sheet shared' },
    { icon: '📋', name: 'Airtable', description: 'Create records', setup: 'Needs: PAT + base + table' },
    { icon: '📓', name: 'Notion', description: 'Create pages', setup: 'Needs: integration token + data source' },
    { icon: '🐘', name: 'PostgreSQL', description: 'INSERT into a table', setup: 'Needs: connection string + table' },
    { icon: '🍃', name: 'MongoDB', description: 'INSERT documents', setup: 'Needs: connection string + collection' },
  ];

  readonly faqs = [
    {
      q: 'Is Relayon really free?',
      a: '<p>Yes. The free tier includes 10,000 events/month and 100,000 AI tokens/month. No credit card required. If you need more, paid plans start at $9/month. You can also self-host Relayon for free on your own server.</p>',
    },
    {
      q: 'What happens if my destination is down?',
      a: '<p>Relayon retries with exponential backoff: 10s → 30s → 1m → 5m → 15m (5 total attempts). After 5 failures, the event moves to the <strong>Dead Letter Queue (DLQ)</strong>, where you can inspect it, fix the destination, and replay manually. No events are ever lost.</p>',
    },
    {
      q: 'How is this different from Zapier?',
      a: '<p>Zapier is general-purpose. Relayon is built for webhooks specifically — 10x cheaper, 10x faster, with full event visibility, JSONata transforms, and code-first CLI. Zapier starts at $20/month. Relayon starts at $0.</p>',
    },
    {
      q: 'Can I self-host?',
      a: '<p>Yes. One command: <code>docker compose up -d</code>. Full stack runs in 2 minutes on any server. Perfect for enterprises that require data sovereignty. See our <a href="https://github.com/zainshah3464/relayon/tree/main/docker" target="_blank" rel="noopener">Docker guide</a>.</p>',
    },
    {
      q: 'Does Relayon store my webhook data?',
      a: '<p>Yes, but only for a limited time: 30 days on free tier, 90 days on paid. After that, events are auto-deleted. You can also delete any event manually anytime. See our <a href="/privacy">Privacy Policy</a>.</p>',
    },
    {
      q: 'How do I verify Relayon\'s webhook signature?',
      a: '<p>Every webhook sent from Relayon includes Standard Webhooks headers: <code>webhook-id</code>, <code>webhook-timestamp</code>, <code>webhook-signature</code>. Use the <a href="https://www.npmjs.com/package/standardwebhooks" target="_blank" rel="noopener">standardwebhooks</a> npm package to verify — same format as Stripe.</p>',
    },
    {
      q: 'Can I use this for production traffic?',
      a: '<p>Absolutely. Relayon is production-ready: Standard Webhooks compliance, transactional outbox, at-least-once delivery, encryption at rest, and row-level tenant isolation. Used by SaaS companies, internal tools teams, and agencies.</p>',
    },
    {
      q: 'What sources does Relayon support?',
      a: '<p>Stripe, GitHub, Shopify, Slack, and any generic HMAC-signed source. Need another? Email us at hello@relayon.dev or check the Community Marketplace for community-built adapters.</p>',
    },
    {
      q: 'What if I hit my quota?',
      a: '<p>In <strong>hard mode</strong>, new requests return HTTP 429 until your next billing period. In <strong>soft mode</strong>, you can exceed up to 2x your limit (useful for one-off spikes). Owners can toggle modes in Settings → Quota.</p>',
    },
    {
      q: 'How do I contact support?',
      a: '<p>📧 <a href="mailto:hello@relayon.dev">hello@relayon.dev</a> — free tier: 48h response, paid: 24h response. Or check the Community → Discussions for common questions.</p>',
    },
  ];
}