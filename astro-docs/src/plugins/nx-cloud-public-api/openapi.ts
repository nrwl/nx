import { code, referenceTable } from './formatting';
import type { OpenApiDocument, OpenApiObject, ReferenceTable } from './types';

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

export function object(value: unknown): OpenApiObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as OpenApiObject)
    : {};
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseOpenApiDocument(value: unknown): OpenApiDocument {
  const document = object(value);
  const info = object(document.info);
  if (
    !text(document.openapi).startsWith('3.') ||
    !text(info.title) ||
    !text(info.version) ||
    !document.paths ||
    Array.isArray(document.paths) ||
    typeof document.paths !== 'object'
  ) {
    throw new Error(
      'Expected an OpenAPI 3 document with info.title, info.version, and paths.'
    );
  }
  for (const [path, item] of Object.entries(object(document.paths))) {
    if (
      !path.startsWith('/') ||
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      throw new Error(`Invalid OpenAPI path: ${path}.`);
    }
  }
  return document as OpenApiDocument;
}

function localReferenceSegments(ref: string): string[] {
  if (!ref.startsWith('#')) {
    throw new Error(`Unsupported or circular OpenAPI reference: ${ref}.`);
  }
  // Decode the URI fragment before splitting and decoding JSON Pointer tokens.
  const pointer = decodeURIComponent(ref.slice(1));
  if (!pointer.startsWith('/')) {
    throw new Error(`Unsupported or circular OpenAPI reference: ${ref}.`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Resolve local JSON pointers. Schemas retain their references to avoid recursive expansion. */
export function resolve(
  document: OpenApiDocument,
  value: unknown,
  seen = new Set<string>()
): OpenApiObject {
  const entry = object(value);
  if (!entry.$ref) return entry;
  const ref = text(entry.$ref);
  if (seen.has(ref)) {
    throw new Error(`Unsupported or circular OpenAPI reference: ${ref}.`);
  }
  let target: unknown = document;
  for (const key of localReferenceSegments(ref)) {
    target =
      target && typeof target === 'object' && Object.hasOwn(target, key)
        ? (target as OpenApiObject)[key]
        : undefined;
  }
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error(`Missing OpenAPI reference: ${ref}.`);
  }
  return {
    ...resolve(document, target, new Set([...seen, ref])),
    ...Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== '$ref')
    ),
  };
}

export function schemaName(ref: unknown): string {
  const parts = localReferenceSegments(text(ref));
  return (
    (parts[0] === 'components' && parts[1] === 'schemas'
      ? parts[2]
      : parts.at(-1)) ?? ''
  );
}

export function schemaLabel(document: OpenApiDocument, name: string): string {
  const schema = object(object(object(document.components).schemas)[name]);
  return text(schema.title) || name;
}

export function schemaType(
  document: OpenApiDocument,
  value: unknown,
  arraySuffix = ''
): string {
  if (typeof value === 'boolean')
    return `${value ? 'Any value' : 'No value'}${arraySuffix}`;
  const schema = object(value);
  const union = array(schema.oneOf).length
    ? array(schema.oneOf)
    : array(schema.anyOf);
  if (
    arraySuffix &&
    (union.length ||
      schema.allOf ||
      schema.nullable ||
      array(schema.type).length ||
      schema.additionalProperties)
  )
    return `(${schemaType(document, value)})${arraySuffix}`;
  let type: string;
  if (schema.$ref) {
    // Validate the target but do not expand the schema graph.
    resolve(document, schema);
    const name = schemaName(schema.$ref);
    type = `[${code(`${schemaLabel(document, name)}${arraySuffix}`)}](#${encodeURIComponent(`schema-${name}`)})`;
  } else if (union.length) {
    type = union.map((value) => schemaType(document, value)).join(' or ');
  } else if (schema.allOf) {
    type = array(schema.allOf)
      .map((value) => schemaType(document, value))
      .join(' and ');
  } else {
    const types = array(schema.type).length
      ? array(schema.type).map(String)
      : [
          text(schema.type) ||
            (schema.properties || schema.additionalProperties
              ? 'object'
              : 'any'),
        ];
    type = types
      .map((type) => {
        if (type === 'array')
          return schemaType(document, schema.items, `${arraySuffix}[]`);
        if (type === 'object' && schema.additionalProperties) {
          return `Dictionary of ${schemaType(document, schema.additionalProperties)}`;
        }
        return code(`${type}${arraySuffix}`);
      })
      .join(' or ');
  }
  if (schema.format) type += ` (${code(schema.format)})`;
  if (
    schema.nullable &&
    !array(schema.type).includes('null') &&
    schema.type !== 'null'
  )
    type += ' or `null`';
  return type;
}

export function constraints(value: unknown): string {
  const schema = object(value);
  const parts: string[] = [];
  if (schema.enum)
    parts.push(`Allowed: ${array(schema.enum).map(code).join(', ')}.`);
  if ('const' in schema)
    parts.push(`Value: ${code(JSON.stringify(schema.const))}.`);
  if ('default' in schema)
    parts.push(`Default: ${code(JSON.stringify(schema.default))}.`);
  for (const key of [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'pattern',
    'uniqueItems',
    'multipleOf',
    'minProperties',
    'maxProperties',
  ]) {
    if (key in schema) parts.push(`${key}: ${code(schema[key])}.`);
  }
  if ('example' in schema)
    parts.push(`Example: ${code(JSON.stringify(schema.example))}.`);
  if (schema.examples)
    parts.push(
      `Examples: ${array(schema.examples)
        .map((value) => code(JSON.stringify(value)))
        .join(', ')}.`
    );
  if (schema.readOnly) parts.push('Read-only.');
  if (schema.writeOnly) parts.push('Write-only.');
  if (schema.deprecated) parts.push('Deprecated.');
  const items = constraintsForChild(schema.items);
  if (items) parts.push(`Items: ${items}`);
  const values = constraintsForChild(schema.additionalProperties);
  if (values) parts.push(`Dictionary values: ${values}`);
  return parts.join(' ');
}

function constraintsForChild(value: unknown): string {
  return value && typeof value === 'object' ? constraints(value) : '';
}

export function openApiOperations(document: OpenApiDocument) {
  return Object.entries(document.paths).flatMap(([path, pathItem]) => {
    const item = resolve(document, pathItem);
    return Object.entries(item)
      .filter(([method]) => HTTP_METHODS.has(method))
      .map(([method, value]) => ({
        path,
        method,
        operation: resolve(document, value),
        parameters: array(item.parameters),
      }));
  });
}

export function schemaFields(
  document: OpenApiDocument,
  value: unknown,
  anchorPrefix?: string
): ReferenceTable {
  const rows: { required: boolean; cells: string[] }[] = [];
  const requiredProperties = (
    value: unknown,
    seen = new Set<string>()
  ): unknown[] => {
    const schema = object(value);
    const ref = text(schema.$ref);
    if (ref) {
      if (seen.has(ref)) return [];
      return requiredProperties(
        resolve(document, schema),
        new Set([...seen, ref])
      );
    }
    return [
      ...array(schema.required),
      ...array(schema.allOf).flatMap((child) =>
        requiredProperties(child, seen)
      ),
    ];
  };
  const visit = (
    value: unknown,
    prefix = '',
    inheritedRequired: unknown[] = []
  ) => {
    const schema = object(value);
    if (schema.$ref) return;
    const required = new Set([
      ...inheritedRequired,
      ...requiredProperties(schema),
    ]);
    for (const [name, raw] of Object.entries(object(schema.properties))) {
      const field = object(raw);
      const path = prefix ? `${prefix}.${name}` : name;
      rows.push({
        required: required.has(name),
        cells: [
          code(path),
          schemaType(document, raw),
          [text(field.description), constraints(raw)].filter(Boolean).join(' '),
        ],
      });
      visit(raw, path);
    }
    if (schema.items) visit(schema.items, `${prefix}[]`);
    if (typeof schema.additionalProperties === 'object')
      visit(schema.additionalProperties, `${prefix}.*`);
    for (const key of ['allOf', 'oneOf', 'anyOf']) {
      for (const child of array(schema[key]))
        visit(child, prefix, [...required]);
    }
  };
  visit(value);
  return referenceTable(
    ['Property', 'Type', 'Description'],
    rows,
    anchorPrefix
  );
}
