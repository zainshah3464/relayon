import { Component, inject } from '@angular/core';
import { LegalLayoutComponent, type LegalSection } from './legal-layout.component';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [LegalLayoutComponent],
  template: `
    <app-legal-layout
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated="November 20, 2026"
      [sections]="sections"
    />
  `,
})
export class TermsComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Terms of Service & License',
      description:
        'Relayon terms of service and Relayon Proprietary Source-Visible License v1.0 — acceptable use, payment, liability, and source code licensing for our webhook relay platform.',
      path: '/terms',
      noindex: false,
    });
  }

  readonly sections: LegalSection[] = [
    {
      id: 'acceptance',
      title: '1. Acceptance of terms',
      content: `
        <p>
          By creating an account or using Relayon, you agree to these Terms of Service. If you're using
          Relayon on behalf of a company, you confirm you have authority to bind that company to these terms.
        </p>
        <p>If you do not agree to these terms, do not use the service.</p>
      `,
    },
    {
      id: 'service',
      title: '2. Description of service',
      content: `
        <p>Relayon is a webhook relay platform that:</p>
        <ul>
          <li>Receives webhooks from sources you configure (Stripe, GitHub, Shopify, etc.)</li>
          <li>Optionally enriches payloads with AI (Groq)</li>
          <li>Transforms payloads using JSONata expressions</li>
          <li>Delivers to destinations (Slack, Discord, Email, HTTP, databases) with retry logic</li>
        </ul>
        <p>The service is provided "as is" and "as available". We aim for 99.9% uptime but do not guarantee it.</p>
      `,
    },
    {
      id: 'accounts',
      title: '3. Accounts',
      content: `
        <h3>Eligibility</h3>
        <p>You must be at least 13 years old and capable of forming a binding contract.</p>

        <h3>Account security</h3>
        <p>You are responsible for:</p>
        <ul>
          <li>Keeping your password and API keys confidential</li>
          <li>All activity under your account</li>
          <li>Notifying us immediately of unauthorized access</li>
        </ul>

        <h3>One account per workspace</h3>
        <p>You may create multiple workspaces but may not create accounts to evade limits, bans, or billing.</p>
      `,
    },
    {
      id: 'acceptable-use',
      title: '4. Acceptable use',
      content: `
        <p><strong>You may use Relayon to:</strong></p>
        <ul>
          <li>Relay webhooks from services you have legitimate access to</li>
          <li>Automate workflows for your own business or your clients' businesses</li>
          <li>Build integrations and internal tools</li>
        </ul>

        <p><strong>You may not use Relayon to:</strong></p>
        <ul>
          <li>Process illegal content (CSAM, illegal drugs, weapons, trafficking)</li>
          <li>Send spam, phishing, or unsolicited bulk communications</li>
          <li>Attack, DDoS, or probe third-party systems</li>
          <li>Circumvent rate limits or abuse the free tier via multiple accounts</li>
          <li>Resell Relayon as a white-label product without written permission</li>
          <li>Reverse-engineer closed-source components, or bypass security features</li>
          <li>Process data you don't have rights to (e.g., scraped PII without consent)</li>
          <li>Violate any applicable law (GDPR, DPDP, CCPA, HIPAA if applicable)</li>
        </ul>

        <p>Violation may result in immediate account termination without refund.</p>
      `,
    },
    {
      id: 'user-content',
      title: '5. User content',
      content: `
        <p>
          You retain all rights to the data you process through Relayon — your workflows, your webhooks,
          your configurations. We claim no ownership over your content.
        </p>
        <p>By using Relayon, you grant us a limited license to:</p>
        <ul>
          <li>Store and process your data to operate the service</li>
          <li>Send data to sub-processors (Groq, Stripe) as described in our Privacy Policy</li>
          <li>Create backups of your data for disaster recovery</li>
        </ul>
        <p>This license terminates when you delete your account.</p>
      `,
    },
    {
      id: 'community',
      title: '6. Community content',
      content: `
        <p>
          If you share workflows, templates, or posts in Relayon's community, you grant other users a
          perpetual, worldwide, royalty-free license to use, modify, and redistribute that content under
          the MIT license.
        </p>
        <p>You warrant that:</p>
        <ul>
          <li>You own or have rights to any content you share</li>
          <li>Shared workflows contain no hardcoded secrets (we automatically redact placeholders)</li>
          <li>Content doesn't violate third-party rights</li>
        </ul>
        <p>We may moderate, hide, or remove community content that violates these terms.</p>
      `,
    },
    {
      id: 'payment',
      title: '7. Plans & payment',
      content: `
        <h3>Free tier</h3>
        <p>The free tier is genuinely free — no credit card required. Limits:</p>
        <ul>
          <li>10,000 events per month</li>
          <li>100,000 AI tokens per month</li>
          <li>Unlimited workflows and destinations</li>
        </ul>
        <p>Exceeding limits causes requests to return HTTP 429 until the next billing period.</p>

        <h3>Paid plans</h3>
        <p>Paid subscriptions are billed via Stripe. Prices are in USD.</p>
        <ul>
          <li><strong>Monthly subscriptions</strong> — renew automatically until cancelled</li>
          <li><strong>30-day money-back guarantee</strong> — no questions asked on first subscription</li>
          <li><strong>Usage overage</strong> — billed at tier rates if you exceed plan limits</li>
        </ul>

        <h3>Refunds</h3>
        <p>After the first 30 days, refunds are provided only for extended service outages (&gt;24 hours).</p>

        <h3>Price changes</h3>
        <p>We'll notify you 30 days before any price increase. Existing subscriptions are grandfathered at the old rate for 12 months.</p>
      `,
    },
    {
      id: 'availability',
      title: '8. Availability & support',
      content: `
        <ul>
          <li><strong>Uptime target</strong> — 99.9% monthly (self-hosted: you control)</li>
          <li><strong>Planned maintenance</strong> — announced 48 hours in advance</li>
          <li><strong>Support</strong> — email (hello@relayon.dev), response within 48 hours on free tier, 24 hours on paid</li>
          <li><strong>No SLA</strong> — free tier has no guaranteed service level agreement</li>
        </ul>
      `,
    },
    {
      id: 'termination',
      title: '9. Termination',
      content: `
        <h3>By you</h3>
        <p>You can delete your account anytime from Settings. Data is permanently deleted within 30 days.</p>

        <h3>By us</h3>
        <p>We may terminate your account for:</p>
        <ul>
          <li>Violation of these terms</li>
          <li>Non-payment (after 30-day grace period)</li>
          <li>Fraud or abuse</li>
          <li>Extended inactivity (2+ years on free tier)</li>
        </ul>
        <p>We'll give 7 days notice for non-emergency terminations (30 days for non-payment). Emergencies (illegal content, active attack) are terminated immediately.</p>

        <h3>Upon termination</h3>
        <p>You may export your data for 30 days after termination. After that, all data is permanently deleted.</p>
      `,
    },
    {
      id: 'license',
      title: '10. License & source code',
      content: `
        <p>
          Relayon's source code is <strong>publicly visible</strong> but is
          <strong>NOT released under an open-source license</strong>.
          It is governed by the <strong>Relayon Proprietary Source-Visible License v1.0</strong>
          (effective November 20, 2026), which supersedes the previous MIT license.
        </p>

        <h3>You MAY (free, perpetual):</h3>
        <ul>
          <li>Use Relayon for personal or commercial purposes</li>
          <li>Self-host the Software on servers you own or control</li>
          <li>View the source code for transparency, security auditing, and learning</li>
          <li>Contribute improvements via Pull Requests (assigned to the Licensor upon merge)</li>
          <li>Create an unlimited number of webhook workflows</li>
        </ul>

        <h3>You MAY NOT (without prior written permission):</h3>
        <ul>
          <li>Modify, alter, adapt, translate, or create Derivative Works</li>
          <li>Deploy, host, or operate any modified version or fork — publicly or privately</li>
          <li>Sell, resell, sublicense, rent, lease, or redistribute the Software</li>
          <li>Build, operate, or promote a competing webhook relay, integration platform, or iPaaS product</li>
          <li>Use the Software or its source code to train, fine-tune, or evaluate any machine learning model</li>
          <li>Remove, obscure, or alter any copyright notice, "Powered by Relayon" notice, or the author credit "Zain Shah"</li>
          <li>Use the "Relayon" trademark, logo, or tagline "Your webhooks, relayed right" in a way that suggests endorsement</li>
        </ul>

        <h3>Written permission exception</h3>
        <p>
          The Licensor may, at their sole discretion, grant <strong>Written Permission</strong>
          to modify, extend, or self-deploy Derivative Works, subject to a separate agreement.
          If granted, mandatory attribution conditions apply (original copyright headers retained,
          "Powered by Relayon — created by Zain Shah" displayed on every page, and
          <strong>README.md</strong>, <strong>package.json</strong>, and all public docs crediting Zain Shah as the original author).
        </p>

        <h3>How to request permission</h3>
        <p>
          Email <a href="mailto:zainshahzs110@gmail.com">zainshahzs110@gmail.com</a> with the subject line:
          <br>
          <code>Relayon Permission Request — [Your Name]</code>
        </p>

        <h3>Termination of license</h3>
        <p>
          This License terminates automatically if you breach any of the restrictions above.
          On termination you must immediately cease all use of the Software, delete all copies,
          backups, and Derivative Works, and destroy any self-hosted deployments.
        </p>

        <h3>Governing law</h3>
        <p>
          The License is governed by the laws of <strong>Pakistan</strong>, with exclusive jurisdiction
          in the courts of Karachi. Material changes to the License are announced at
          <a href="https://github.com/zainshah3464/relayon" target="_blank" rel="noopener">github.com/zainshah3464/relayon</a>.
        </p>

        <p>
          <strong>Full license text:</strong>
          <a href="https://github.com/zainshah3464/relayon/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
            LICENSE on GitHub
          </a>
        </p>
      `,
    },
    {
      id: 'disclaimers',
      title: '11. Disclaimers',
      content: `
        <p>
          RELAYON IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW,
          WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>We do not warrant that:</p>
        <ul>
          <li>The service will be uninterrupted or error-free</li>
          <li>All webhooks will be delivered successfully (we retry but destinations can fail)</li>
          <li>The service will meet your specific requirements</li>
          <li>Data will never be lost (we backup but recommend you also backup)</li>
        </ul>
      `,
    },
    {
      id: 'liability',
      title: '12. Limitation of liability',
      content: `
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, RELAYON'S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING
          FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
          PRECEDING THE CLAIM (OR $100 FOR FREE TIER USERS).
        </p>
        <p>
          IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION.
        </p>
      `,
    },
    {
      id: 'indemnification',
      title: '13. Indemnification',
      content: `
        <p>
          You agree to indemnify and hold Relayon harmless from any claims, damages, or expenses arising
          from your use of the service in violation of these terms, or your infringement of any
          third-party rights.
        </p>
      `,
    },
    {
      id: 'law',
      title: '14. Governing law',
      content: `
        <p>
          These terms are governed by the laws of <strong>Pakistan</strong>, without regard to conflict
          of law principles. Disputes will be resolved in the courts of Karachi, Pakistan.
        </p>
        <p>For EU users, mandatory consumer protection laws in your country of residence still apply.</p>
      `,
    },
    {
      id: 'changes',
      title: '15. Changes to terms',
      content: `
        <p>
          We may update these terms occasionally. Material changes will be notified by email 30 days
          before taking effect. Continued use of Relayon after changes means you accept the updated terms.
        </p>
      `,
    },
    {
      id: 'contact',
      title: '16. Contact',
      content: `
        <p>
          <strong>Relayon</strong><br />
          General: <a href="mailto:hello@relayon.dev">hello@relayon.dev</a><br />
          License/permission requests: <a href="mailto:zainshahzs110@gmail.com">zainshahzs110@gmail.com</a><br />
          GitHub: <a href="https://github.com/zainshah3464" target="_blank" rel="noopener">github.com/zainshah3464</a>
        </p>
      `,
    },
  ];
}