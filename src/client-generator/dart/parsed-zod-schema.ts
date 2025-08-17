import { inspect } from "util";
import { z, ZodTypeAny, ZodObject, ZodFirstPartyTypeKind, ZodOptional, ZodEnumDef, ZodArrayDef } from "zod";

function pascalCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type TypeMetadata =
  | {
      kind: "simple";
      type: "String" | "double" | "bool" | "DateTime" | "dynamic";
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
  public parsedSchema: TypeMetadata;

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
      case z.ZodFirstPartyTypeKind.ZodDate:
        return { kind: "simple", type: "DateTime", isOptional };
      case z.ZodFirstPartyTypeKind.ZodArray:
        return { kind: "list", itemType: this.parse((typeDef as ZodArrayDef).type, propertyPath) };
      case z.ZodFirstPartyTypeKind.ZodEnum:
        return {
          kind: "enum",
          enumName: propertyPath.map((x) => pascalCase(x)).join("_") ?? "Unnamed",
          values: (typeDef as ZodEnumDef).values,
          isOptional,
        };
      case z.ZodFirstPartyTypeKind.ZodObject:
        const shape = isOptional ? schema._def.innerType.shape : (schema as ZodObject<any>).shape;
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

  getDeclarations(enumPrefix: string): string {
    function _processNode(type: TypeMetadata): string {
      switch (type.kind) {
        case "list":
          return _processNode(type.itemType);
        case "object":
          return type.items.map((x) => _processNode(x)).join("\n");
        case "enum":
          return `enum ${enumPrefix}_${type.enumName}_Enum { ${type.values.join(", ")} }`;
        default:
          return "";
      }
    }
    return _processNode(this.parsedSchema);
  }

  getRecord(enumPrefix: string): string {
    function _processNode(type: TypeMetadata): string {
      switch (type.kind) {
        case "simple":
          return `${type.type}${type.isOptional ? "?" : ""}`;
        case "list":
          return `List<${_processNode(type.itemType)}>${type.isOptional ? "?" : ""}`;
        case "object":
          return `({${type.items.map((x) => `${_processNode(x)} ${x.name}`).join(", ")}})${type.isOptional ? "?" : ""}`;
        case "enum":
          return `${enumPrefix}_${type.enumName}_Enum`;
      }
    }
    return _processNode(this.parsedSchema);
  }

  hidrateFromMap(variable: string, enumPrefix: string): string {
    function _processNode(type: TypeMetadata, variable: string): string {
      switch (type.kind) {
        case "simple":
          switch (type.type) {
            case "String":
            case "dynamic":
              return `${variable}`;
            case "DateTime":
              return `DateTime.parse(${variable})`;
            case "double":
              return `double.parse(${variable})`;
            case "bool":
              return `bool.parse(${variable})`;
            default:
              throw new Error("Not implemented");
          }
        case "list":
          return `${variable}.map((x) => ${_processNode(type.itemType, "x")})`;
        case "object":
          return `(${type.items.map((x) => `${x.name}: ${_processNode(x, `${variable}['${x.name}']`)}`).join(",\n")})`;
        case "enum":
          return `${enumPrefix}_${type.enumName}_Enum.values.firstWhere((i) => i.name == ${variable})`;
      }
    }
    return _processNode(this.parsedSchema, variable);
  }

  toMap(variable: string): string {
    function _recordParser(type: TypeMetadata, variable: string): string {
      switch (type.kind) {
        case "simple":
          switch (type.type) {
            case "DateTime":
              return `${variable}${type.isOptional ? "?" : ""}.toIso8601String()`;
            default:
              return `${variable}`;
          }
        case "list":
          return `[${variable}.map((x) => ${_recordParser(type.itemType, "x")})]`;
        case "object":
          return `{${type.items.map((x) => `'${x.name}': ${_recordParser(x, `${variable}.${x.name}`)}`).join(",\n")}}`;
        case "enum":
          return `${variable}.name`;
      }
    }
    return _recordParser(this.parsedSchema, variable);
  }
}
