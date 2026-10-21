import type { ApiErrorBody, ApiErrorCode, MenuIssue } from '@shared';

/** An expected error with a stable code the client can react to. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: MenuIssue[],
  ) {
    super(message);
  }

  toBody(): ApiErrorBody {
    return this.issues ? { code: this.code, message: this.message, issues: this.issues } : { code: this.code, message: this.message };
  }
}

export const notFound = (what: string): ApiError => new ApiError(404, 'NOT_FOUND', `${what} not found`);
