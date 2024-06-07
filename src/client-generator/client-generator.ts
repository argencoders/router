import { ZodSchema } from "zod";
import { printNode, zodToTs } from "zod-to-ts";
import { AnyRoute } from "../types.js";
import Handlebars, { HelperOptions } from "handlebars";
import { loadTextFile } from "../utils.js";

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function assembleTemplates() {
  Handlebars.registerHelper("uppercase", (text: string) => {
    return text.toUpperCase();
  });

  Handlebars.registerHelper("coalesce", (arg1: unknown, arg2: unknown) => {
    return arg1 ?? arg2;
  });

  Handlebars.registerHelper("zod", (schema?: ZodSchema) => {
    return new Handlebars.SafeString(schema ? printNode(zodToTs(schema).node) : "undefined");
  });

  Handlebars.registerHelper("recordOfZod", (schema?: Record<string, ZodSchema>) => {
    if (!schema) return "undefined";
    const items = Object.keys(schema).map((key) => {
      const schemaOfKey = schema[key];
      return `'${key}'${schemaOfKey.isOptional() ? "?" : ""}: ${printNode(zodToTs(schemaOfKey).node)}`;
    });
    return new Handlebars.SafeString(`{${items.join(",")}}`);
  });

  Handlebars.registerHelper("url2Template", (url: string) => {
    return new Handlebars.SafeString(
      url
        .split("/")
        .map((x) => (x[0] === ":" ? `\${args.params['${x.substring(1)}']}` : x))
        .join("/")
    );
  });

  Handlebars.registerHelper("docs", function (this: unknown, options: HelperOptions) {
    const lines = options
      .fn(this)
      .split("\n")
      .filter((x) => x.trim() !== "")
      .map((x) => ` * ${x.trimStart()}`);
    if (lines.length === 0) return;
    return new Handlebars.SafeString(["/**", ...lines, " */\n"].join("\n"));
  });

  Handlebars.registerPartial("utils", loadTextFile(resolve(__dirname, "./templates/utils.hbs")));
  Handlebars.registerPartial("method", loadTextFile(resolve(__dirname, "./templates/method.hbs")));
  Handlebars.registerPartial("request", loadTextFile(resolve(__dirname, "./templates/request.hbs")));
  return Handlebars.compile(loadTextFile(resolve(__dirname, "./templates/main.hbs")));
}

export function generateClient(opts: { name: string; className: string; routes: AnyRoute[]; version: string }): string {
  const template = assembleTemplates();
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
