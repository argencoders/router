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
});
