export type Locale = 'en' | 'ur' | 'ar';

interface BaseTexts {
  brand: string;
  footer: string;
  verify: {
    subject: string;
    preheader: string;
    heading: (name: string) => string;
    body: (hours: number) => string;
    cta: string;
    footer: string;
    textFallback: (name: string, url: string, hours: number) => string;
  };
  reset: {
    subject: string;
    preheader: (mins: number) => string;
    heading: string;
    body: (name: string, mins: number) => string;
    bodyNote: string;
    cta: string;
    footer: string;
    textFallback: (name: string, url: string, mins: number) => string;
  };
  changed: {
    subject: string;
    preheader: string;
    heading: string;
    body: (name: string) => string;
    bodyNote: string;
    footer: string;
    textFallback: (name: string) => string;
  };
}

const TEXT: Record<Locale, BaseTexts> = {
  en: {
    brand: 'Relayon',
    footer: 'Relayon · Your webhooks, relayed right.',
    verify: {
      subject: 'Verify your Relayon email',
      preheader: 'Confirm your email to activate your Relayon account',
      heading: (name) => `Welcome, ${name}!`,
      body: (hours) => `Confirm your email address to activate your Relayon account. This link expires in <strong>${hours} hours</strong>.`,
      cta: 'Verify email',
      footer: "If you didn't sign up, ignore this email.",
      textFallback: (name, url, hours) => `Welcome, ${name}!\n\nVerify your Relayon email:\n${url}\n\nExpires in ${hours} hours.`,
    },
    reset: {
      subject: 'Reset your Relayon password',
      preheader: (mins) => `Reset your Relayon password — link expires in ${mins} minutes`,
      heading: 'Reset password',
      body: (name, mins) => `Hi ${name},<br/><br/>Click the button below to set a new password. This link expires in <strong>${mins} minutes</strong>.`,
      bodyNote: "If you didn't request this, no action needed — your password stays unchanged.",
      cta: 'Reset password',
      footer: 'For security, this link can only be used once.',
      textFallback: (name, url, mins) => `Hi ${name},\n\nReset your Relayon password:\n${url}\n\nExpires in ${mins} minutes.`,
    },
    changed: {
      subject: 'Your Relayon password was changed',
      preheader: 'Your password was just changed',
      heading: 'Password changed',
      body: (name) => `Hi ${name},<br/><br/>Your Relayon password was just changed. All other sessions have been signed out.`,
      bodyNote: "If this wasn't you, reset your password immediately.",
      footer: 'Sent for your security.',
      textFallback: (name) => `Hi ${name},\n\nYour Relayon password was just changed.`,
    },
  },
  ur: {
    brand: 'Relayon',
    footer: 'Relayon · Your webhooks, relayed right.',
    verify: {
      subject: 'اپنی Relayon ای میل کی تصدیق کریں',
      preheader: 'اپنا اکاؤنٹ فعال کرنے کے لیے ای میل کی تصدیق کریں',
      heading: (name) => `خوش آمدید، ${name}!`,
      body: (hours) => `اپنے Relayon اکاؤنٹ کو فعال کرنے کے لیے اپنی ای میل کی تصدیق کریں۔ یہ لنک <strong>${hours} گھنٹے</strong> میں ختم ہو جائے گا۔`,
      cta: 'ای میل کی تصدیق کریں',
      footer: 'اگر آپ نے سائن اپ نہیں کیا، اس ای میل کو نظر انداز کریں۔',
      textFallback: (name, url, hours) => `خوش آمدید، ${name}!\n\nاپنی Relayon ای میل کی تصدیق کریں:\n${url}\n\n${hours} گھنٹے میں ختم ہو جائے گا۔`,
    },
    reset: {
      subject: 'اپنا Relayon پاس ورڈ ری سیٹ کریں',
      preheader: (mins) => `اپنا Relayon پاس ورڈ ری سیٹ کریں — لنک ${mins} منٹ میں ختم ہو جائے گا`,
      heading: 'پاس ورڈ ری سیٹ کریں',
      body: (name, mins) => `ہیلو ${name}،<br/><br/>نیا پاس ورڈ سیٹ کرنے کے لیے نیچے بٹن پر کلک کریں۔ یہ لنک <strong>${mins} منٹ</strong> میں ختم ہو جائے گا۔`,
      bodyNote: 'اگر آپ نے یہ درخواست نہیں کی، کوئی کارروائی ضروری نہیں — آپ کا پاس ورڈ وہی رہے گا۔',
      cta: 'پاس ورڈ ری سیٹ کریں',
      footer: 'سیکیورٹی کے لیے یہ لنک صرف ایک بار استعمال ہو سکتا ہے۔',
      textFallback: (name, url, mins) => `ہیلو ${name}،\n\nاپنا Relayon پاس ورڈ ری سیٹ کریں:\n${url}\n\n${mins} منٹ میں ختم ہو جائے گا۔`,
    },
    changed: {
      subject: 'آپ کا Relayon پاس ورڈ تبدیل ہو گیا',
      preheader: 'آپ کا پاس ورڈ ابھی تبدیل ہوا',
      heading: 'پاس ورڈ تبدیل ہو گیا',
      body: (name) => `ہیلو ${name}،<br/><br/>آپ کا Relayon پاس ورڈ ابھی تبدیل ہوا ہے۔ دیگر تمام سیشن سائن آؤٹ ہو گئے ہیں۔`,
      bodyNote: 'اگر یہ آپ نے نہیں کیا، فوراً اپنا پاس ورڈ ری سیٹ کریں۔',
      footer: 'آپ کی سیکیورٹی کے لیے بھیجا گیا۔',
      textFallback: (name) => `ہیلو ${name}،\n\nآپ کا Relayon پاس ورڈ ابھی تبدیل ہوا ہے۔`,
    },
  },
  ar: {
    brand: 'Relayon',
    footer: 'Relayon · Your webhooks, relayed right.',
    verify: {
      subject: 'تحقق من بريدك الإلكتروني على Relayon',
      preheader: 'أكد بريدك الإلكتروني لتنشيط حساب Relayon',
      heading: (name) => `مرحباً، ${name}!`,
      body: (hours) => `أكد عنوان بريدك الإلكتروني لتنشيط حساب Relayon. تنتهي صلاحية هذا الرابط خلال <strong>${hours} ساعة</strong>.`,
      cta: 'تحقق من البريد',
      footer: 'إذا لم تسجل، فتجاهل هذا البريد.',
      textFallback: (name, url, hours) => `مرحباً، ${name}!\n\nتحقق من بريدك الإلكتروني على Relayon:\n${url}\n\nتنتهي الصلاحية خلال ${hours} ساعة.`,
    },
    reset: {
      subject: 'إعادة تعيين كلمة مرور Relayon',
      preheader: (mins) => `أعد تعيين كلمة مرور Relayon — ينتهي الرابط خلال ${mins} دقيقة`,
      heading: 'إعادة تعيين كلمة المرور',
      body: (name, mins) => `مرحباً ${name}،<br/><br/>انقر على الزر أدناه لتعيين كلمة مرور جديدة. تنتهي صلاحية هذا الرابط خلال <strong>${mins} دقيقة</strong>.`,
      bodyNote: 'إذا لم تطلب هذا، فلا حاجة لأي إجراء — تبقى كلمة المرور كما هي.',
      cta: 'إعادة تعيين',
      footer: 'لأمانك، يمكن استخدام هذا الرابط مرة واحدة فقط.',
      textFallback: (name, url, mins) => `مرحباً ${name}،\n\nأعد تعيين كلمة مرور Relayon:\n${url}\n\nتنتهي الصلاحية خلال ${mins} دقيقة.`,
    },
    changed: {
      subject: 'تم تغيير كلمة مرور Relayon',
      preheader: 'تم تغيير كلمة المرور للتو',
      heading: 'تم تغيير كلمة المرور',
      body: (name) => `مرحباً ${name}،<br/><br/>تم تغيير كلمة مرور Relayon للتو. تم تسجيل الخروج من جميع الجلسات الأخرى.`,
      bodyNote: 'إذا لم تكن أنت، فأعد تعيين كلمة المرور فوراً.',
      footer: 'أُرسل لأمانك.',
      textFallback: (name) => `مرحباً ${name}،\n\nتم تغيير كلمة مرور Relayon للتو.`,
    },
  },
};

function dir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
}

const BRAND = { name: 'Relayon', color: '#7C3AED', cyan: '#06B6D4', bg: '#0A0A0A', surface: '#131313', text: '#FFFFFF', muted: '#6B7280' };

function layout(locale: Locale, opts: {
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const t = TEXT[locale];
  const isRtl = dir(locale) === 'rtl';
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:24px 0;text-align:${isRtl ? 'right' : 'left'};">
        <a href="${escAttr(opts.ctaUrl)}" style="display:inline-block;background:${BRAND.color};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          ${esc(opts.ctaLabel)}
        </a>
      </td></tr>`
    : '';

  return `<!doctype html>
<html lang="${locale}" dir="${dir(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans Arabic','Noto Nastaliq Urdu',Inter,sans-serif;color:${BRAND.text};">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.surface};border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.06);" dir="${dir(locale)}">
        <tr><td style="padding-bottom:24px;font-size:20px;font-weight:700;">
          <span style="display:inline-block;width:28px;height:28px;background:linear-gradient(135deg,${BRAND.color},${BRAND.cyan});border-radius:8px;text-align:center;line-height:28px;color:#fff;font-size:16px;margin-${isRtl ? 'left' : 'right'}:10px;">R</span>
          ${t.brand}
        </td></tr>
        <tr><td style="font-size:24px;font-weight:700;padding-bottom:16px;">${esc(opts.heading)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#d1d5db;">${opts.body}</td></tr>
        ${cta}
        ${opts.footer ? `<tr><td style="padding-top:24px;font-size:12px;color:${BRAND.muted};border-top:1px solid rgba(255,255,255,0.06);">${esc(opts.footer)}</td></tr>` : ''}
      </table>
      <p style="font-size:11px;color:${BRAND.muted};margin-top:24px;">${t.footer}</p>
    </td></tr>
  </table>
</body></html>`;
}

export function verificationEmail(locale: Locale, opts: { name: string; verifyUrl: string; expiresInHours: number }) {
  const t = TEXT[locale].verify;
  return {
    subject: t.subject,
    html: layout(locale, {
      preheader: t.preheader,
      heading: t.heading(opts.name),
      body: `<p style="margin:0;">${t.body(opts.expiresInHours)}</p>`,
      ctaLabel: t.cta,
      ctaUrl: opts.verifyUrl,
      footer: t.footer,
    }),
    text: t.textFallback(opts.name, opts.verifyUrl, opts.expiresInHours),
  };
}

export function resetPasswordEmail(locale: Locale, opts: { name: string; resetUrl: string; expiresInMinutes: number }) {
  const t = TEXT[locale].reset;
  return {
    subject: t.subject,
    html: layout(locale, {
      preheader: t.preheader(opts.expiresInMinutes),
      heading: t.heading,
      body: `<p style="margin:0 0 16px;">${t.body(opts.name, opts.expiresInMinutes)}</p><p style="margin:0;color:#9ca3af;font-size:13px;">${t.bodyNote}</p>`,
      ctaLabel: t.cta,
      ctaUrl: opts.resetUrl,
      footer: t.footer,
    }),
    text: t.textFallback(opts.name, opts.resetUrl, opts.expiresInMinutes),
  };
}

export function passwordChangedEmail(locale: Locale, opts: { name: string }) {
  const t = TEXT[locale].changed;
  return {
    subject: t.subject,
    html: layout(locale, {
      preheader: t.preheader,
      heading: t.heading,
      body: `<p style="margin:0 0 16px;">${t.body(opts.name)}</p><p style="margin:0;color:#9ca3af;font-size:13px;">${t.bodyNote}</p>`,
      footer: t.footer,
    }),
    text: t.textFallback(opts.name),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function escAttr(s: string): string {
  return esc(s).replace(/`/g, '&#96;');
}