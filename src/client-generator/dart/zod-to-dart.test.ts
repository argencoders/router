import { describe, it } from "vitest";
import { z } from "zod";
import { extractDeclarations, typeToDartString, zodToDart } from "./zod-to-dart";
import { inspect } from "util";

describe("Zod to Dart", () => {
  it.only("should generate Dart class from zod schema", () => {
    const schema = z.object({
      name: z.string().optional(),
      phones: z.array(z.string()),
      pets: z.array(
        z.object({ name: z.string(), age: z.number().optional(), color: z.enum(["red", "green", "blue"]) })
      ),
      book: z.object({ color: z.enum(["white", "black"]) }),
    });

    const dart = zodToDart(schema);
    console.log(inspect(dart, undefined, 15));
    console.log(extractDeclarations(dart));
    console.log(typeToDartString(dart));
  });
});
