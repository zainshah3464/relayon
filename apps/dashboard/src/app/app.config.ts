import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
  APP_INITIALIZER,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { TRANSLATIONS } from './i18n/translations';
import { TranslocoHttpLoader } from './i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ur', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        fallbackLang: 'en',
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: false,
        },
        // ⚠️ flatten REMOVED — v7 deprecates it
      },
      loader: TranslocoHttpLoader,
    }),
    // ⚠️ THE FIX: Pre-load all translations BEFORE app boots
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [TranslocoService],
      useFactory: (transloco: TranslocoService) => () => {
        console.log('[i18n] Boot preload starting...');

        // Direct setTranslation — bypasses loader entirely
        for (const [lang, data] of Object.entries(TRANSLATIONS)) {
          transloco.setTranslation(data as Record<string, unknown>, lang);
          console.log(`[i18n] Set ${lang} — keys:`, Object.keys(data).length);
        }

        // Activate English
        transloco.setActiveLang('en');

        // Verify
        const test = transloco.translate('nav.dashboard');
        console.log('[i18n] Test translate nav.dashboard =', test);

        return Promise.resolve();
      },
    },
  ],
};