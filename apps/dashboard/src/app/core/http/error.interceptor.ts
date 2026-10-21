import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Global error handling — Phase 6 will add toast notifications
      if (error.status === 0) {
        console.error('[Relayon] Network error — API is unreachable.');
      } else if (error.status === 500) {
        console.error('[Relayon] Server error:', error.error?.message);
      } else if (error.status === 403) {
        router.navigate(['/dashboard']);
      }
      return throwError(() => error);
    })
  );
};