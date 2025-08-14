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
          method: "get",
          url: "/users",
          key: "GET /users",
          config: {
            params: {
              search: z.string(),
              page: z.number().optional(),
              order: z.enum(["ascending", "descending"]),
            },
            response: z.object({
              name: z.string(),
            }),
            async handler() {},
          },
        },
      ],
      version: "1.0",
    });

    console.log(generated);
  });
});
