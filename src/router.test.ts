import { MockedFunction } from "vitest";
import request from "supertest";
import { z } from "zod";
import express, { Express, Request as ExpressRequest } from "express";
import { container, scoped } from "hardwired";
import { ApiError, ISession, PUBLIC, Router } from "./index.js";
import { mock, mockFn } from "vitest-mock-extended";
import IRequestLogger from "./request-logger.js";
import JsonParserMiddleware from "../test/json-parser-middleware.js";

describe("Router", async () => {
  let app: Express;
  let router: Router;
  const sessionProviderMock: MockedFunction<(req: ExpressRequest) => ISession | undefined> = mockFn();

  beforeEach(() => {
    app = express();
    app.use(JsonParserMiddleware());

    router = new Router(
      { nodeEnv: "production" },
      app,
      () => container(),
      () => mock<IRequestLogger>(),
      sessionProviderMock,
      () => async () => true
    );
  });

  it("GET / Should succeed", async () => {
    router.get("/", {
      auth: PUBLIC,
      response: z.string(),
      handler: async () => "ok",
    });
    const res = await request(app).get("/").expect(200);
    expect(res.body).to.eq("ok");
  });

  describe("GET /:id (id: number)", () => {
    beforeEach(() => {
      router.get("/:id", {
        auth: PUBLIC,
        params: {
          id: z.coerce.number(),
        },
        response: z.number(),
        handler: async ({ params }) => params.id,
      });
    });

    it("GET /1 Should succeed", async () => {
      const res = await request(app).get("/1").expect(200);
      expect(res.body).to.eq(1);
    });

    it("GET /a Should fail with status 400", async () => {
      await request(app).get("/a").expect(400);
    });
  });

  describe("Query", () => {
    beforeEach(() => {
      router.get("/", {
        auth: PUBLIC,
        query: {
          q: z.coerce.string().optional(),
          d: z.coerce.date().optional(),
          n: z.coerce.number().optional(),
          b: z.coerce.boolean().optional(),
        },
        response: z.object({
          q: z.string().optional(),
          d: z.date().optional(),
          n: z.number().optional(),
          b: z.boolean().optional(),
        }),
        handler: async ({ query }) => query,
      });
    });

    it("GET / Should succeed", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.body).to.deep.eq({});
    });

    it("GET /?q=a&d=2023-07-09&n=1&b=true Should succeed", async () => {
      const res = await request(app).get("/?q=a&d=2023-07-09&n=1&b=true").expect(200);
      expect(res.body).to.deep.eq({
        q: "a",
        d: new Date("2023-07-09").toISOString(),
        n: 1,
        b: true,
      });
    });

    it("GET /?d=2023-15-09 Should fail with status 400", async () => {
      await request(app).get("/?d=2023-15-09").expect(400);
    });

    it("GET /?x=a Should succeed removing extra properties from query", async () => {
      const res = await request(app).get("/?x=a").expect(200);
      expect(res.body).to.deep.eq({});
    });
  });

  describe("Body", () => {
    beforeEach(() => {
      router.post("/", {
        auth: PUBLIC,
        body: z.object({
          n: z.coerce.number(),
          x: z.coerce.string().optional(),
        }),
        response: z.object({
          n: z.number(),
          y: z.string().optional(),
        }),
        handler: async ({ body }) => ({ n: body.n, y: body.x, x: body.x }),
      });
    });

    it("POST / { n: 1 } Should succeed", async () => {
      const res = await request(app).post("/").send({ n: 1 }).expect(200);
      expect(res.body).to.deep.eq({ n: 1 });
    });

    it('POST / { n: 1, x: "x"  } Should succeed removing extra properties from response', async () => {
      const res = await request(app).post("/").send({ n: 1, x: "x", y: "y" }).expect(200);
      expect(res.body).to.deep.eq({ n: 1, y: "x" });
    });

    it('POST / { n: "a" } Should fail with status 400', async () => {
      await request(app).post("/").send({ n: "a" }).expect(400);
    });
  });

  describe("Headers", () => {
    beforeEach(() => {
      router.get("/", {
        auth: PUBLIC,
        headers: {
          n: z.coerce.number(),
        },
        response: z.object({
          n: z.number(),
          x: z.any(),
        }),
        handler: async ({ headers }) => headers,
      });
    });

    it("GET / { n: 1 } Should succeed", async () => {
      const res = await request(app).get("/").set({ n: "1" }).expect(200);
      expect(res.body).to.deep.eq({ n: 1 });
    });

    it('GET / { n: 1, x: "x"  } Should succeed removing extra properties from header', async () => {
      const res = await request(app).get("/").set({ n: "1", x: "x" }).expect(200);
      expect(res.body).to.deep.eq({ n: 1 });
    });

    it('GET / { n: "a" } Should fail with status 400', async () => {
      await request(app).get("/").set({ n: "a" }).expect(400);
    });

    it("GET / { } Should fail with status 400", async () => {
      await request(app).get("/").expect(400);
    });
  });

  describe("Api Errors", () => {
    it("Should fail with status 400 and code ERR_CODE", async () => {
      router.get("/", {
        auth: PUBLIC,
        errors: { ERR_CODE: "x" },
        response: z.string(),
        handler: async () => new ApiError("ERR_CODE"),
      });
      const res = await request(app).get("/").expect(400);
      expect(res.body).to.deep.contain({ code: "ERR_CODE" });
    });
  });

  describe("Timeout", () => {
    it("Should interrupt execution and fail with status 503 when handler times out", async () => {
      const routerWithTimeout = new Router(
        { nodeEnv: "production", handlerTimeoutMilliseconds: 1 },
        app,
        () => container(),
        () => mock<IRequestLogger>(),
        sessionProviderMock,
        () => async () => true
      );

      routerWithTimeout.get("/", {
        auth: PUBLIC,
        response: z.string(),
        handler: async () => {
          await new Promise((res) => setTimeout(res, 100));
          return "ok";
        },
      });
      const res = await request(app).get("/").expect(503);
      expect(res.body).to.not.equal("ok");
    });
  });

  describe("Misc", () => {
    it("Should mount in global path", async () => {
      const routerWithMountPath = new Router(
        { nodeEnv: "production", mountPath: "/api" },
        app,
        () => container(),
        () => mock<IRequestLogger>(),
        sessionProviderMock,
        () => async () => true
      );

      routerWithMountPath.get("/test", {
        auth: PUBLIC,
        handler: async () => {},
      });

      await request(app).get("/test").expect(404);
      await request(app).get("/api/test").expect(200);
    });
    it("Should fail when routing is ambiguous", async () => {
      let error;
      try {
        router.get("/:id", {
          auth: PUBLIC,
          params: {
            id: z.coerce.number(),
          },
          handler: async () => {},
        });
        router.get("/:id", {
          auth: PUBLIC,
          params: {
            id: z.string(),
          },
          handler: async () => {},
        });
      } catch (err) {
        error = err;
      }
      expect(error).instanceof(Error);
      expect((error as Error).message).to.eq("Ambiguous route: GET /:1");
    });

    it("Test service injection", async () => {
      const serviceRef = scoped.fn(() => "service");
      router.get("/", {
        auth: PUBLIC,
        services: {
          service: serviceRef,
        },
        response: z.string(),
        handler: async ({ services }) => services.service,
      });
      const res = await request(app).get("/").expect(200);
      expect(res.body).to.eq("service");
    });

    it("Test session middleware", async () => {
      router.get("/", {
        auth: PUBLIC,
        response: z
          .object({
            accessToken: z.string(),
            userId: z.string(),
            expiresOn: z.date().optional(),
          })
          .optional(),
        handler: async ({ session }) => session,
      });

      const fakeSession: ISession = {
        accessToken: "dummy-token",
        userId: "2",
        expiresOn: new Date(),
      };

      sessionProviderMock.mockReturnValue(fakeSession);

      const res = await request(app).get("/").set("Authorization", "dummy-token").expect(200);
      expect(res.body).to.deep.eq({
        accessToken: "dummy-token",
        userId: "2",
        expiresOn: fakeSession.expiresOn.toISOString(),
      });
    });
  });
});
