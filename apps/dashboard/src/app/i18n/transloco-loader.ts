import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { TRANSLATIONS } from './translations';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    // ⚠️ No HTTP — imported at build time
    const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS];
    if (!t) {
      console.warn(`[Transloco] Unknown language: ${lang}`);
      return of({});
    }
    return of(t as Translation);
  }
}