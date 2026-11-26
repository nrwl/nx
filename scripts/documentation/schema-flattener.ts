import { json } from '@angular-devkit/core';

export interface SchemaFlattener {
  flatten: (schema: json.JsonObject) => json.JsonObject;
}
