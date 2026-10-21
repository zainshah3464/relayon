import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Skip auth endpoints — they should never send Authorization
  const isAuthEndpoint = req.url.includes('/api/auth/login') ||
                         req.url.includes('/api/auth/signup') ||
                         req.url.includes('/api/auth/refresh');

  const token = auth.token();
  const authReq = token && !isAuthEndpoint
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only refresh on 401 from non-auth endpoints
      if (error.status === 401 && !isAuthEndpoint) {
        const refresh$ = auth.refresh();
        if (refresh$) {
          return refresh$.pipe(
            switchMap(() => {
              const newToken = auth.token();
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(retryReq);
            }),
            catchError((refreshErr) => {
              auth.logout();
              return throwError(() => refreshErr);
            })
          );
        }
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};