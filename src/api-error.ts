import { InvalidRequestError } from './http-errors.js';

export default class ApiError<TCode> extends InvalidRequestError {
  constructor(public readonly code: TCode) {
    super();
  }

  setMessage(message: string) {
    this.message = message;
  }

  override toJson(includeDevInfo = false): object {
    return { code: this.code, ...super.toJson(includeDevInfo) };
  }
}
