import { ZodSchema } from "zod";
import { AnyRoute } from "../types.js";
import assembleTemplatesTypescript from "./typescript/assemble-templates.js";
import assembleTemplatesDart from "./dart/assemble-templates.js";

type ApiClient = {
  name: string;
  version: string;
  className: string;
  methods: {
    title?: string;
    description?: string;
    section?: string;
    tags?: string[];
    deprecated: boolean;
    deprecationMessage?: string;
    methodName: string;
    url: string;
    httpMethod: "get" | "post" | "put" | "delete";
    isRPC: boolean;
    arguments?: {
      params?: Record<string, ZodSchema>;
      query?: Record<string, ZodSchema>;
      body?: ZodSchema;
      headers?: Record<string, ZodSchema>;
    };
    errors?: Record<string, string>;
    returnType?: ZodSchema;
  }[];
};

export function generateClient(opts: {
  name: string;
  target: "typescript" | "dart";
  className: string;
  routes: AnyRoute[];
  version: string;
}): string {
  const template = opts.target === "typescript" ? assembleTemplatesTypescript() : assembleTemplatesDart();
  const apiClient: ApiClient = {
    name: opts.name,
    className: opts.className,
    version: opts.version,
    methods: opts.routes.map((route) => {
      const cfg = route.config;
      return {
        url: route.url,
        httpMethod: route.method === "rpc" ? "post" : route.method,
        isRPC: route.method === "rpc",
        methodName: `${route.method.toUpperCase()} ${route.url}`,
        title: cfg.title,
        description: cfg.description,
        section: cfg.section,
        tags: cfg.tags,
        deprecated: !!cfg.deprecated,
        deprecationMessage: typeof cfg.deprecated === "string" ? cfg.deprecated : undefined,
        arguments:
          cfg.params || cfg.query || cfg.headers || cfg.body
            ? {
                params: cfg.params,
                query: cfg.query,
                headers: cfg.headers,
                body: cfg.body,
              }
            : undefined,
        errors: cfg.errors,
        returnType: cfg.response,
      };
    }),
  };
  return template(apiClient);
}
