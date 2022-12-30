import { JsonSchema, JsonSchema1 } from '@nrwl/nx-dev/models-package';
import { get as pointerGet } from 'jsonpointer';

/**
 * @param reference '#' is root
 * @param lookup Instantiated Lookup class
 */
export function getSchemaFromReference(
  reference: string,
  lookup: Lookup
): JsonSchema | undefined {
  return getSchemaFromResult(loadReference(reference, lookup));
}

export function loadReference(reference: string, lookup: Lookup): LookupResult {
  return lookup.getSchema({ $ref: reference });
}

export function getSchemaFromResult(
  result: LookupResult
): JsonSchema | undefined {
  return result === undefined ? undefined : result.schema;
}

export type LookupResult =
  | undefined
  | {
      schema: JsonSchema;
      baseReference?: string;
    };

function isReference(s: JsonSchema1): boolean {
  return s.$ref !== undefined;
}

export interface Lookup {
  getSchema: (schema: JsonSchema) => LookupResult;
}

export class IdLookup {
  getSchema(schema: JsonSchema): LookupResult {
    if (typeof schema === 'boolean') {
      return { schema };
    }

    if (isReference(schema)) {
      return undefined;
    }

    return { schema };
  }
}

export class InternalLookup {
  constructor(private schema: JsonSchema) {}

  getSchema(schema: JsonSchema): LookupResult {
    if (schema === undefined) {
      return undefined;
    }

    if (typeof schema === 'boolean') return { schema };

    if (schema.$ref === undefined) return { schema };

    const ref = schema.$ref;
    if (!ref.startsWith('#')) {
      // We do not support non-internal references
      console.error(
        '[SCHEMA] The schema appears to have non-internal references which is not supported:',
        ref
      );
      return undefined;
    }

    const result = pointerGet(this.schema, ref.slice(1));
    if (result === undefined) return undefined;

    const subResult = this.getSchema(result);
    if (subResult === undefined) return undefined;

    return {
      schema: subResult.schema,
      baseReference: subResult.baseReference ?? ref,
    };
  }
}
