import { z } from "zod";
import { generateClient } from "./client-generator.js";
import { describe, expect, it } from "vitest";

describe("Client generator", () => {
  it.only("should generate Dart API client", () => {
    const generated = generateClient({
      className: "ApiClient",
      name: "ApiClientName",
      target: "dart",
      routes: [
        {
          method: "post",
          url: "/login",
          key: "POST /login",
          config: {
            body: z.object({
              email: z.string(),
              password: z.string(),
              rememberMe: z.boolean().optional(),
            }),
            response: z.object({
              accessToken: z.string(),
              userId: z.string(),
              expiresOn: z.date(),
            }),
            errors: {
              INCORRECT_EMAIL_OR_PASSWORD: "Incorrect email or password.",
            },
            async handler() {},
          },
        },
      ],
      version: "1.0",
    });

    console.log(generated);
  });

  it("should handle enums in response", () => {
    const generated = generateClient({
      className: "ApiClient",
      name: "ApiClientName",
      target: "dart",
      routes: [
        {
          method: "get",
          url: "/users",
          key: "GET /users",
          config: {
            response: z.object({
              userId: z.string(),
              name: z.string(),
              status: z.enum(["ACTIVE", "INACTIVE"]),
            }),
            errors: {},
            async handler() {},
          },
        },
      ],
      version: "1.0",
    });

    console.log(generated);
  });

  it("should handle enums in body", () => {
    const generated = generateClient({
      className: "ApiClient",
      name: "ApiClientName",
      target: "dart",
      routes: [
        {
          method: "post",
          url: "/users",
          key: "POST /users",
          config: {
            body: z.object({
              userId: z.string(),
              name: z.string(),
              status: z.enum(["ACTIVE", "INACTIVE"]),
            }),
            errors: {},
            async handler() {},
          },
        },
      ],
      version: "1.0",
    });

    console.log(generated);
  });

  it("should handle RPC methods", () => {
    const generated = generateClient({
      className: "ApiClient",
      name: "ApiClientName",
      target: "dart",
      routes: [
        {
          method: "rpc",
          url: "/forgot_password",
          key: "RPC /forgot_password",
          config: {
            body: z.object({
              email: z.string().min(1),
            }),
            errors: {
              EMAIL_NOT_REGISTERED: "Email not registered",
            },
            async handler() {},
          },
        },
      ],
      version: "1.0",
    });

    console.log(generated);
  });
});
