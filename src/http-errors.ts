export class HttpError extends Error {
  protected devInfo: unknown;
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message);
  }

  setDevInfo(info: unknown) {
    this.devInfo = info;
    return this;
  }

  toJson(includeDevInfo = false): object {
    return {
      message: this.message,
      devInfo: includeDevInfo ? this.devInfo : undefined,
    };
  }
}

export class InvalidRequestError extends HttpError {
  constructor() {
    super(400, 'Invalid Request');
  }
}
export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, 'Unauthorized');
  }
}
export class ForbiddenError extends HttpError {
  constructor() {
    super(403, 'Forbidden');
  }
}
export class NotFoundError extends HttpError {
  constructor() {
    super(404, 'Not Found');
  }
}
export class ServerError extends HttpError {
  constructor() {
    super(500, 'Server Error');
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor() {
    super(503, 'Service Unavailable');
  }
}
