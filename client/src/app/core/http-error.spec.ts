import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './http-error';

describe('errorMessage', () => {
  it('uses the message from an API error body', () => {
    const error = new HttpErrorResponse({ status: 409, error: { code: 'CATEGORY_NOT_EMPTY', message: 'Move the items first' } });
    expect(errorMessage(error)).toBe('Move the items first');
  });

  it('explains a network failure', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('unreachable');
  });

  it('explains a server failure without an API body', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 502, error: 'Bad Gateway' }))).toContain('server failed');
  });

  it('falls back to a generic message', () => {
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
