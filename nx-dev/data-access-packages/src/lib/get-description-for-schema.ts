import { JsonSchema } from '@nrwl/nx-dev/models-package';

export function getDescriptionForSchema(schema: JsonSchema): string {
  if (typeof schema === 'boolean') {
    return schema
      ? 'Anything is allowed here.'
      : 'There is no valid value for this property.';
  }
  if (Object.keys(schema).length === 0) {
    return 'Anything is allowed here.';
  }
  return schema.description ?? 'No description available.';
}
