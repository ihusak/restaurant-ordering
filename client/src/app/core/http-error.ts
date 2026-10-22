import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '@shared';

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as Partial<ApiErrorBody>).code === 'string';
}

/** A message that can be shown to the user as it is. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (isApiErrorBody(error.error)) return error.error.message;
    if (error.status === 0) return 'The server is unreachable. Check your connection.';
    if (error.status >= 500) return 'The server failed to respond. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
