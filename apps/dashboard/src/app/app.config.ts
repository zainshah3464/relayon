import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
  provideAppInitializer,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { TRANSLATIONS } from './i18n/translations';
import { TranslocoHttpLoader } from './i18n/transloco-loader';
import { TrackerService } from './core/tracking/tracker.service';
import { PresenceHeartbeatService } from './core/presence/presence-heartbeat.service';

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
      },
      loader: TranslocoHttpLoader,
    }),

    // ⚠️ v2.6 — Angular 19 native (replaces APP_INITIALIZER, avoids NG0203)
    provideAppInitializer(() => {
      const injector = inject(Injector);
      return runInInjectionContext(injector, () => {
        const transloco = inject(TranslocoService);
        const tracker = inject(TrackerService);
        const presence = inject(PresenceHeartbeatService);

        // i18n
        for (const [lang, data] of Object.entries(TRANSLATIONS)) {
          transloco.setTranslation(data as Record<string, unknown>, lang);
        }
        transloco.setActiveLang('en');

        // analytics + presence
        tracker.init();
        setTimeout(() => presence.init(), 500);

        return Promise.resolve();
      });
    }),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};