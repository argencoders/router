import { z, ZodSchema } from "zod";
import Handlebars, { HelperOptions } from "handlebars";
import { loadTextFile } from "../../utils.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ParsedZodSchema } from "./parsed-zod-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function assembleTemplates() {
  Handlebars.registerHelper("uppercase", (text: string) => {
    return text.toUpperCase();
  });

  Handlebars.registerHelper("lowercase", (text: string) => {
    return text.toLowerCase();
  });

  Handlebars.registerHelper("coalesce", (arg1: unknown, arg2: unknown) => {
    return arg1 ?? arg2;
  });

  Handlebars.registerHelper("concat", (...args: unknown[]) => {
    return args.splice(0, args.length - 1).join("_");
  });

  Handlebars.registerHelper("url2Template", (url: string) => {
    return new Handlebars.SafeString(
      url
        .split("/")
        .map((x) => (x[0] === ":" ? `\${params.${x.substring(1)}}` : x))
        .join("/")
    );
  });

  Handlebars.registerHelper("zodDeclarations", (prefix: string, schema?: ZodSchema) => {
    if (!schema) return "";
    const wrapped = schema instanceof ZodSchema ? schema : z.object(schema);
    return new Handlebars.SafeString(new ParsedZodSchema(wrapped).getDeclarations(prefix));
  });

  Handlebars.registerHelper("zodRecord", (prefix: string, schema?: ZodSchema | Record<string, ZodSchema>) => {
    if (!schema) return "void";
    const wrapped = schema instanceof ZodSchema ? schema : z.object(schema);
    return new Handlebars.SafeString(new ParsedZodSchema(wrapped).getRecord(prefix));
  });

  Handlebars.registerHelper(
    "hidrateFromMap",
    (variable: string, prefix: string, schema?: Record<string, ZodSchema>) => {
      if (!schema) return "null";
      const wrapped = schema instanceof ZodSchema ? schema : z.object(schema);
      return new Handlebars.SafeString(new ParsedZodSchema(wrapped).hidrateFromMap(variable, prefix));
    }
  );

  Handlebars.registerHelper("toMap", (variable: string, schema?: Record<string, ZodSchema>) => {
    if (!schema) return "null";
    const wrapped = schema instanceof ZodSchema ? schema : z.object(schema);
    return new Handlebars.SafeString(new ParsedZodSchema(wrapped).toMap(variable));
  });

  Handlebars.registerHelper("docs", function (this: unknown, options: HelperOptions) {
    const lines = options
      .fn(this)
      .split("\n")
      .filter((x) => x.trim() !== "")
      .map((x) => `/// ${x.trimStart()}`);
    if (lines.length === 0) return;
    return new Handlebars.SafeString(lines.join("\n"));
  });

  Handlebars.registerPartial("utils", loadTextFile(resolve(__dirname, "./templates/utils.hbs")));
  Handlebars.registerPartial("declaration", loadTextFile(resolve(__dirname, "./templates/declaration.hbs")));
  Handlebars.registerPartial("error", loadTextFile(resolve(__dirname, "./templates/error.hbs")));
  Handlebars.registerPartial("method", loadTextFile(resolve(__dirname, "./templates/method.hbs")));
  Handlebars.registerPartial("request", loadTextFile(resolve(__dirname, "./templates/request.hbs")));
  return Handlebars.compile(loadTextFile(resolve(__dirname, "./templates/main.hbs")));
}
