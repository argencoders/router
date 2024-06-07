import { OpenApiOptions, generateOpenApi } from "../openapi-generator.js";
import Handlebars from "handlebars";
import { AnyRoute } from "../types.js";
import { loadTextFile } from "../utils.js";

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class ApiDocs {
  private readonly template: HandlebarsTemplateDelegate<{ schema: string }>;
  constructor(private readonly options: OpenApiOptions, private readonly routes: AnyRoute[]) {
    this.template = Handlebars.compile(loadTextFile(resolve(__dirname, "./api-docs.hbs")));
  }

  schema() {
    return generateOpenApi(this.options, this.routes);
  }

  html() {
    return this.template({ schema: JSON.stringify(this.schema()) });
  }
}
