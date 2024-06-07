import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";
import { AnyRouteConfig, ISession, PUBLIC } from "./types.js";
import { IContainer, InstanceDefinition, LifeTime } from "hardwired";
import { ZodError, ZodIssue, z } from "zod";
import ApiError from "./api-error.js";
import IRequestLogger, { LoggerLevel } from "./logger.js";
import { Result, encodeObject } from "./utils.js";
import { differenceInMilliseconds } from "date-fns";
import {
  ForbiddenError,
  HttpError,
  InvalidRequestError,
  ServerError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "./http-errors.js";

type RequestHandlerConfig = {
  route: AnyRouteConfig;
  nodeEnv: "development" | "production";
  handlerTimeoutMilliseconds: number | undefined;
  containerProvider: (req: ExpressRequest) => IContainer;
  requestLoggerProvider: (req: ExpressRequest) => IRequestLogger;
  sessionProvider: (req: ExpressRequest) => ISession | undefined;
  checkPermissionProvider: (req: ExpressRequest) => (token: string) => Promise<boolean>;
};

type ParsedRequest = {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
};

type HandlerInvokationResult = Result<
  unknown,
  | {
      type: "api";
      error: ApiError<string>;
    }
  | {
      type: "timeout";
      error: undefined;
    }
  | {
      type: "http";
      error: HttpError;
    }
  | {
      type: "unknown";
      error: unknown;
    }
>;

const SLOW_RESPONSE_TIME_THRESHOLD_MILLISECONDS = 5 * 1000;

export default class RequestHandler {
  private readonly requestContainer: IContainer;
  private readonly logger: IRequestLogger;
  private readonly session?: ISession;
  private readonly checkPermission: (token: string) => Promise<boolean>;
  private readonly route: AnyRouteConfig;
  private readonly timedOut = Symbol();

  constructor(
    private readonly config: RequestHandlerConfig,
    private readonly req: ExpressRequest,
    private readonly res: ExpressResponse,
    private readonly next: NextFunction
  ) {
    this.requestContainer = this.config.containerProvider(req);
    this.logger = this.config.requestLoggerProvider(req);
    this.session = this.config.sessionProvider(req);
    this.checkPermission = this.config.checkPermissionProvider(req);
    this.route = this.config.route;
  }

  static getMiddleware(config: RequestHandlerConfig) {
    return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
      const handler = new RequestHandler(config, req, res, next);
      await handler.execute();
    };
  }

  private isDevelopment() {
    return this.config.nodeEnv === "development";
  }

  private invokedFromApiClient() {
    return !!this.req.get("api-client");
  }

  private logAndThrow<E extends HttpError>(
    errorClass: { new (): E },
    level: Exclude<LoggerLevel, "silent">,
    reason: string,
    payload?: object
  ): never {
    this.logger[level](reason, payload);
    throw new errorClass().setDevInfo({ reason, ...payload });
  }

  private getHeaders(keys: string[]) {
    return keys.reduce((m, k) => ({ ...m, [k]: this.req.get(k) }), {});
  }

  private formatZodIssue(field: string, issue: ZodIssue) {
    return `${[field, ...issue.path].join(".")}: ${issue.message}`;
  }

  private parseRequest() {
    const { req } = this;

    const params = z.object(this.route.params ?? {}).safeParse(req.params);
    const query = z.object(this.route.query ?? {}).safeParse(req.query);
    const body = this.route.body?.safeParse(req.body);
    const headers = z
      .object(this.route.headers ?? {})
      .safeParse(this.getHeaders(Object.keys(this.route.headers ?? {})));

    const errors: { field: string; issues: ZodIssue[] }[] = [];
    // TODO: chequear que los params coinciden con los que están en la url
    if (!params.success) {
      errors.push({ field: "params", issues: params.error.issues });
    }
    if (!query.success) {
      errors.push({ field: "query", issues: query.error.issues });
    }
    if (body && !body?.success) {
      errors.push({ field: "body", issues: body.error.issues });
    }
    if (!headers.success) {
      errors.push({ field: "headers", issues: headers.error.issues });
    }

    if (errors.length > 0) {
      const flatIssues = errors.reduce((memo, err) => {
        return [...memo, ...err.issues.map((issue) => this.formatZodIssue(err.field, issue))];
      }, [] as string[]);

      this.logAndThrow(InvalidRequestError, "verbose", "Could not parse incoming request", { errors: flatIssues });
    }

    return {
      params: params.success ? params.data : {},
      query: query.success ? query.data : {},
      body: body?.success ? body.data : {},
      headers: headers.success ? headers.data : {},
    };
  }

  private parseUserAgent() {
    const ua = null; // this.req.useragent; -- TODO
    if (!ua) return;

    // return {
    //   source: ua.source,
    //   browser: ua.browser,
    //   version: ua.version,
    //   os: ua.os,
    //   platform: ua.platform,
    //   geoIp: ua.geoIp,
    //   isDesktop: ua.isDesktop,
    //   isAndroid: ua.isAndroid,
    //   isiPhone: ua.isiPhone,
    //   isTablet: ua.isTablet,
    //   isiPad: ua.isiPad,
    // };
  }

  private resolveServices() {
    try {
      return Object.keys(this.route.services ?? {}).reduce(
        (m, key) => ({
          ...m,
          [key]: this.requestContainer.get(
            this.route.services?.[key] as InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>
          ),
        }),
        {} as Record<string, unknown>
      );
    } catch (err) {
      return this.logAndThrow(
        ServerError,
        "error",
        "Could not resolve service dependencies.",
        this.getPayloadForUnknownError(err)
      );
    }
  }

  public send(args: { status: number; data?: unknown }) {
    this.res.status(args.status);
    if (args.data !== undefined) {
      this.res.json(args.data);
    }
    this.res.end();
  }

  private success(data?: unknown) {
    if (this.invokedFromApiClient()) {
      // Si el request viene del cliente generado, devolvemos un json que pueda ser parseado conservando los tipos.
      this.send({ status: 200, data: encodeObject(data) });
    } else {
      this.send({ status: 200, data });
    }
  }

  private fail(status: number, data?: unknown) {
    this.send({ status, data });
  }

  private async checkAuth() {
    if (this.route.auth === PUBLIC) return;

    if (!this.session) {
      this.logAndThrow(UnauthorizedError, "verbose", "Unauthorized");
    }

    if (this.route.auth) {
      const hasPermission = await this.checkPermission(this.route.auth);
      if (!hasPermission) {
        this.logAndThrow(ForbiddenError, "verbose", "Forbidden");
      }
    }
  }

  private async invokeRouteHandler(
    parsedRequest: ParsedRequest,
    services: Record<string, unknown>
  ): HandlerInvokationResult {
    const routeHandler = this.route.handler({
      ...parsedRequest,
      services,
      session: this.session,
      container: this.requestContainer,
    });

    let result: unknown;
    try {
      if (this.config.handlerTimeoutMilliseconds) {
        const timeoutGuard = new Promise((resolve) =>
          setTimeout(() => {
            resolve(this.timedOut);
          }, this.config.handlerTimeoutMilliseconds)
        );

        result = await Promise.race([routeHandler, timeoutGuard]);
      } else {
        result = await routeHandler;
      }

      this.logger.debug("Raw response from handler invokation", { result });

      if (result === this.timedOut) {
        return Result.err({ type: "timeout", error: undefined });
      }

      if (result instanceof ApiError) {
        return Result.err({ type: "api", error: result });
      }

      return Result.ok(result);
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        return Result.err({ type: "http", error });
      }
      return Result.err({ type: "unknown", error });
    }
  }

  private handleTimeoutError() {
    this.logAndThrow(
      ServiceUnavailableError,
      "warn",
      `Handler execution timed out after ${this.config.handlerTimeoutMilliseconds} milliseconds.`
    );
  }

  private handleApiError(error: ApiError<string>) {
    const message = this.route.errors?.[error.code];
    if (message) {
      error.setMessage(message);
    }
    this.logger.verbose("Request handler returned with error", error.toJson(this.isDevelopment()));
    throw error;
  }

  private handleHttpError(error: HttpError) {
    this.logger.verbose("Request handler returned with error", error.toJson(this.isDevelopment()));
    throw error;
  }

  private handleUnknownError(error: unknown) {
    this.logAndThrow(ServerError, "error", "Error executing route handler", this.getPayloadForUnknownError(error));
  }

  private parseInvokationResult(result: unknown) {
    try {
      let response: unknown;
      if (this.route.response) {
        response = this.route.response.parse(result);
      }
      this.logger.verbose("Request handler returned successfully", { response });
      return response;
    } catch (err) {
      if (err instanceof ZodError) {
        this.logAndThrow(ServerError, "warn", "Result from request handler did not conform to the expected type.", {
          result,
          errors: err.issues.map((issue) => this.formatZodIssue("response", issue)),
        });
      }
      throw err;
    }
  }

  private async doExecute() {
    this.logger.verbose("Incoming request", {
      method: this.req.method,
      url: this.req.url,
      userAgent: this.isDevelopment() ? undefined : this.parseUserAgent(),
      // TODO: agregar device ID
      // TODO: agregar la versión de la librería cliente
      session: this.session,
    });

    const parsedRequest = this.parseRequest();

    await this.checkAuth();

    const services = this.resolveServices();

    const result = await this.invokeRouteHandler(parsedRequest, services);

    if (result.ok) {
      return this.parseInvokationResult(result.value);
    }

    const { type, error } = result.error;
    switch (type) {
      case "timeout":
        this.handleTimeoutError();
        break;
      case "api":
        this.handleApiError(error);
        break;
      case "http":
        this.handleHttpError(error);
        break;
      case "unknown":
        this.handleUnknownError(error);
        break;
      default:
        throw error;
    }
  }

  getPayloadForUnknownError(err: unknown) {
    return err instanceof Error ? { message: err.message, stack: (err.stack ?? "").split("\n") } : undefined;
  }

  async execute() {
    const startTime = new Date();

    try {
      const response = await this.doExecute();
      return this.success(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        return this.fail(err.status, err.toJson(this.isDevelopment()));
      }
      if (err instanceof HttpError) {
        return this.fail(err.status, this.isDevelopment() ? err.toJson(this.isDevelopment()) : undefined);
      }

      // Manejamos errores que pueden suceder fuera de la invocaciónd el handler (ej. al parsear el request, resolver servicios);
      const payload = this.getPayloadForUnknownError(err);
      this.logger.error("Route handler returned unexpected error", payload);
      return this.fail(500, this.isDevelopment() ? payload : undefined);
    } finally {
      const responseTime = differenceInMilliseconds(new Date(), startTime);
      if (responseTime > SLOW_RESPONSE_TIME_THRESHOLD_MILLISECONDS) {
        this.logger.warn("Slow endpoint response time.", { responseTime: `${responseTime} ms` });
      }
      this.logger.flush();
    }
  }
}
