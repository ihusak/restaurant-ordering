import type { HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';
import { isTransient } from './http-error';

export const GET_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Retries reads that failed because of the network or the server: 0.5s, 1s, 2s.
 * Writes are never repeated here, because repeating them could change data twice;
 * checkout has its own retry that is made safe by the idempotency key.
 */
export const retryInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method !== 'GET') return next(request);
  return next(request).pipe(
    retry({
      count: GET_RETRIES,
      delay: (error: unknown, attempt) =>
        isTransient(error) ? timer(BASE_DELAY_MS * 2 ** (attempt - 1)) : throwError(() => error),
    }),
  );
};
