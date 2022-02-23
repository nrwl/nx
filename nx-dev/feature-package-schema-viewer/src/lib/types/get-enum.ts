import { getSchemaFromResult, Lookup } from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema, JsonSchema1 } from '@nrwl/nx-dev/models-package';
import { getTypesFromEnum, isPrimitiveType } from './type-inference';

function extractEnumDirectly(schema?: JsonSchema): JsonSchema1['enum'] {
  if (schema === undefined || typeof schema === 'boolean') {
    return undefined;
  }

  if (schema.enum !== undefined) {
    const enumTypes = getTypesFromEnum(schema.enum);
    if (enumTypes !== undefined && isPrimitiveType(enumTypes)) {
      return schema.enum;
    }
  }

  return undefined;
}

function extractArrayEnum(
  schema: JsonSchema,
  lookup: Lookup
): JsonSchema1['enum'] {
  if (
    typeof schema !== 'boolean' &&
    schema.type === 'array' &&
    schema.items !== undefined &&
    !Array.isArray(schema.items)
  ) {
    return extractEnumDirectly(
      getSchemaFromResult(lookup.getSchema(schema.items))
    );
  }
  return undefined;
}

function runUntilFirstResult<A, B>(
  inputFunctions: ((a: A) => B | undefined)[],
  value: A
): B | undefined {
  for (let i = 0; i < inputFunctions.length; i++) {
    const potentialResult = inputFunctions[i](value);
    if (typeof potentialResult !== 'undefined') {
      return potentialResult;
    }
  }

  return undefined;
}

export function getEnum(
  schema: JsonSchema,
  lookup: Lookup
): JsonSchema1['enum'] {
  const extractors: ((s: JsonSchema) => JsonSchema1['enum'])[] = [
    extractEnumDirectly,
    (s) => extractArrayEnum(s, lookup),
  ];

  return runUntilFirstResult(extractors, schema);
}
