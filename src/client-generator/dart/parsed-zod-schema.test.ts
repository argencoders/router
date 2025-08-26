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

    expect(parsed.getDeclarations("prefix")).toContain("enum prefix_Pets_Color_Enum { red, green, blue }");
    expect(parsed.getDeclarations("prefix")).toContain("enum prefix_Book_Color_Enum { white, black }");
    expect(parsed.getRecord("prefix")).toContain(
      "({String? name, List<String> phones, List<({String name, double? age, prefix_Pets_Color_Enum color})> pets, ({prefix_Book_Color_Enum color}) book})"
    );
  });

  it("should handle optional objects", () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .optional();

    const parsed = new ParsedZodSchema(schema);

    expect(parsed.getRecord("")).toContain("({String name})?");
  });
});
