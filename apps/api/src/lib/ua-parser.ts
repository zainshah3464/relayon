export interface ParsedUA {
  browser: string | null;
  os: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | 'bot' | null;
  isBot: boolean;
}

const BOT_PATTERNS = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|phantom|puppeteer|playwright/i;

/**
 * Minimal UA parser — no dependencies. Extracts only coarse browser/OS
 * classes (privacy-safe). Full UA string is NEVER stored.
 */
export function parseUA(ua: string | undefined): ParsedUA {
  if (!ua) return { browser: null, os: null, device: null, isBot: false };

  if (BOT_PATTERNS.test(ua)) {
    return { browser: null, os: null, device: 'bot', isBot: true };
  }

  let browser: string | null = null;
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  let os: string | null = null;
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let device: ParsedUA['device'] = 'desktop';
  if (/Mobi|Android/.test(ua) && !/Tablet/.test(ua)) device = 'mobile';
  else if (/iPad|Tablet/.test(ua)) device = 'tablet';

  return { browser, os, device, isBot: false };
}