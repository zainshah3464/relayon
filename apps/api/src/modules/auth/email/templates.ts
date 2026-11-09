const BRAND = { name: 'Relayon', color: '#7C3AED', cyan: '#06B6D4', bg: '#0A0A0A', surface: '#131313', text: '#FFFFFF', muted: '#6B7280' };

function layout(opts: { preheader: string; heading: string; body: string; ctaLabel?: string; ctaUrl?: string; footer?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:24px 0;"><a href="${escapeAttr(opts.ctaUrl)}" style="display:inline-block;background:${BRAND.color};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(opts.ctaLabel)}</a></td></tr>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:${BRAND.text};"><span style="display:none">${escapeHtml(opts.preheader)}</span><table role="presentation" width="100%" style="background:${BRAND.bg};"><tr><td align="center" style="padding:40px 16px;"><table role="presentation" width="100%" style="max-width:560px;background:${BRAND.surface};border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding-bottom:24px;font-size:20px;font-weight:700;"><span style="display:inline-block;width:28px;height:28px;background:linear-gradient(135deg,${BRAND.color},${BRAND.cyan});border-radius:8px;text-align:center;line-height:28px;color:#fff;font-size:16px;margin-right:10px;">R</span>${BRAND.name}</td></tr><tr><td style="font-size:24px;font-weight:700;padding-bottom:16px;">${escapeHtml(opts.heading)}</td></tr><tr><td style="font-size:15px;line-height:1.6;color:#d1d5db;">${opts.body}</td></tr>${cta}${opts.footer ? `<tr><td style="padding-top:24px;font-size:12px;color:${BRAND.muted};border-top:1px solid rgba(255,255,255,0.06);">${opts.footer}</td></tr>` : ''}</table><p style="font-size:11px;color:${BRAND.muted};margin-top:24px;">Relayon · Your webhooks, relayed right.</p></td></tr></table></body></html>`;
}

export function verificationEmail(opts: { name: string; verifyUrl: string; expiresInHours: number }) {
  return {
    subject: 'Verify your Relayon email',
    html: layout({ preheader: 'Confirm your email to activate your Relayon account', heading: `Welcome, ${opts.name}!`, body: `<p style="margin:0 0 16px;">Confirm your email address to activate your Relayon account. This link expires in <strong>${opts.expiresInHours} hours</strong>.</p>`, ctaLabel: 'Verify email', ctaUrl: opts.verifyUrl, footer: `If you didn't sign up, ignore this email.` }),
    text: `Welcome, ${opts.name}!\n\nVerify your Relayon email:\n${opts.verifyUrl}\n\nExpires in ${opts.expiresInHours} hours.`,
  };
}

export function resetPasswordEmail(opts: { name: string; resetUrl: string; expiresInMinutes: number }) {
  return {
    subject: 'Reset your Relayon password',
    html: layout({ preheader: `Reset your Relayon password — expires in ${opts.expiresInMinutes} min`, heading: 'Reset password', body: `<p>Hi ${escapeHtml(opts.name)},</p><p>Click below to set a new password. Expires in <strong>${opts.expiresInMinutes} minutes</strong>.</p>`, ctaLabel: 'Reset password', ctaUrl: opts.resetUrl, footer: 'For security, this link can only be used once.' }),
    text: `Hi ${opts.name},\n\nReset your Relayon password:\n${opts.resetUrl}\n\nExpires in ${opts.expiresInMinutes} minutes.`,
  };
}

export function passwordChangedEmail(opts: { name: string }) {
  return {
    subject: 'Your Relayon password was changed',
    html: layout({ preheader: 'Your password was just changed', heading: 'Password changed', body: `<p>Hi ${escapeHtml(opts.name)},</p><p>Your password was just changed. All other sessions have been signed out.</p>`, footer: 'Sent for your security.' }),
    text: `Hi ${opts.name},\n\nYour Relayon password was just changed.`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s).replace(/`/g, '&#96;'); }