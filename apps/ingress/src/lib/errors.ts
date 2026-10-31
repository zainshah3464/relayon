export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'bad_request', message, details);
  }
}

export class SignatureError extends ApiError {
  constructor(message: string) {
    super(401, 'invalid_signature', message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, 'not_found', message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string) {
    super(429, 'rate_limited', message);
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message: string) {
    super(413, 'payload_too_large', message);
  }
}

export class QuotaExceededError extends ApiError {
  constructor(message: string, public readonly resetAt: string) {
    super(429, 'quota_exceeded', message);
  }
}