import { inspect } from "util";
import {
  z,
  ZodTypeAny,
  ZodObject,
  ZodFirstPartyTypeKind,
  ZodOptional,
  ZodTypeDef,
  ZodAnyDef,
  ZodEnumDef,
  ZodArray,
  ZodArrayDef,
} from "zod";

function pascalCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type TypeMetadata =
  | {
      kind: "simple";
      type: "String" | "double" | "bool" | "Datetime" | "dynamic";
      isOptional?: boolean;
    }
  | {
      kind: "list";
      itemType: TypeMetadata;
      isOptional?: boolean;
    }
  | {
      kind: "object";
      items: (TypeMetadata & { name: string })[];
      isOptional?: boolean;
    }
  | {
      kind: "enum";
      enumName: string;
      values: readonly string[];
      isOptional?: boolean;
    };

export function typeToDartString(type: TypeMetadata): string {
  switch (type.kind) {
    case "simple":
      return `${type.type}${type.isOptional ? "?" : ""}`;
    case "list":
      return `List<${typeToDartString(type.itemType)}>${type.isOptional ? "?" : ""}`;
    case "object":
      return `({${type.items.map((x) => `${typeToDartString(x)} ${x.name}`).join(", ")}})`;
    case "enum":
      return `${type.enumName}Enum`;
  }
}

export function extractDeclarations(type: TypeMetadata): string {
  switch (type.kind) {
    case "list":
      return extractDeclarations(type.itemType);
    case "object":
      return type.items.map((x) => extractDeclarations(x)).join("\n");
    case "enum":
      return `enum ${type.enumName}Enum { ${type.values.join(", ")} }`;
    default:
      return "";
  }
}

export function zodToDart(schema: ZodTypeAny, propertyPath: string[] = []): TypeMetadata {
  const typeDef = schema instanceof ZodOptional ? schema._def.innerType._def : schema._def;
  const kind = typeDef.typeName as ZodFirstPartyTypeKind;
  const isOptional = schema instanceof ZodOptional;

  switch (kind) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return { kind: "simple", type: "String", isOptional };
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return { kind: "simple", type: "double", isOptional };
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { kind: "simple", type: "bool", isOptional };
    case z.ZodFirstPartyTypeKind.ZodArray:
      return { kind: "list", itemType: zodToDart((typeDef as ZodArrayDef).type, propertyPath) };
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return {
        kind: "enum",
        enumName: propertyPath.map((x) => pascalCase(x)).join("_") ?? "UnnamedEnum",
        values: (typeDef as ZodEnumDef).values,
        isOptional,
      };
    case z.ZodFirstPartyTypeKind.ZodObject:
      const shape = (schema as ZodObject<any>).shape;

      return {
        kind: "object",
        isOptional,
        items: Object.keys(shape).map((key) => {
          let fieldSchema: ZodTypeAny = shape[key];
          return { name: key, ...zodToDart(fieldSchema, [...propertyPath, key]) };
        }),
      };
    default:
      return { kind: "simple", type: "dynamic", isOptional };
  }
}

// function generateEnum(name: string, values: string[], generated: GeneratedClass[]) {
//   const code = `enum ${name} { ${values.join(", ")} }`;
//   if (!generated.find((g) => g.name === name)) {
//     generated.push({ name, code });
//   }
// }
