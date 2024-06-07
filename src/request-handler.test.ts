import { ISession, RouteConfig } from "./types.js";
import RequestHandler from "./request-handler.js";
import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";
import { mock } from "vitest-mock-extended";
import { IContainer, InstanceDefinition, LifeTime, container } from "hardwired";
import IRequestLogger from "./logger.js";
import { ZodSchema, z } from "zod";
import { PUBLIC } from "./index.js";

function getRequestHandler<
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
>(opts: {
  nodeEnv?: "development" | "production";
  handlerTimeoutMilliseconds?: number;
  container?: IContainer;
  logger?: IRequestLogger;
  session?: ISession | undefined;
  checkPermission?: (token: string) => Promise<boolean>;
  route: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>;
}) {
  const cnt = opts.container ?? container();
  const logger = opts.logger ?? mock<IRequestLogger>();
  const session = "session" in opts ? opts.session : mock<ISession>();
  const checkPermission = opts.checkPermission ?? (async () => true);

  const config = {
    nodeEnv: "production" as const,
    handlerTimeout: 10 * 1000,
    containerProvider: () => container,
    requestLoggerProvider: () => logger,
    sessionProvider: () => session,
    checkPermissionProvider: () => checkPermission,
    ...opts,
  };

  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    get(name: string) {
      const idx = Object.keys(this.headers).findIndex((x) => x.toLowerCase() === name.toLowerCase());
      return this.headers[Object.keys(this.headers)[idx]];
    },
  } as ExpressRequest;

  const next = mock<NextFunction>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = new RequestHandler(config as any, req, mock<ExpressResponse>(), next);
  const sendSpy = vi.spyOn(handler, "send");

  return {
    container: cnt,
    requestLogger: logger,
    session,
    config,
    handler,
    req,
    sendSpy,
    next,
  };
}

describe("Route Request handler", () => {
  test("respond successfully with void handler", async () => {
    const { handler, sendSpy } = getRequestHandler({
      route: {
        auth: PUBLIC,
        handler: async () => {},
      },
    });

    await handler.execute();

    expect(sendSpy).toHaveBeenCalledOnce();
    expect(sendSpy).toHaveBeenCalledWith({ status: 200, data: undefined });
  });

  test("respond 401 when endpoint is private and no session", async () => {
    const { handler, sendSpy } = getRequestHandler({
      session: undefined,
      route: {
        response: z.object({ x: z.string() }),
        handler: async () => ({ x: "test" }),
      },
    });

    await handler.execute();

    expect(sendSpy).toHaveBeenCalledWith({ status: 401, data: undefined });
  });

  test("respond 200 when endpoint is private and there is an active session", async () => {
    const { handler, sendSpy } = getRequestHandler({
      route: {
        response: z.object({ x: z.string() }),
        handler: async () => ({ x: "test" }),
      },
    });

    await handler.execute();

    expect(sendSpy).toHaveBeenCalledWith({ status: 200, data: { x: "test" } });
  });

  test("respond 400 when called with incorrect params", async () => {
    const { handler, req, sendSpy } = getRequestHandler({
      nodeEnv: "development", // Important if we want to get feedback in the devInfo field of the error
      route: {
        params: {
          a: z.number(),
        },
        query: {
          q: z.string(),
        },
        headers: {
          h: z.coerce.number(),
        },
        handler: async () => {},
      },
    });

    req.params = { a: "not a number" };
    req.headers = { H: "123" };

    await handler.execute();

    expect(sendSpy).toHaveBeenCalledWith({ status: 400, data: expect.anything() });
    const error = sendSpy.mock.calls[0][0];
    expect(error).to.deep.contain({
      status: 400,
      data: {
        message: "Invalid Request",
        devInfo: {
          reason: "Could not parse incoming request",
          errors: ["params.a: Expected number, received string", "query.q: Required"],
        },
      },
    });
  });
});
