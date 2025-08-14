import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ParsedZodSchema } from "./parsed-zod-schema";

describe("Zod to Dart", () => {
  it("should generate Dart class from zod schema", () => {
    const schema = z.object({
      name: z.string().optional(),
      phones: z.array(z.string()),
      pets: z.array(
        z.object({ name: z.string(), age: z.number().optional(), color: z.enum(["red", "green", "blue"]) })
      ),
      book: z.object({ color: z.enum(["white", "black"]) }),
    });

    const parsed = new ParsedZodSchema(schema);

    expect(parsed.getDeclarations()).toContain("enum Pets_ColorEnum { red, green, blue }");
    expect(parsed.getDeclarations()).toContain("enum Book_ColorEnum { white, black }");
    expect(parsed.getRecord()).toContain(
      "({String? name, List<String> phones, List<({String name, double? age, Pets_ColorEnum color})> pets, ({Book_ColorEnum color}) book})"
    );
  });

  it("should handle optional objects", () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .optional();

    const parsed = new ParsedZodSchema(schema);

    expect(parsed.getRecord()).toContain("({String name})?");
  });
});
