import { Express, Request as ExpressRequest } from "express";
import { IContainer, InstanceDefinition, LifeTime } from "hardwired";
import { ZodSchema } from "zod";
import { AnyRoute, RouteMethod, ISession, RouteConfig, PUBLIC } from "./types.js";
import IRequestLogger from "./request-logger.js";
import RequestHandler from "./request-handler.js";
import { OpenApiOptions } from "./openapi-generator.js";
import ApiDocs from "./api-docs/api-docs.js";

type RequestLoggerProvider = (req: ExpressRequest) => IRequestLogger;
type SessionProvider = (req: ExpressRequest) => ISession | undefined;
type ContainerProvider = (req: ExpressRequest) => IContainer;
type CheckPermissionProvider = (req: ExpressRequest) => (token: string) => Promise<boolean>;

function routeKey(method: RouteMethod, url: string) {
  return `${method.toUpperCase()} ${url
    .split("/")
    .map((x, i) => (x.startsWith(":") ? `:${i}` : x))
    .join("/")}`;
}

function routeConfig<
  TAuthToken = undefined,
  TParams extends Record<string, ZodSchema> | undefined = undefined,
  TQuery extends Record<string, ZodSchema> | undefined = undefined,
  TBody extends ZodSchema | undefined = undefined,
  THeaders extends Record<string, ZodSchema> | undefined = undefined,
  TResponse extends ZodSchema | undefined = undefined,
  TErrors extends Record<string, string> | undefined = undefined,
  TServices extends
    | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
    | undefined = undefined
>(
  method: RouteMethod,
  url: string,
  config: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>
) {
  return {
    key: `${method} ${url}`,
    method,
    url,
    config: config,
  };
}

export default class Router<TToken = undefined> {
  public readonly routes: AnyRoute[] = [];
  private routesLookup: Record<string, AnyRoute> = {};

  constructor(
    private readonly config: {
      nodeEnv: "development" | "production";
      mountPath?: string;
      handlerTimeoutMilliseconds?: number;
    },
    private readonly express: Express,
    private readonly containerProvider: ContainerProvider,
    private readonly requestLoggerProvider: RequestLoggerProvider,
    private readonly sessionProvider: SessionProvider,
    private readonly checkPermissionProvider: CheckPermissionProvider
  ) {
    if (this.config.mountPath && this.config.mountPath.endsWith("/")) {
      this.config.mountPath = this.config.mountPath.slice(0, -1);
    }
  }

  add<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TParams extends Record<string, ZodSchema> | undefined = undefined,
    TQuery extends Record<string, ZodSchema> | undefined = undefined,
    TBody extends ZodSchema | undefined = undefined,
    THeaders extends Record<string, ZodSchema> | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(
    method: RouteMethod, //
    url: string,
    config: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>
  ) {
    const key = routeKey(method, url);
    if (this.routesLookup[key]) {
      throw new Error(`Ambiguous route: ${key}`);
    }
    this.routesLookup[key] = routeConfig(method, url, config) as AnyRoute;
    this.routes.push(this.routesLookup[key]);
    this.express[method === "rpc" ? "post" : method](
      `${this.config.mountPath ?? ""}${url}`,
      RequestHandler.getMiddleware({
        nodeEnv: this.config.nodeEnv,
        handlerTimeoutMilliseconds: this.config.handlerTimeoutMilliseconds,
        route: this.routesLookup[key].config,
        containerProvider: this.containerProvider,
        requestLoggerProvider: this.requestLoggerProvider,
        sessionProvider: this.sessionProvider,
        checkPermissionProvider: this.checkPermissionProvider,
      })
    );
    return this;
  }

  get<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TParams extends Record<string, ZodSchema> | undefined = undefined,
    TQuery extends Record<string, ZodSchema> | undefined = undefined,
    THeaders extends Record<string, ZodSchema> | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(
    url: string,
    config: Omit<RouteConfig<TAuthToken, TParams, TQuery, undefined, THeaders, TResponse, TErrors, TServices>, "body">
  ) {
    return this.add("get", url, config);
  }

  post<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TParams extends Record<string, ZodSchema> | undefined = undefined,
    TQuery extends Record<string, ZodSchema> | undefined = undefined,
    TBody extends ZodSchema | undefined = undefined,
    THeaders extends Record<string, ZodSchema> | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(url: string, config: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>) {
    return this.add("post", url, config);
  }

  put<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TParams extends Record<string, ZodSchema> | undefined = undefined,
    TQuery extends Record<string, ZodSchema> | undefined = undefined,
    TBody extends ZodSchema | undefined = undefined,
    THeaders extends Record<string, ZodSchema> | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(url: string, config: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>) {
    return this.add("put", url, config);
  }

  delete<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TParams extends Record<string, ZodSchema> | undefined = undefined,
    TQuery extends Record<string, ZodSchema> | undefined = undefined,
    THeaders extends Record<string, ZodSchema> | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(
    url: string,
    config: Omit<RouteConfig<TAuthToken, TParams, TQuery, undefined, THeaders, TResponse, TErrors, TServices>, "body">
  ) {
    return this.add("delete", url, config);
  }

  rpc<
    TAuthToken extends TToken | typeof PUBLIC | undefined = undefined,
    TBody extends ZodSchema | undefined = undefined,
    TResponse extends ZodSchema | undefined = undefined,
    TErrors extends Record<string, string> | undefined = undefined,
    TServices extends
      | Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
      | undefined = undefined
  >(
    url: string,
    config: Omit<
      RouteConfig<TAuthToken, undefined, undefined, TBody, undefined, TResponse, TErrors, TServices>,
      "TParams" | "TQuery" | "THeaders"
    >
  ) {
    return this.add("rpc", url, config);
  }

  generateApiDocs(options: OpenApiOptions) {
    const apiDocs = new ApiDocs(options, this.routes);
    return apiDocs.html();
  }
}
