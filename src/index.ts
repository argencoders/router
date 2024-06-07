import Router from "./router.js";
import ApiError from "./api-error.js";
import { ISession, PUBLIC } from "./types.js";
export * from "./http-errors.js";

// TODO: poner en un sólo lugar
// Para extender z con el método openapi, debe hacerse una sóla vez en todo el programa
// https://github.com/asteasolutions/zod-to-openapi#the-openapi-method
// es obligado porque sino falla cuando intenta generar params, query y headers
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
extendZodWithOpenApi(z);

export { z };

export { Router, ApiError, ISession, PUBLIC };
export { generateClient } from "./client-generator/client-generator.js";
