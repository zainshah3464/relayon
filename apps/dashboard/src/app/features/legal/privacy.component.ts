import { Component, inject } from '@angular/core';
import { LegalLayoutComponent, type LegalSection } from './legal-layout.component';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [LegalLayoutComponent],
  template: `
    <app-legal-layout
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="November 17, 2026"
      [sections]="sections"
    />
  `,
})
export class PrivacyComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Privacy Policy',
      description:
        'How Relayon collects, uses, and protects your data. GDPR and DPDP compliant. Zero tracking cookies, hashed IPs, encrypted secrets.',
      path: '/privacy',
      noindex: false,
    });
  }

  readonly sections: LegalSection[] = [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `
        <p>
          Relayon ("we", "us", "our") is committed to protecting your privacy. This policy explains
          what information we collect, how we use it, and the rights you have over your data.
        </p>
        <p>
          Relayon is a webhook relay platform. When you connect a source (Stripe, GitHub, Shopify)
          to a destination (Slack, Google Sheets, your own API), we act as a <strong>data processor</strong>
          for the webhook payloads that flow through our system, and as a <strong>data controller</strong>
          for your account information.
        </p>
        <p>
          <strong>Plain English summary:</strong> We store only what's necessary to run the service.
          We don't sell your data. We don't track you across the web. We don't have tracking cookies.
        </p>
      `,
    },
    {
      id: 'what-we-collect',
      title: '2. What we collect',
      content: `
        <h3>Account information</h3>
        <ul>
          <li><strong>Name and email</strong> — used to identify you and send account emails</li>
          <li><strong>Password hash</strong> — bcrypt-hashed, we never see your plaintext password</li>
          <li><strong>OAuth identifiers</strong> — if you sign in with Google or GitHub, we store the provider's user ID</li>
          <li><strong>Workspace name</strong> — the tenant you belong to</li>
        </ul>

        <h3>Webhook data</h3>
        <ul>
          <li><strong>Payload contents</strong> — the raw JSON bodies sent by your sources (Stripe, GitHub, etc.)</li>
          <li><strong>Headers</strong> — for signature verification and debugging (Authorization and Cookie headers are stripped before storage)</li>
          <li><strong>IP address (hashed)</strong> — SHA-256 hashed with a daily-rotating salt, cannot be reversed</li>
          <li><strong>Timestamps</strong> — when each event was received and delivered</li>
          <li><strong>Delivery status</strong> — whether the destination responded successfully</li>
        </ul>

        <h3>Usage data</h3>
        <ul>
          <li><strong>Page views</strong> — which pages of the dashboard you visit (aggregated, no individual tracking)</li>
          <li><strong>Browser and OS type</strong> — for support and compatibility, never the full user agent</li>
          <li><strong>Session identifiers</strong> — random UUIDs in sessionStorage, expire when you close the tab</li>
        </ul>

        <h3>What we do NOT collect</h3>
        <ul>
          <li>Tracking cookies (we use zero third-party cookies)</li>
          <li>Your real IP address in logs (only hashed values)</li>
          <li>Web browsing history outside Relayon</li>
          <li>Payment card numbers (handled entirely by Stripe)</li>
          <li>Biometric data, location, or device fingerprints</li>
        </ul>
      `,
    },
    {
      id: 'how-we-use',
      title: '3. How we use your data',
      content: `
        <p>We process your data for the following purposes:</p>
        <ul>
          <li><strong>Operating the service</strong> — receiving your webhooks, enriching them, delivering to your destinations</li>
          <li><strong>Authentication</strong> — verifying you are who you say you are</li>
          <li><strong>Billing</strong> — tracking usage against your plan quota</li>
          <li><strong>Support</strong> — when you contact us for help, we access your account to diagnose issues</li>
          <li><strong>Security</strong> — detecting abuse, rate limiting, fraud prevention</li>
          <li><strong>AI enrichment</strong> — when you enable AI features, we send payload text to <strong>Groq</strong> (our AI provider). Groq does not train models on your data (see <a href="https://groq.com/privacy" target="_blank" rel="noopener">Groq's privacy policy</a>).</li>
        </ul>
        <p><strong>We never:</strong> sell your data, share it with advertisers, or use it to train machine learning models.</p>
      `,
    },
    {
      id: 'sub-processors',
      title: '4. Third-party sub-processors',
      content: `
        <p>To run Relayon, we use these sub-processors. Each is bound by contract to process data only as we instruct:</p>
        <ul>
          <li><strong>Vercel</strong> (hosting) — runs our API and dashboard</li>
          <li><strong>Neon / Supabase</strong> (PostgreSQL) — stores account, workflow, and configuration data</li>
          <li><strong>MongoDB Atlas</strong> (event storage) — stores webhook payloads and delivery logs</li>
          <li><strong>Upstash</strong> (Redis) — queues and short-lived caches</li>
          <li><strong>Groq</strong> (AI) — processes payloads when you enable AI enrichment</li>
          <li><strong>Stripe</strong> (billing) — handles subscription payments</li>
          <li><strong>Resend</strong> (email) — sends verification and password-reset emails</li>
        </ul>
        <p>For self-hosted deployments, none of these apply — your data stays entirely on your own server.</p>
      `,
    },
    {
      id: 'retention',
      title: '5. Data retention',
      content: `
        <ul>
          <li><strong>Account data</strong> — retained while your account is active, deleted within 30 days of account deletion</li>
          <li><strong>Webhook events</strong> — auto-deleted after <strong>30 days</strong> (free tier) or 90 days (paid)</li>
          <li><strong>Delivery logs</strong> — same as webhooks</li>
          <li><strong>Page view analytics</strong> — deleted after <strong>90 days</strong></li>
          <li><strong>Audit logs</strong> — retained for <strong>1 year</strong> (compliance)</li>
          <li><strong>Backups</strong> — encrypted database snapshots retained for 30 days</li>
        </ul>
      `,
    },
    {
      id: 'rights',
      title: '6. Your rights',
      content: `
        <p>Depending on your jurisdiction (GDPR, DPDP, CCPA), you have these rights:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of all data we have about you</li>
          <li><strong>Correction</strong> — fix inaccurate information</li>
          <li><strong>Deletion</strong> — delete your account and all associated data</li>
          <li><strong>Portability</strong> — export your data in machine-readable format (JSON or CSV)</li>
          <li><strong>Objection</strong> — object to specific processing activities</li>
          <li><strong>Withdraw consent</strong> — for any processing based on consent</li>
        </ul>
        <p>To exercise these rights, email <strong>hello@relayon.dev</strong> from your account email. We respond within 30 days.</p>
      `,
    },
    {
      id: 'security',
      title: '7. Security',
      content: `
        <ul>
          <li><strong>Encryption in transit</strong> — all traffic uses TLS 1.3</li>
          <li><strong>Encryption at rest</strong> — destination secrets (API keys, webhook secrets) use AES-256-GCM with per-tenant derived keys</li>
          <li><strong>Password hashing</strong> — bcrypt with cost factor 12</li>
          <li><strong>Row-level security</strong> — every database query is tenant-isolated at the Postgres policy level</li>
          <li><strong>No PII in logs</strong> — IPs are hashed, auth headers stripped</li>
          <li><strong>Regular backups</strong> — encrypted, geographically distributed</li>
        </ul>
        <p>We have not experienced any data breaches to date. In the event of one affecting your data, we will notify you within 72 hours.</p>
      `,
    },
    {
      id: 'cookies',
      title: '8. Cookies & tracking',
      content: `
        <p><strong>We use zero tracking cookies.</strong></p>
        <p>What we do use:</p>
        <ul>
          <li><strong>localStorage</strong> — your session token and language preference (functionally necessary)</li>
          <li><strong>sessionStorage</strong> — anonymous tracking IDs (cleared when you close the tab)</li>
        </ul>
        <p>We do not use Google Analytics, Facebook Pixel, or any third-party tracking. Our own analytics is cookieless and IP-anonymous.</p>
      `,
    },
    {
      id: 'children',
      title: '9. Children\'s privacy',
      content: `
        <p>Relayon is a B2B developer tool and is not intended for children under 13. We do not knowingly collect
        information from children. If you believe a child has created an account, contact us and we will delete it.</p>
      `,
    },
    {
      id: 'changes',
      title: '10. Changes to this policy',
      content: `
        <p>We may update this policy occasionally. Material changes will be notified by email and in-app
        notification at least 30 days before taking effect. Continued use of Relayon after changes means
        you accept the updated policy.</p>
      `,
    },
    {
      id: 'contact',
      title: '11. Contact',
      content: `
        <p>
          <strong>Relayon</strong><br />
          Zain Shah (Data Protection Officer)<br />
          Email: <a href="mailto:hello@relayon.dev">hello@relayon.dev</a><br />
          GitHub: <a href="https://github.com/zainshah3464" target="_blank" rel="noopener">github.com/zainshah3464</a>
        </p>
      `,
    },
  ];
}