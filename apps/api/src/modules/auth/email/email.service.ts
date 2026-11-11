import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  verificationEmail,
  resetPasswordEmail,
  passwordChangedEmail,
  type Locale,
} from './templates';

function safeLocale(raw: string | null | undefined): Locale {
  return raw === 'ur' || raw === 'ar' ? raw : 'en';
}

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('GMAIL_USER');
    const pass = config.get<string>('GMAIL_APP_PASSWORD');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      this.from = config.get<string>('EMAIL_FROM') ?? `Relayon <${user}>`;
      this.logger.log(`✅ Gmail SMTP configured (${user})`);
    } else {
      this.transporter = null;
      this.from = 'Relayon <noreply@relayon.dev>';
      this.logger.warn('GMAIL_USER / GMAIL_APP_PASSWORD missing — emails will be logged only');
    }
  }

  async sendVerification(to: string, name: string, url: string, locale?: string | null): Promise<void> {
    const { subject, html, text } = verificationEmail(safeLocale(locale), { name, verifyUrl: url, expiresInHours: 24 });
    await this.send(to, subject, html, text);
  }

  async sendPasswordReset(to: string, name: string, url: string, locale?: string | null): Promise<void> {
    const { subject, html, text } = resetPasswordEmail(safeLocale(locale), { name, resetUrl: url, expiresInMinutes: 60 });
    await this.send(to, subject, html, text);
  }

  async sendPasswordChanged(to: string, name: string, locale?: string | null): Promise<void> {
    const { subject, html, text } = passwordChangedEmail(safeLocale(locale), { name });
    await this.send(to, subject, html, text);
  }

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV] Email to ${to}: ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`✉️  Email sent: ${subject} → ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}