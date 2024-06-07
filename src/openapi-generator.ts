import { OpenAPIRegistry, OpenApiGeneratorV3, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { AnyRoute, PUBLIC } from "./types.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
extendZodWithOpenApi(z);

export type OpenApiOptions = {
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
      identifier?: string;
    };
  };
  components?: {
    securitySchemes?: Record<
      string,
      {
        type: "apiKey" | "http" | "oauth2" | "openIdConnect";
        description?: string;
        name?: string;
        in?: string;
        scheme?: string;
      }
    >;
  };
  // sections: Record<string, string>;
};

export function generateOpenApi(options: OpenApiOptions, routes: AnyRoute[]) {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "Authorization", {
    name: "Authorization",
    type: "http",
    scheme: "bearer",
    in: "header",
  });

  routes.forEach((route) => {
    const path: RouteConfig = {
      summary: route.config.title,
      description: route.config.description,
      deprecated: route.config.deprecated ? true : undefined,
      tags: [route.config.section ?? "==="],
      method: route.method === "rpc" ? "post" : route.method,
      path: url2path(route.url),
      security: route.config.auth === PUBLIC ? undefined : [{ Authorization: [] }],
      request: {
        params: route.config.params ? z.object(route.config.params) : undefined,
        query: route.config.query ? z.object(route.config.query) : undefined,
        headers: route.config.headers ? z.object(route.config.headers) : undefined,
        body: route.config.body
          ? {
              content: {
                "application/json": {
                  schema: route.config.body,
                },
              },
            }
          : undefined,
      },
      responses: {
        200: {
          description: "Ok",
          content: route.config.response
            ? {
                "application/json": {
                  schema: route.config.response,
                },
              }
            : undefined,
        },
      },
    };

    if (route.config.errors) {
      const errors = route.config.errors;
      path.responses[400] = {
        description: [
          "Bad request",
          `|code|description|`, //
          `|---|---|`,
          ...Object.keys(errors).map((code) => `|${code}|${errors[code]}|`),
        ].join("\n"),
        content: {
          "application/json": {
            schema: z.object({
              code: z.string(),
              message: z.string(),
            }),
          },
        },
      };
    }
    if (route.config.auth !== PUBLIC) {
      path.responses[401] = {
        description: "Not authorized",
      };
    }
    registry.registerPath(path);
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: options.info,
  });
}

function url2path(url: string) {
  return url
    .split("/")
    .map((x) => (x[0] === ":" ? `{${x.substring(1)}}` : x))
    .join("/");
}
