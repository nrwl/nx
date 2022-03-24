import { JsonSchema1 } from '@nrwl/nx-dev/models-package';

export function getTitleForSchema(
  reference: string,
  schema: JsonSchema1
): string | undefined {
  if (schema.title !== undefined) {
    return schema.title;
  }

  const rs = reference.split('/');
  const last = rs[rs.length - 1];
  const secondLast = rs[rs.length - 2];
  const thirdLast = rs[rs.length - 3];
  if (['properties', 'definitions'].includes(secondLast)) {
    return last;
  } else if (last === 'additionalProperties') {
    return '(Additional properties)';
  } else if (
    last === 'items' &&
    ['properties', 'definitions'].includes(thirdLast)
  ) {
    return secondLast + ' items';
  }

  return undefined;
}
