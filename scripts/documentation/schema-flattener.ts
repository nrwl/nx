import { deepCopy, json, schema } from '@angular-devkit/core';
import { visitJsonSchema } from '@angular-devkit/core/src/json/schema';
import * as Ajv from 'ajv';

export interface SchemaFlattener {
  flatten: (schema) => json.JsonObject;
}

export function createSchemaFlattener(
  formats: schema.SchemaFormat[] = []
): SchemaFlattener {
  const ajv = new Ajv();
  for (const format of formats) {
    ajv.addFormat(format.name, format.formatter as any);
  }
  return {
    flatten: (schema) => {
      const validate = ajv.removeSchema(schema).compile(schema);
      const self = this;
      function visitor(current, pointer, parentSchema, index) {
        if (
          current &&
          parentSchema &&
          index &&
          json.isJsonObject(current) &&
          current.hasOwnProperty('$ref') &&
          typeof current['$ref'] == 'string'
        ) {
          const resolved = self._resolver(current['$ref'], validate);
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
