import { JsonSchema } from '@nrwl/nx-dev/models-package';
import { slugify } from './slugify.utils';

interface ParameterMetadata {
  name: string;
  key: string;
  value: string;
}

export function getParameterMetadata(schema: JsonSchema): ParameterMetadata[] {
  const parameterMetadata: ParameterMetadata[] = [];
  if (typeof schema === 'boolean') return parameterMetadata;

  function createParameterMetadata(
    name: string,
    value: unknown
  ): ParameterMetadata {
    return {
      name,
      key: slugify(name),
      value: JSON.stringify(value).replace(/"/g, ''),
    };
  }

  if (schema.default !== undefined) {
    const def = schema.default;
    parameterMetadata.push(createParameterMetadata('Default', def));
  }

  if (schema.minItems !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Min items', schema.minItems)
    );
  }
  if (schema.maxItems !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Max items', schema.maxItems)
    );
  }
  if (typeof schema.uniqueItems !== 'undefined') {
    parameterMetadata.push(
      createParameterMetadata('Unique items', schema.uniqueItems)
    );
  }
  if (schema.minimum !== undefined) {
    const isExclusive =
      typeof schema.exclusiveMinimum === 'boolean' && schema.exclusiveMinimum;
    parameterMetadata.push(
      createParameterMetadata(
        isExclusive ? 'Exclusive minimum' : 'minimum',
        schema.minimum
      )
    );
  }
  if (schema.maximum !== undefined) {
    const isExclusive =
      typeof schema.exclusiveMaximum === 'boolean' && schema.exclusiveMaximum;
    parameterMetadata.push(
      createParameterMetadata(
        isExclusive ? 'Exclusive maximum' : 'maximum',
        schema.maximum
      )
    );
  }
  if (
    typeof schema.exclusiveMinimum === 'number' &&
    schema.minimum === undefined
  ) {
    parameterMetadata.push(
      createParameterMetadata('Exclusive minimum', schema.exclusiveMinimum)
    );
  }
  if (
    typeof schema.exclusiveMaximum === 'number' &&
    schema.maximum === undefined
  ) {
    parameterMetadata.push(
      createParameterMetadata('Exclusive maximum', schema.exclusiveMaximum)
    );
  }
  if (schema.multipleOf !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Multiple of', schema.multipleOf)
    );
  }
  if (schema.minProperties !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Min properties', schema.minProperties)
    );
  }
  if (schema.maxProperties !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Max properties', schema.maxProperties)
    );
  }
  if (schema.minLength !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Min length', schema.minLength)
    );
  }
  if (schema.maxLength !== undefined) {
    parameterMetadata.push(
      createParameterMetadata('Max length', schema.maxLength)
    );
  }
  if (typeof schema.pattern !== 'undefined') {
    parameterMetadata.push(createParameterMetadata('Pattern', schema.pattern));
  }
  if (typeof schema.format !== 'undefined') {
    parameterMetadata.push(createParameterMetadata('Format', schema.format));
  }

  return parameterMetadata;
}
