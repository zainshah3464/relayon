import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';

export type SupportedLang = 'en' | 'ur' | 'ar';

const STORAGE_KEY = 'relayon_lang';
const RTL_LANGS: SupportedLang[] = ['ur', 'ar'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly current = signal<SupportedLang>('en');
  readonly isRtl = signal(false);

  constructor() {
    const initial = this.resolveInitial();
    this.apply(initial);

    effect(() => {
      const lang = this.current();
      this.transloco.setActiveLang(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
      this.isRtl.set(RTL_LANGS.includes(lang));
    });
  }

  setLanguage(lang: SupportedLang): void {
    localStorage.setItem(STORAGE_KEY, lang);
    this.apply(lang);

    if (this.auth.isAuthenticated()) {
      this.http
        .patch(`${environment.apiUrl}/api/auth/me/locale`, { locale: lang })
        .subscribe({ error: () => undefined });
    }
  }

  private apply(lang: SupportedLang): void {
    this.current.set(lang);
  }

  private resolveInitial(): SupportedLang {
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;
    if (stored && ['en', 'ur', 'ar'].includes(stored)) return stored;

    const userLocale = this.auth.user()?.locale as SupportedLang | undefined;
    if (userLocale && ['en', 'ur', 'ar'].includes(userLocale)) return userLocale;

    const browser = navigator.language.split('-')[0]?.toLowerCase();
    if (browser === 'ur') return 'ur';
    if (browser === 'ar') return 'ar';
    return 'en';
  }
}