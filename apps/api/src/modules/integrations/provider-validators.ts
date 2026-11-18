export type Provider = 'groq' | 'openai' | 'anthropic' | 'resend';

export interface ValidationResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

const TIMEOUT_MS = 10_000;

export async function validateProviderKey(
  provider: Provider,
  apiKey: string,
): Promise<ValidationResult> {
  if (!apiKey || apiKey.length < 20) {
    return { ok: false, error: 'Key looks too short' };
  }
  try {
    switch (provider) {
      case 'groq': return await validateGroq(apiKey);
      case 'openai': return await validateOpenAI(apiKey);
      case 'anthropic': return await validateAnthropic(apiKey);
      case 'resend': return await validateResend(apiKey);
      default: return { ok: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 200) : 'Validation failed',
    };
  }
}

async function validateGroq(key: string): Promise<ValidationResult> {
  if (!key.startsWith('gsk_')) {
    return { ok: false, error: 'Groq keys start with "gsk_"' };
  }
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, error: `Groq returned ${res.status}` };
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return { ok: true, models: (json.data ?? []).map((m) => m.id) };
}

async function validateOpenAI(key: string): Promise<ValidationResult> {
  if (!key.startsWith('sk-')) {
    return { ok: false, error: 'OpenAI keys start with "sk-"' };
  }
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, error: `OpenAI returned ${res.status}` };
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return { ok: true, models: (json.data ?? []).map((m) => m.id) };
}

async function validateAnthropic(key: string): Promise<ValidationResult> {
  if (!key.startsWith('sk-ant-')) {
    return { ok: false, error: 'Anthropic keys start with "sk-ant-"' };
  }
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, error: `Anthropic returned ${res.status}` };
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return { ok: true, models: (json.data ?? []).map((m) => m.id) };
}

async function validateResend(key: string): Promise<ValidationResult> {
  if (!key.startsWith('re_')) {
    return { ok: false, error: 'Resend keys start with "re_"' };
  }
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, error: `Resend returned ${res.status}` };
  return { ok: true };
}