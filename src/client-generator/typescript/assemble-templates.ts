import { ZodSchema } from "zod";
import { printNode, zodToTs } from "zod-to-ts";
import Handlebars, { HelperOptions } from "handlebars";
import { loadTextFile } from "../../utils.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function assembleTemplates() {
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
