import { z, ZodTypeAny, ZodObject, ZodFirstPartyTypeKind, ZodOptional, ZodEnumDef, ZodArrayDef } from "zod";

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

export class ParsedZodSchema {
  private parsedSchema: TypeMetadata;

  constructor(schema: ZodTypeAny) {
    this.parsedSchema = this.parse(schema);
  }

  private parse(schema: ZodTypeAny, propertyPath: string[] = []): TypeMetadata {
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
        return { kind: "list", itemType: this.parse((typeDef as ZodArrayDef).type, propertyPath) };
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
            return { name: key, ...this.parse(fieldSchema, [...propertyPath, key]) };
          }),
        };
      default:
        return { kind: "simple", type: "dynamic", isOptional };
    }
  }

  getDeclarations(): string {
    function _declarations(type: TypeMetadata): string {
      switch (type.kind) {
        case "list":
          return _declarations(type.itemType);
        case "object":
          return type.items.map((x) => _declarations(x)).join("\n");
        case "enum":
          return `enum ${type.enumName}Enum { ${type.values.join(", ")} }`;
        default:
          return "";
      }
    }
    return _declarations(this.parsedSchema);
  }

  getRecord(): string {
    function _record(type: TypeMetadata): string {
      switch (type.kind) {
        case "simple":
          return `${type.type}${type.isOptional ? "?" : ""}`;
        case "list":
          return `List<${_record(type.itemType)}>${type.isOptional ? "?" : ""}`;
        case "object":
          return `({${type.items.map((x) => `${_record(x)} ${x.name}`).join(", ")}})`;
        case "enum":
          return `${type.enumName}Enum`;
      }
    }
    return _record(this.parsedSchema);
  }
}
