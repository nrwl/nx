import { deepCopy, json, schema } from '@angular-devkit/core';
import { visitJsonSchema } from '@angular-devkit/core/src/json/schema';
import * as Ajv from 'ajv';
import * as Url from 'url';

export interface SchemaFlattener {
  flatten: (schema) => json.JsonObject;
}

function _resolver(
  ref: string,
  validate?: Ajv.ValidateFunction
): { context?: Ajv.ValidateFunction; schema?: json.JsonObject } {
  if (!validate || !ref) {
    return {};
  }

  const schema = (validate as any).schemaEnv.root.schema;
  const id = typeof schema === 'object' ? schema.$id : null;

  let fullReference = ref;
  if (typeof id === 'string') {
    fullReference = Url.resolve(id, ref);

    if (ref.startsWith('#')) {
      fullReference = id + fullReference;
    }
  }

  if (fullReference.startsWith('#')) {
    fullReference = fullReference.slice(0, -1);
  }
  const resolvedSchema = this._ajv.getSchema(fullReference);

  return {
    context: resolvedSchema?.schemaEnv.validate,
    schema: resolvedSchema?.schema as json.JsonObject,
  };
}

export function createSchemaFlattener(
  formats: schema.SchemaFormat[] = []
): SchemaFlattener {
  const ajv = new Ajv({ passContext: true });
  for (const format of formats) {
    ajv.addFormat(format.name, format.formatter as any);
  }
  return {
    flatten: function (schema) {
      const validate = ajv.removeSchema(schema).compile(schema);
      function visitor(current, pointer, parentSchema, index) {
        if (
          current &&
          parentSchema &&
          index &&
          json.isJsonObject(current) &&
          current.hasOwnProperty('$ref') &&
          typeof current['$ref'] == 'string'
        ) {
          const resolved = _resolver(current['$ref'], validate);
          if (resolved.schema) {
            parentSchema[index] = resolved.schema;
          }
        }
      }
      const schemaCopy = deepCopy(validate.schema) as json.JsonObject;
      visitJsonSchema(schemaCopy, visitor);
      return schemaCopy;
    },
  };
}
