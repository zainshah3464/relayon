import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SeoService } from '../../core/seo/seo.service';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

type Tab = 'overview' | 'how-it-works' | 'setup' | 'workflows' | 'destinations' | 'faq';

interface TabDef {
  value: Tab;
  label: string;
  icon: IconName;
}

interface Feature {
  icon: IconName;
  color: 'violet' | 'cyan' | 'green' | 'amber';
  title: string;
  desc: string;
}

interface PipelineStep {
  icon: IconName;
  color: 'violet' | 'cyan' | 'green' | 'amber';
  title: string;
  desc: string;
}

interface Destination {
  icon: IconName;
  name: string;
  desc: string;
  setup: string;
}

interface Faq {
  q: string;
  a: string;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent, IconComponent],
  template: `
    <div class="min-h-screen bg-midnight text-foreground">
      <!-- ═══════════ HEADER ═══════════ -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-midnight/90 backdrop-blur-md">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <app-logo size="md" link="/" [showVersion]="true" />

          <nav class="flex items-center gap-2 text-sm">
            @if (auth.isAuthenticated()) {
              <a routerLink="/dashboard" class="btn-secondary text-xs">
                <app-icon name="layout-dashboard" [size]="12" [strokeWidth]="2" />
                <span>Dashboard</span>
              </a>
            } @else {
              <a routerLink="/login" class="btn-ghost text-xs">Sign in</a>
              <a routerLink="/signup" class="btn-primary text-xs">
                <span>Get started</span>
                <app-icon name="arrow-right" [size]="11" [strokeWidth]="2.5" />
              </a>
            }
          </nav>
        </div>
      </header>

      <!-- ═══════════ HERO ═══════════ -->
      <section class="relative overflow-hidden border-b border-hairline">
        <div class="absolute inset-0 bg-gradient-to-b from-relay-violet/[0.08] via-midnight to-midnight"></div>
        <div class="absolute -top-32 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-relay-violet/15 blur-[120px]"></div>

        <div class="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <div class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1">
            <span class="h-1.5 w-1.5 rounded-full bg-relay-cyan"></span>
            <span class="text-[11px] font-medium uppercase tracking-wider text-relay-cyan">Complete guide</span>
          </div>

          <h1 class="mt-5 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl lg:text-5xl">
            Everything you need to know about Relayon
          </h1>
          <p class="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            From what it is to your first working webhook — in 10 minutes.
            No docs to read. No tutorials to watch. Just this page.
          </p>

          <div class="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              (click)="tab.set('setup')"
              class="btn-primary"
            >
              <span>Get started in 5 minutes</span>
              <app-icon name="arrow-right" [size]="14" [strokeWidth]="2.5" />
            </button>
            <button
              type="button"
              (click)="tab.set('overview')"
              class="btn-secondary"
            >
              <span>Read overview</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ═══════════ TABS ═══════════ -->
      <div class="sticky top-[57px] z-20 border-b border-hairline bg-midnight/95 backdrop-blur-md">
        <div class="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <div class="flex min-w-max gap-1">
            @for (t of tabs; track t.value) {
              <button
                type="button"
                (click)="tab.set(t.value)"
                class="flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4"
                [class.border-relay-violet]="tab() === t.value"
                [class.text-foreground]="tab() === t.value"
                [class.border-transparent]="tab() !== t.value"
                [class.text-muted]="tab() !== t.value"
                [class.hover:text-foreground]="tab() !== t.value"
              >
                <app-icon [name]="t.icon" [size]="13" [strokeWidth]="2" />
                <span>{{ t.label }}</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- ═══════════ CONTENT ═══════════ -->
      <main class="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">

        <!-- ═══════════════════ OVERVIEW ═══════════════════ -->
        @if (tab() === 'overview') {
          <div class="space-y-8 animate-slide-up">
            <!-- Hero explanation -->
            <div class="relative overflow-hidden rounded-2xl border border-relay-violet/25 bg-gradient-to-br from-relay-violet/[0.08] via-surface to-relay-cyan/[0.06] p-6 sm:p-8">
              <div class="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-relay-violet/20 blur-3xl"></div>
              <div class="relative">
                <h2 class="text-2xl font-bold tracking-tight text-foreground">
                  What is Relayon?
                </h2>
                <p class="mt-3 text-base leading-relaxed text-foreground/90">
                  Relayon is the <strong class="text-foreground">smart post office for your webhooks</strong>.
                  When Stripe, GitHub, Shopify, or any service sends you a notification
                  (a "webhook"), Relayon receives it, optionally enriches it with AI,
                  transforms the data, and delivers it reliably to Slack, email,
                  databases, or your own APIs.
                </p>
                <p class="mt-3 text-sm text-muted">
                  Think of it as a Zapier or Make alternative — but serverless, source-available,
                  and built for developers who care about reliability.
                </p>
              </div>
            </div>

            <!-- Feature grid -->
            <div class="grid gap-3 sm:grid-cols-2">
              @for (f of features; track f.title) {
                <div class="card">
                  <div [ngClass]="featureIconClass(f.color)" class="inline-flex h-10 w-10 items-center justify-center rounded-lg">
                    <app-icon [name]="f.icon" [size]="18" [strokeWidth]="2" />
                  </div>
                  <h3 class="mt-3 text-base font-semibold text-foreground">{{ f.title }}</h3>
                  <p class="mt-1 text-sm leading-relaxed text-muted">{{ f.desc }}</p>
                </div>
              }
            </div>

            <!-- Who it's for -->
            <div class="card">
              <h3 class="text-base font-semibold text-foreground">Who is Relayon for?</h3>
              <ul class="mt-3 space-y-2.5">
                @for (w of audiences; track w.title) {
                  <li class="flex items-start gap-2.5">
                    <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
                      <app-icon [name]="w.icon" [size]="12" [strokeWidth]="2" />
                    </div>
                    <p class="text-sm leading-relaxed text-muted">
                      <strong class="text-foreground">{{ w.title }}</strong> — {{ w.desc }}
                    </p>
                  </li>
                }
              </ul>
            </div>

            <!-- CTA -->
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="tab.set('how-it-works')" class="btn-primary">
                <span>See how it works</span>
                <app-icon name="arrow-right" [size]="13" [strokeWidth]="2.5" />
              </button>
              <button type="button" (click)="tab.set('setup')" class="btn-secondary">
                Get started in 5 minutes
              </button>
            </div>
          </div>
        }

        <!-- ═══════════════════ HOW IT WORKS ═══════════════════ -->
        @if (tab() === 'how-it-works') {
          <div class="space-y-8 animate-slide-up">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-foreground">How Relayon works</h2>
              <p class="mt-2 text-muted">
                Every webhook passes through the same pipeline. You configure the pieces;
                Relayon handles the plumbing.
              </p>
            </div>

            <!-- Pipeline -->
            <div class="space-y-2">
              @for (step of pipeline; track step.title; let i = $index; let last = $last) {
                <div [ngClass]="pipelineCardClass(step.color)" class="rounded-xl border p-4">
                  <div class="flex items-start gap-3">
                    <div [ngClass]="pipelineIconClass(step.color)" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <app-icon [name]="step.icon" [size]="18" [strokeWidth]="2" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-baseline gap-2">
                        <span class="font-mono text-xs text-muted-2">{{ i + 1 }}.</span>
                        <p class="text-sm font-semibold text-foreground">{{ step.title }}</p>
                      </div>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted">{{ step.desc }}</p>
                    </div>
                  </div>
                </div>
                @if (!last) {
                  <div class="flex justify-center py-1">
                    <app-icon name="arrow-down" [size]="14" [strokeWidth]="2" class="text-muted-2" />
                  </div>
                }
              }
            </div>

            <!-- Reliability guarantees -->
            <div class="card">
              <h3 class="flex items-center gap-2 text-base font-semibold text-foreground">
                <app-icon name="shield" [size]="15" [strokeWidth]="2" class="text-signal-green" />
                Reliability guarantees
              </h3>
              <ul class="mt-3 space-y-2">
                @for (g of guarantees; track g) {
                  <li class="flex items-start gap-2 text-sm text-muted">
                    <app-icon name="check-circle" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-green" />
                    <span [innerHTML]="g"></span>
                  </li>
                }
              </ul>
            </div>
          </div>
        }

        <!-- ═══════════════════ SETUP ═══════════════════ -->
        @if (tab() === 'setup') {
          <div class="space-y-8 animate-slide-up">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-foreground">Get started in 5 minutes</h2>
              <p class="mt-2 text-muted">Follow these steps exactly. Everything is free — no credit card.</p>
            </div>

            <ol class="space-y-3">
              @for (step of setupSteps; track step.title; let i = $index) {
                <li class="card">
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
                      [ngClass]="step.final ? 'bg-signal-green' : 'bg-gradient-to-br from-relay-violet to-relay-cyan'"
                    >
                      @if (step.final) {
                        <app-icon name="check" [size]="16" [strokeWidth]="3" />
                      } @else {
                        {{ i + 1 }}
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="text-base font-semibold text-foreground">{{ step.title }}</h3>
                      <p class="mt-1.5 text-sm leading-relaxed text-muted">{{ step.desc }}</p>

                      @if (step.tip) {
                        <div class="mt-2 flex items-start gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
                          <app-icon name="sparkles" [size]="11" [strokeWidth]="2" class="mt-0.5 shrink-0 text-relay-cyan" />
                          <span>{{ step.tip }}</span>
                        </div>
                      }

                      @if (step.showSignupCta) {
                        <div class="mt-3">
                          @if (!auth.isAuthenticated()) {
                            <a routerLink="/signup" class="btn-primary text-xs">
                              <span>Create free account</span>
                              <app-icon name="arrow-right" [size]="11" [strokeWidth]="2.5" />
                            </a>
                          } @else {
                            <span class="badge badge-success">
                              <app-icon name="check" [size]="9" [strokeWidth]="3" />
                              You're signed in
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </li>
              }
            </ol>

            <!-- CLI section -->
            <div class="card border-relay-cyan/30 bg-relay-cyan/[0.04]">
              <div class="flex items-start gap-3">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-relay-cyan/15 text-relay-cyan">
                  <app-icon name="terminal" [size]="16" [strokeWidth]="2" />
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-base font-semibold text-foreground">Want to test locally first?</h3>
                  <p class="mt-1 text-sm text-muted">
                    Use our CLI to forward production webhooks to your laptop:
                  </p>
                  <pre class="mt-2 overflow-x-auto rounded-md bg-midnight p-3 font-mono text-xs text-relay-cyan">npx &#64;relayon/cli listen --port 3000 --api-key rlk_live_...</pre>
                  <p class="mt-2 text-xs text-muted">
                    Get your API key from <strong class="text-foreground">Settings → API Keys</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ═══════════════════ WORKFLOWS ═══════════════════ -->
        @if (tab() === 'workflows') {
          <div class="space-y-8 animate-slide-up">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-foreground">Creating workflows</h2>
              <p class="mt-2 text-muted">A workflow = source + optional transform + destinations. That's it.</p>
            </div>

            <!-- Anatomy -->
            <div class="card">
              <h3 class="text-base font-semibold text-foreground">Anatomy of a workflow</h3>
              <div class="mt-4 space-y-4">
                @for (part of anatomy; track part.title) {
                  <div class="border-s-2 ps-4" [ngClass]="'border-' + part.color">
                    <div class="flex items-center gap-1.5">
                      <app-icon [name]="part.icon" [size]="13" [strokeWidth]="2" [ngClass]="'text-' + part.color" />
                      <p class="text-sm font-semibold text-foreground">{{ part.title }}</p>
                    </div>
                    <p class="mt-1 text-xs leading-relaxed text-muted">{{ part.desc }}</p>
                    <p class="mt-1 text-xs text-muted-2">{{ part.hint }}</p>
                  </div>
                }
              </div>
            </div>

            <!-- Examples -->
            <div class="card">
              <h3 class="text-base font-semibold text-foreground">Common workflow examples</h3>
              <div class="mt-3 space-y-2">
                @for (ex of examples; track ex.title) {
                  <div class="rounded-md border border-hairline bg-surface-2/50 p-3">
                    <p class="text-sm font-medium text-foreground">{{ ex.title }}</p>
                    <p class="mt-1 text-xs text-muted">{{ ex.desc }}</p>
                  </div>
                }
              </div>
            </div>

            <!-- Mistakes -->
            <div class="card border-signal-amber/30 bg-signal-amber/[0.04]">
              <h3 class="flex items-center gap-2 text-base font-semibold text-foreground">
                <app-icon name="alert-triangle" [size]="15" [strokeWidth]="2" class="text-signal-amber" />
                Common mistakes to avoid
              </h3>
              <ul class="mt-3 space-y-2">
                @for (m of mistakes; track m.title) {
                  <li class="flex items-start gap-2 text-sm">
                    <app-icon name="x-circle" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-rose" />
                    <span class="text-muted">
                      <strong class="text-foreground">{{ m.title }}</strong> — {{ m.desc }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          </div>
        }

        <!-- ═══════════════════ DESTINATIONS ═══════════════════ -->
        @if (tab() === 'destinations') {
          <div class="space-y-8 animate-slide-up">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-foreground">Destinations</h2>
              <p class="mt-2 text-muted">Where Relayon sends your events. Pick one or many.</p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              @for (d of destinations; track d.name) {
                <div class="card">
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <app-icon [name]="d.icon" [size]="16" [strokeWidth]="2" />
                    </div>
                    <h3 class="text-sm font-semibold text-foreground">{{ d.name }}</h3>
                  </div>
                  <p class="mt-2 text-xs leading-relaxed text-muted">{{ d.desc }}</p>
                  <p class="mt-2 flex items-start gap-1 text-[11px] text-relay-cyan">
                    <app-icon name="info" [size]="10" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                    <span>{{ d.setup }}</span>
                  </p>
                </div>
              }
            </div>

            <!-- Security -->
            <div class="card border-signal-green/25 bg-signal-green/[0.03]">
              <h3 class="flex items-center gap-2 text-base font-semibold text-foreground">
                <app-icon name="shield" [size]="15" [strokeWidth]="2" class="text-signal-green" />
                Security
              </h3>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                All destination credentials are <strong class="text-foreground">encrypted at rest</strong> with AES-256-GCM.
                Once saved, you only see masked values (••••••••). To change a secret,
                re-enter it — the old value is never shown again.
              </p>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                Every outbound webhook is signed with Standard Webhooks headers.
                Your destination can verify authenticity with the shared secret.
              </p>
            </div>
          </div>
        }

        <!-- ═══════════════════ FAQ ═══════════════════ -->
        @if (tab() === 'faq') {
          <div class="space-y-4 animate-slide-up">
            <h2 class="text-2xl font-bold tracking-tight text-foreground">Frequently asked questions</h2>

            <div class="space-y-2">
              @for (faq of faqs; track faq.q) {
                <details class="card group cursor-pointer p-0 transition-colors hover:border-hairline-strong">
                  <summary class="flex items-center justify-between gap-3 p-4 list-none [&::-webkit-details-marker]:hidden">
                    <span class="text-sm font-semibold text-foreground">{{ faq.q }}</span>
                    <app-icon
                      name="chevron-down"
                      [size]="14"
                      [strokeWidth]="2.5"
                      class="shrink-0 text-muted-2 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div class="border-t border-hairline px-4 py-3 text-sm leading-relaxed text-muted" [innerHTML]="faq.a"></div>
                </details>
              }
            </div>
          </div>
        }
      </main>

      <!-- ═══════════ FOOTER ═══════════ -->
      <footer class="border-t border-hairline bg-surface/50">
        <div class="mx-auto max-w-4xl px-4 py-8 text-center sm:px-6">
          <p class="text-sm text-muted">
            Can't find what you need?
            <a href="mailto:hello@relayon.dev" class="inline-flex items-center gap-1 text-relay-cyan hover:underline">
              <app-icon name="mail" [size]="11" [strokeWidth]="2" />
              hello&#64;relayon.dev
            </a>
          </p>
          <div class="mt-3 flex justify-center gap-4 text-xs">
            <a routerLink="/privacy" class="text-muted transition-colors hover:text-foreground">Privacy</a>
            <a routerLink="/terms" class="text-muted transition-colors hover:text-foreground">Terms</a>
            <a routerLink="/about" class="text-muted transition-colors hover:text-foreground">About</a>
            <a routerLink="/" class="text-muted transition-colors hover:text-foreground">Home</a>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class GuideComponent {
  readonly auth = inject(AuthService);
  readonly tab = signal<Tab>('overview');

  readonly tabs: TabDef[] = [
    { value: 'overview', label: 'Overview', icon: 'info' },
    { value: 'how-it-works', label: 'How it works', icon: 'workflow' },
    { value: 'setup', label: 'Setup', icon: 'rocket' },
    { value: 'workflows', label: 'Workflows', icon: 'workflow' },
    { value: 'destinations', label: 'Destinations', icon: 'send' },
    { value: 'faq', label: 'FAQ', icon: 'help' },
  ];

  readonly features: Feature[] = [
    { icon: 'inbox', color: 'violet', title: 'Receives webhooks', desc: 'From Stripe, GitHub, Shopify, Slack, or any service that sends webhooks via HTTPS.' },
    { icon: 'brain', color: 'cyan', title: 'Enriches with AI', desc: 'Optional: AI summarizes, classifies, extracts entities, translates. Powered by Groq (fast + free).' },
    { icon: 'edit', color: 'amber', title: 'Transforms data', desc: 'Reshape payloads with JSONata expressions — no code, just expressions.' },
    { icon: 'send', color: 'green', title: 'Delivers reliably', desc: 'At-least-once delivery with retries, exponential backoff, and a dead-letter queue for failures.' },
  ];

  readonly audiences = [
    { icon: 'code', title: 'Developers', desc: 'test webhooks locally with our CLI, debug production issues with full event history' },
    { icon: 'rocket', title: 'Startups', desc: 'connect Stripe to Slack, Shopify to Sheets, without writing integration code' },
    { icon: 'layers', title: 'Internal tools teams', desc: 'replace "yet another integration service" with one reliable platform' },
    { icon: 'shield', title: 'Enterprises', desc: 'self-host with Docker, own your data, stay compliant' },
  ];

  readonly pipeline: PipelineStep[] = [
    { icon: 'send', color: 'violet', title: 'Source sends webhook', desc: 'Stripe says "payment succeeded". It POSTs to your unique Relayon URL.' },
    { icon: 'lock', color: 'cyan', title: 'Signature verified', desc: 'Relayon verifies the HMAC signature. Fake webhooks are rejected immediately.' },
    { icon: 'brain', color: 'cyan', title: 'AI enrichment (optional)', desc: 'Groq summarizes: "Customer paid $500 for 3 items. Delivery to Karachi."' },
    { icon: 'edit', color: 'green', title: 'Transform (optional)', desc: 'Reshape for your destination with JSONata — e.g. flatten Stripe\'s nested response.' },
    { icon: 'filter', color: 'amber', title: 'Routes to destinations', desc: 'Send to Slack, Sheets, your API, or all three in parallel — each with independent retries.' },
    { icon: 'activity', color: 'green', title: 'Full audit trail', desc: 'Every event, every attempt, every response — searchable in your dashboard.' },
  ];

  readonly guarantees = [
    '<strong class="text-foreground">At-least-once delivery</strong> — your webhook will be delivered or end up in the Dead Letter Queue',
    '<strong class="text-foreground">Automatic retries</strong> — 10s, 30s, 1m, 5m, 15m exponential backoff',
    '<strong class="text-foreground">Circuit breaker</strong> — unhealthy destinations are paused automatically',
    '<strong class="text-foreground">Replay anytime</strong> — any failed event can be re-delivered with one click',
    '<strong class="text-foreground">Zero data loss</strong> — Redis queue + MongoDB persistence + transactional outbox',
  ];

  readonly setupSteps = [
    {
      title: 'Create your account',
      desc: 'Sign up with email, Google, or GitHub. Verify your email. Choose a workspace name (e.g. "Acme Corp" or "My Tools").',
      tip: '',
      showSignupCta: true,
      final: false,
    },
    {
      title: 'Create your first workflow',
      desc: 'Go to Workflows → New workflow. Pick your source (e.g. Stripe), paste the signing secret (found in Stripe Dashboard → Webhooks), give it a name.',
      tip: 'Not sure what to name it? Try "Stripe → Slack alerts"',
      showSignupCta: false,
      final: false,
    },
    {
      title: 'Copy the webhook URL',
      desc: 'On the workflow page, click "Copy webhook URL". Paste this URL into your source platform (Stripe → Webhooks → Add endpoint).',
      tip: 'URL format: https://relayon-ingress.vercel.app/webhook/<tenantId>/<workflowId>',
      showSignupCta: false,
      final: false,
    },
    {
      title: 'Add a destination',
      desc: 'Back on the workflow page, click "Add destination". Pick Slack, Discord, Email, HTTP, Google Sheets, or any supported type. Test the connection — Relayon validates before saving.',
      tip: '',
      showSignupCta: false,
      final: false,
    },
    {
      title: 'You\'re done!',
      desc: 'The next webhook Stripe sends will flow through Relayon automatically. Test it: trigger a test event in Stripe → watch it appear in Events.',
      tip: '',
      showSignupCta: false,
      final: true,
    },
  ];

  readonly anatomy = [
    { icon: 'inbox', color: 'relay-violet', title: 'Source', desc: 'Where webhooks come from — Stripe, GitHub, Shopify, Slack, or generic HMAC.', hint: 'Required: signing secret from the source platform.' },
    { icon: 'brain', color: 'relay-cyan', title: 'AI Enrichment (optional)', desc: 'Groq analyzes the payload. Choose summarize, classify, extract, or write custom instructions.', hint: 'Toggle in settings. Adds ~500ms latency, uses your AI token quota.' },
    { icon: 'edit', color: 'signal-amber', title: 'Transform (optional)', desc: 'JSONata expression to reshape the payload. Example: divide amount by 100 for cents → dollars.', hint: 'Test expressions with the "Test with sample payload" button.' },
    { icon: 'send', color: 'signal-green', title: 'Destinations', desc: 'Where to send. Multiple allowed — each gets its own retry budget.', hint: 'HTTP, Slack, Discord, Email, Sheets, Airtable, Notion, PostgreSQL, MongoDB.' },
  ];

  readonly examples = [
    { title: 'Stripe payment → Slack channel', desc: 'Source: Stripe. Enrichment: ON (summary). Destination: Slack #sales.' },
    { title: 'GitHub PR → Google Sheets', desc: 'Source: GitHub. Transform: extract PR number, author. Destination: Sheets.' },
    { title: 'Shopify order → Email + Database', desc: 'Source: Shopify. Destinations: Email to fulfillment team + PostgreSQL insert.' },
  ];

  readonly mistakes = [
    { title: 'Wrong secret', desc: 'Copy the signing secret, not the API key. Stripe has both.' },
    { title: 'Untested destination', desc: 'Always use "Test connection" before saving — it catches typos.' },
    { title: 'Missing transform', desc: 'If your destination expects a specific shape, transform first.' },
    { title: 'Over-enriching', desc: 'AI adds latency + quota. Only enable when you need it.' },
  ];

  readonly destinations: Destination[] = [
    { icon: 'message-square', name: 'Slack', desc: 'Send to a Slack channel via incoming webhook', setup: 'Needs: Slack webhook URL' },
    { icon: 'message-circle', name: 'Discord', desc: 'Send to a Discord channel', setup: 'Needs: Discord webhook URL' },
    { icon: 'mail', name: 'Email', desc: 'Send via Resend', setup: 'Needs: Resend API key, to/from' },
    { icon: 'globe', name: 'HTTP', desc: 'POST/PUT to any URL', setup: 'Needs: URL, optional headers' },
    { icon: 'table', name: 'Google Sheets', desc: 'Append rows', setup: 'Needs: service account + sheet shared' },
    { icon: 'table', name: 'Airtable', desc: 'Create records', setup: 'Needs: PAT + base + table' },
    { icon: 'file-text', name: 'Notion', desc: 'Create pages', setup: 'Needs: integration token + data source' },
    { icon: 'database', name: 'PostgreSQL', desc: 'INSERT into a table', setup: 'Needs: connection string + table' },
    { icon: 'database', name: 'MongoDB', desc: 'INSERT documents', setup: 'Needs: connection string + collection' },
  ];

  readonly faqs: Faq[] = [
    { q: 'Is Relayon really free?', a: '<p>Yes. The free tier includes 10,000 events/month and 100,000 AI tokens/month. No credit card required. If you need more, paid plans start at $9/month. You can also self-host Relayon for free on your own server.</p>' },
    { q: 'What happens if my destination is down?', a: '<p>Relayon retries with exponential backoff: 10s → 30s → 1m → 5m → 15m (5 total attempts). After 5 failures, the event moves to the <strong>Dead Letter Queue (DLQ)</strong>, where you can inspect it, fix the destination, and replay manually. No events are ever lost.</p>' },
    { q: 'How is this different from Zapier?', a: '<p>Zapier is general-purpose. Relayon is built for webhooks specifically — 10x cheaper, 10x faster, with full event visibility, JSONata transforms, and code-first CLI. Zapier starts at $20/month. Relayon starts at $0.</p>' },
    { q: 'Can I self-host?', a: '<p>Yes. One command: <code>docker compose up -d</code>. Full stack runs in 2 minutes on any server. Perfect for enterprises that require data sovereignty. See our <a href="https://github.com/zainshah3464/relayon/tree/main/docker" target="_blank" rel="noopener">Docker guide</a>.</p>' },
    { q: 'Does Relayon store my webhook data?', a: '<p>Yes, but only for a limited time: 30 days on free tier, 90 days on paid. After that, events are auto-deleted. You can also delete any event manually anytime. See our <a href="/privacy">Privacy Policy</a>.</p>' },
    { q: 'How do I verify Relayon\'s webhook signature?', a: '<p>Every webhook sent from Relayon includes Standard Webhooks headers: <code>webhook-id</code>, <code>webhook-timestamp</code>, <code>webhook-signature</code>. Use the <a href="https://www.npmjs.com/package/standardwebhooks" target="_blank" rel="noopener">standardwebhooks</a> npm package to verify — same format as Stripe.</p>' },
    { q: 'Can I use this for production traffic?', a: '<p>Absolutely. Relayon is production-ready: Standard Webhooks compliance, transactional outbox, at-least-once delivery, encryption at rest, and row-level tenant isolation. Used by SaaS companies, internal tools teams, and agencies.</p>' },
    { q: 'What sources does Relayon support?', a: '<p>Stripe, GitHub, Shopify, Slack, and any generic HMAC-signed source. Need another? Email us at hello@relayon.dev or check the Community Marketplace for community-built adapters.</p>' },
    { q: 'What if I hit my quota?', a: '<p>In <strong>hard mode</strong>, new requests return HTTP 429 until your next billing period. In <strong>soft mode</strong>, you can exceed up to 2x your limit (useful for one-off spikes). Owners can toggle modes in Settings → Quota.</p>' },
    { q: 'How do I contact support?', a: '<p>📧 <a href="mailto:hello@relayon.dev">hello@relayon.dev</a> — free tier: 48h response, paid: 24h response. Or check the Community → Discussions for common questions.</p>' },
  ];

  constructor() {
    inject(SeoService).set({
      title: 'Complete Guide — Setup, Workflows, Destinations',
      description:
        'Learn how Relayon works: create workflows, connect sources (Stripe, GitHub, Shopify), configure destinations (Slack, email, databases). Step-by-step guide with examples.',
      path: '/guide',
      keywords: [
        'relayon guide',
        'webhook tutorial',
        'how to setup webhooks',
        'webhook relay tutorial',
      ],
    });
  }

  featureIconClass(color: Feature['color']): string {
    switch (color) {
      case 'violet':
        return 'bg-relay-violet/10 text-relay-violet';
      case 'cyan':
        return 'bg-relay-cyan/10 text-relay-cyan';
      case 'green':
        return 'bg-signal-green/10 text-signal-green';
      case 'amber':
        return 'bg-signal-amber/10 text-signal-amber';
    }
  }

  pipelineIconClass(color: PipelineStep['color']): string {
    switch (color) {
      case 'violet':
        return 'bg-relay-violet/15 text-relay-violet';
      case 'cyan':
        return 'bg-relay-cyan/15 text-relay-cyan';
      case 'green':
        return 'bg-signal-green/15 text-signal-green';
      case 'amber':
        return 'bg-signal-amber/15 text-signal-amber';
    }
  }

  pipelineCardClass(color: PipelineStep['color']): string {
    switch (color) {
      case 'violet':
        return 'border-relay-violet/25 bg-relay-violet/[0.04]';
      case 'cyan':
        return 'border-relay-cyan/25 bg-relay-cyan/[0.04]';
      case 'green':
        return 'border-signal-green/25 bg-signal-green/[0.04]';
      case 'amber':
        return 'border-signal-amber/25 bg-signal-amber/[0.04]';
    }
  }
}