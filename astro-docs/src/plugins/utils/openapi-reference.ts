import { STATUS_CODES } from 'node:http';
import GithubSlugger from 'github-slugger';

export const NX_CLOUD_PUBLIC_API_SPEC_URL =
  'https://cloud.nx.app/nx-cloud/data/openapi.json';

/** Markdown is the source for rich prose; the loader renders each fragment once. */
export interface ReferenceProse {
  markdown: string;
  html: string;
}

export interface ReferenceTable {
  columns: string[];
  rows: ReferenceProse[][];
}

export interface ReferenceHeading {
  depth: 2 | 3 | 4;
  slug: string;
  text: string;
}

export interface ReferenceExample {
  label: string;
  description: ReferenceProse;
  code?: string;
  language: string;
  url?: string;
}

export interface ReferenceMedia {
  mediaType: string;
  schema: ReferenceProse;
  description: ReferenceProse;
  fields: ReferenceTable;
  definition?: string;
  fieldTarget?: string;
  examples: ReferenceExample[];
}

export interface ReferenceResponse {
  id: string;
  label: string;
  description: ReferenceProse;
  content: ReferenceMedia[];
  headers: { name: string; target: string }[];
  links?: string;
}

export interface ReferenceEndpoint {
  heading: ReferenceHeading;
  method: string;
  path: string;
  description: ReferenceProse;
  deprecated: boolean;
  authentication?: ReferenceProse;
  parameters: ReferenceTable;
  parameterDetails: { name: string; content: ReferenceMedia[] }[];
  requestBody?: {
    required: boolean;
    description: ReferenceProse;
    content: ReferenceMedia[];
  };
  successes: ReferenceResponse[];
  otherResponses: { status: string; label: string; target: string }[];
}

export interface OpenApiReference {
  sourceUrl: string;
  title: string;
  version: string;
  introduction: ReferenceProse;
  description: ReferenceProse;
  navigation: {
    heading: ReferenceHeading;
    links: { label: string; href: string; id?: string }[];
  }[];
  servers: ReferenceProse[];
  sections: {
    servers: ReferenceHeading;
    endpoints: ReferenceHeading;
    responses: ReferenceHeading;
    headers: ReferenceHeading;
    schemas: ReferenceHeading;
  };
  endpoints: ReferenceEndpoint[];
  responses: {
    heading: ReferenceHeading;
    definitions: {
      response: ReferenceResponse;
      descriptions: { ids: string[]; description: ReferenceProse }[];
    }[];
  }[];
  headers: {
    heading: ReferenceHeading;
    description: ReferenceProse;
    schema: ReferenceProse;
    fields: ReferenceTable;
    content: ReferenceMedia[];
    statuses: string[];
  }[];
  schemas: {
    heading: ReferenceHeading;
    description: ReferenceProse;
    type: ReferenceProse;
    fields: ReferenceTable;
    definition: string;
  }[];
}

function prose(markdown: string): ReferenceProse {
  return { markdown, html: '' };
}

function referenceTable(columns: string[], rows: string[][]): ReferenceTable {
  return { columns, rows: rows.map((row) => row.map(prose)) };
}

export type OpenApiObject = Record<string, unknown>;

export interface OpenApiDocument extends OpenApiObject {
  openapi: string;
  info: OpenApiObject & { title: string; version: string };
  paths: Record<string, OpenApiObject>;
}

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

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function array(value: unknown): unknown[] {
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

/** Resolve local JSON pointers. Schemas retain their references to avoid recursive expansion. */
function resolve(
  document: OpenApiDocument,
  value: unknown,
  seen = new Set<string>()
): OpenApiObject {
  const entry = object(value);
  if (!entry.$ref) return entry;
  const ref = text(entry.$ref);
  if (!ref.startsWith('#/') || seen.has(ref)) {
    throw new Error(`Unsupported or circular OpenAPI reference: ${ref}.`);
  }
  let target: unknown = document;
  for (const segment of ref.slice(2).split('/')) {
    const key = decodeURIComponent(segment)
      .replace(/~1/g, '/')
      .replace(/~0/g, '~');
    target =
      target && typeof target === 'object' && Object.hasOwn(target, key)
        ? (target as OpenApiObject)[key]
        : undefined;
  }
  if (!target || typeof target !== 'object') {
    throw new Error(`Missing OpenAPI reference: ${ref}.`);
  }
  return {
    ...resolve(document, target, new Set([...seen, ref])),
    ...Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== '$ref')
    ),
  };
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return '';
  return [headers, headers.map(() => '---'), ...rows]
    .map((row) => `| ${row.map(cell).join(' | ')} |`)
    .join('\n');
}

function code(value: unknown): string {
  const source = String(value);
  const fence = '`'.repeat(
    Math.max(
      1,
      ...[...source.matchAll(/`+/g)].map((match) => match[0].length + 1)
    )
  );
  const pad =
    source.startsWith('`') ||
    source.endsWith('`') ||
    (source.startsWith(' ') && source.endsWith(' ') && /\S/.test(source))
      ? ' '
      : '';
  return `${fence}${pad}${source}${pad}${fence}`;
}

function anchor(id: string): string {
  return `<a id="${id.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></a>`;
}

function schemaName(ref: unknown): string {
  const parts = text(ref).split('/');
  const name =
    parts[1] === 'components' && parts[2] === 'schemas'
      ? parts[3]
      : parts.at(-1);
  return decodeURIComponent(name ?? '')
    .replace(/~1/g, '/')
    .replace(/~0/g, '~');
}

function schemaLabel(document: OpenApiDocument, name: string): string {
  const schema = object(object(object(document.components).schemas)[name]);
  return text(schema.title) || name;
}

function schemaType(document: OpenApiDocument, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Any value' : 'No value';
  const schema = object(value);
  const union = array(schema.oneOf).length
    ? array(schema.oneOf)
    : array(schema.anyOf);
  let type: string;
  if (schema.$ref) {
    // Validate the target but do not expand the schema graph.
    resolve(document, schema);
    const name = schemaName(schema.$ref);
    type = `[${code(schemaLabel(document, name))}](#${encodeURIComponent(`schema-${name}`)})`;
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
          return `(${schemaType(document, schema.items)})[]`;
        if (type === 'object' && schema.additionalProperties) {
          return `Dictionary of ${schemaType(document, schema.additionalProperties)}`;
        }
        return code(type);
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

function constraints(value: unknown): string {
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

function schemaFields(
  document: OpenApiDocument,
  value: unknown
): ReferenceTable {
  const rows: string[][] = [];
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
      rows.push([
        code(path),
        required.has(name) ? 'Yes' : 'No',
        schemaType(document, raw),
        [text(field.description), constraints(raw)].filter(Boolean).join(' '),
      ]);
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
  return referenceTable(['Property', 'Required', 'Type', 'Description'], rows);
}

function contentModel(
  document: OpenApiDocument,
  value: unknown,
  exampleLabel = 'Example response'
): ReferenceMedia[] {
  return Object.entries(object(value)).map(([mediaType, raw]) => {
    const media = object(raw);
    const language =
      !mediaType || /(?:\/json|\+json)(?:;|$)/i.test(mediaType)
        ? 'json'
        : 'text';
    const format = (value: unknown) =>
      language === 'json' || typeof value !== 'string'
        ? JSON.stringify(value, null, 2)
        : value;
    const entries = Object.entries(object(media.examples));
    const count = entries.length + ('example' in media ? 1 : 0);
    const examples: ReferenceExample[] = entries.map(([name, raw]) => {
      const example = resolve(document, raw);
      return {
        label:
          count === 1
            ? exampleLabel
            : text(example.summary) || readableSchemaName(name),
        description: prose(text(example.description)),
        language,
        ...('value' in example ? { code: format(example.value) } : {}),
        ...(example.externalValue ? { url: text(example.externalValue) } : {}),
      };
    });
    if ('example' in media)
      examples.unshift({
        label: exampleLabel,
        description: prose(''),
        language,
        code: format(media.example),
      });
    const ref = object(media.schema).$ref;
    return {
      mediaType,
      schema: prose(
        'schema' in media
          ? `Schema: ${schemaType(document, media.schema)}. ${constraints(media.schema)}`
          : ''
      ),
      description: prose(text(object(media.schema).description)),
      fields: schemaFields(document, media.schema),
      ...('schema' in media && !ref
        ? { definition: JSON.stringify(media.schema, null, 2) }
        : {}),
      ...(ref
        ? { fieldTarget: encodeURIComponent(`schema-${schemaName(ref)}`) }
        : {}),
      examples,
    };
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, stableValue(value)])
    );
  }
  return value;
}

function signature(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function isSuccess(status: string): boolean {
  return /^2(?:\d\d|XX)$/i.test(status);
}

function responseKey(status: string, response: OpenApiObject): string {
  return `${status}:${signature(response)}`;
}

function headerKey(name: string, header: OpenApiObject): string {
  return `${name.toLowerCase()}:${signature(header)}`;
}

interface SharedResponse {
  id: string;
  status: string;
  response: OpenApiObject;
}

interface SharedHeader {
  id: string;
  name: string;
  header: OpenApiObject;
  statuses: Set<string>;
}

function responseCatalog(
  document: OpenApiDocument,
  operations: ReturnType<typeof openApiOperations>
) {
  const responses = new Map<string, SharedResponse>();
  const headers = new Map<string, SharedHeader>();
  for (const { operation } of operations) {
    for (const [status, raw] of Object.entries(object(operation.responses))) {
      const response = resolve(document, raw);
      if (!isPrimaryResponse(status)) {
        const key = responseKey(status, response);
        if (!responses.has(key)) {
          responses.set(key, {
            id: `http-response-${responses.size + 1}`,
            status,
            response,
          });
        }
      }
      for (const [name, raw] of Object.entries(object(response.headers))) {
        const header = resolve(document, raw);
        const key = headerKey(name, header);
        const definition = headers.get(key) ?? {
          id: `response-header-${headers.size + 1}`,
          name,
          header,
          statuses: new Set<string>(),
        };
        definition.statuses.add(status);
        headers.set(key, definition);
      }
    }
  }
  return { responses, headers };
}

function statusLabel(status: string): string {
  return `${status}${STATUS_CODES[status] ? ` ${STATUS_CODES[status]}` : status === 'default' ? ' response' : ''}`;
}

function isPrimaryResponse(status: string): boolean {
  return isSuccess(status) || /^3(?:\d\d|XX)$/i.test(status);
}

function responseModel(
  document: OpenApiDocument,
  id: string,
  status: string,
  response: OpenApiObject,
  headers: Map<string, SharedHeader>
): ReferenceResponse {
  return {
    id,
    label: statusLabel(status),
    description: prose(text(response.description)),
    content: contentModel(document, response.content),
    headers: Object.entries(object(response.headers)).map(([name, raw]) => ({
      name,
      target: headers.get(headerKey(name, resolve(document, raw)))!.id,
    })),
    ...(Object.keys(object(response.links)).length
      ? {
          links: JSON.stringify(
            Object.fromEntries(
              Object.entries(object(response.links)).map(([name, raw]) => [
                name,
                resolve(document, raw),
              ])
            ),
            null,
            2
          ),
        }
      : {}),
  };
}

function securityLabel(document: OpenApiDocument, name: string): string {
  const schemes = object(object(document.components).securitySchemes);
  const scheme = resolve(document, schemes[name]);
  return text(scheme['x-displayName']) || name;
}

function securityMarkdown(document: OpenApiDocument, value: unknown): string {
  const alternatives = array(value);
  if (!alternatives.length) return 'No authentication required.';
  return alternatives
    .map((value, index) => {
      const requirements = Object.entries(object(value));
      if (!requirements.length)
        return `- ${index ? '**Or**, no authentication required.' : 'No authentication required.'}`;
      const credentials = requirements
        .map(
          ([name, scopes]) =>
            `${code(securityLabel(document, name))}${array(scopes).length ? ` (scopes: ${array(scopes).map(code).join(', ')})` : ''}`
        )
        .join(' **and** ');
      return `- ${index ? '**Or**, use' : 'Use'} ${requirements.length === 2 ? 'both ' : ''}${credentials}.`;
    })
    .join('\n');
}

export function buildOpenApiReference(
  document: OpenApiDocument,
  sourceUrl: string
): OpenApiReference {
  const components = object(document.components);
  const operations = openApiOperations(document);
  if (!operations.length)
    throw new Error('The OpenAPI specification contains no operations.');
  const catalog = responseCatalog(document, operations);
  const slugger = new GithubSlugger();
  // Reserve raw reference anchors before endpoint titles can claim them.
  for (const id of [
    ...[...catalog.responses.values()].flatMap(({ id, status }) => [
      id,
      `http-status-${status}`,
    ]),
    ...[...catalog.headers.values()].map(({ id }) => id),
    ...Object.keys(object(components.schemas)).map((name) => `schema-${name}`),
    ...operations.flatMap(({ operation }, index) =>
      Object.keys(object(operation.responses))
        .filter(isPrimaryResponse)
        .map((status) => `operation-${index + 1}-response-${status}`)
    ),
  ]) {
    slugger.occurrences[id] = 0;
  }
  const authenticationGuideId = slugger.slug('authentication');
  const heading = (
    depth: ReferenceHeading['depth'],
    text: string,
    id?: string
  ): ReferenceHeading => {
    if (id) slugger.occurrences[id] = 0;
    return { depth, text, slug: id ?? slugger.slug(text) };
  };
  const sections: OpenApiReference['sections'] = {
    servers: heading(2, 'Servers'),
    endpoints: heading(2, 'Endpoint reference', 'operations'),
    responses: heading(2, 'HTTP response codes'),
    headers: heading(3, 'Response headers'),
    schemas: heading(2, 'Schema and field definitions', 'schemas'),
  };
  const navigation: OpenApiReference['navigation'] = [
    {
      heading: heading(2, 'Get started with the API'),
      links: [
        {
          label: 'Authenticate with the Nx Cloud Public API',
          href: '/docs/kb/authenticate-public-api',
          id: authenticationGuideId,
        },
        {
          label: 'Query the Nx Cloud Public API',
          href: '/docs/kb/query-public-api',
        },
      ],
    },
    {
      heading: heading(2, 'Use cases'),
      links: [
        {
          label: 'Investigate flaky tasks',
          href: '/docs/kb/investigate-flaky-tasks-with-api',
        },
        {
          label: 'Debug CI failures',
          href: '/docs/kb/debug-ci-failures-with-api',
        },
        {
          label: 'Use the API with an AI agent',
          href: '/docs/kb/use-public-api-with-ai-agent',
        },
        {
          label: 'Read raw resource-utilization reports',
          href: '/docs/kb/read-resource-utilization-reports',
        },
      ],
    },
  ];
  const endpoints: ReferenceEndpoint[] = operations.map(
    ({ path, method, operation, parameters }, index) => {
      const merged = new Map<string, OpenApiObject>();
      for (const raw of [...parameters, ...array(operation.parameters)]) {
        const parameter = resolve(document, raw);
        merged.set(`${parameter.in}:${parameter.name}`, parameter);
      }
      const responses = Object.entries(object(operation.responses)).map(
        ([status, raw]) => ({ status, response: resolve(document, raw) })
      );
      const body = operation.requestBody
        ? resolve(document, operation.requestBody)
        : undefined;
      return {
        heading: heading(
          3,
          text(operation.summary) || `${method.toUpperCase()} ${path}`
        ),
        method: method.toUpperCase(),
        path,
        description: prose(text(operation.description)),
        deprecated: !!operation.deprecated,
        ...('security' in operation
          ? {
              authentication: prose(
                securityMarkdown(document, operation.security)
              ),
            }
          : {}),
        parameters: referenceTable(
          ['Name', 'Location', 'Required', 'Type', 'Description'],
          [...merged.values()].map((parameter) => [
            code(parameter.name),
            text(parameter.in),
            parameter.required || parameter.in === 'path' ? 'Yes' : 'No',
            schemaType(document, parameter.schema),
            [
              text(parameter.description),
              constraints(parameter.schema),
              parameter.explode ? 'Exploded values.' : '',
              parameter.deprecated ? 'Deprecated.' : '',
              parameter.style ? `Style: ${code(parameter.style)}.` : '',
              'example' in parameter
                ? `Example: ${code(JSON.stringify(parameter.example))}.`
                : '',
            ]
              .filter(Boolean)
              .join(' '),
          ])
        ),
        parameterDetails: [...merged.values()].flatMap((parameter) => {
          const schema = object(parameter.schema);
          const hasDetails =
            [
              'properties',
              'additionalProperties',
              'allOf',
              'oneOf',
              'anyOf',
            ].some((key) => key in schema) ||
            'examples' in parameter ||
            Object.keys(object(parameter.content)).length > 0;
          if (!hasDetails) return [];
          return [
            {
              name: text(parameter.name),
              content: parameter.content
                ? contentModel(document, parameter.content, 'Example parameter')
                : contentModel(
                    document,
                    {
                      '': {
                        schema: parameter.schema,
                        ...('example' in parameter
                          ? { example: parameter.example }
                          : {}),
                        ...(parameter.examples
                          ? { examples: parameter.examples }
                          : {}),
                      },
                    },
                    'Example parameter'
                  ),
            },
          ];
        }),
        ...(body
          ? {
              requestBody: {
                required: !!body.required,
                description: prose(text(body.description)),
                content: contentModel(
                  document,
                  body.content,
                  'Example request'
                ),
              },
            }
          : {}),
        successes: responses
          .filter(({ status }) => isPrimaryResponse(status))
          .map(({ status, response }) =>
            responseModel(
              document,
              `operation-${index + 1}-response-${status}`,
              status,
              response,
              catalog.headers
            )
          ),
        otherResponses: responses
          .filter(({ status }) => !isPrimaryResponse(status))
          .map(({ status, response }) => ({
            status,
            label: statusLabel(status),
            target: catalog.responses.get(responseKey(status, response))!.id,
          })),
      };
    }
  );
  const responseGroups = new Map<
    string,
    OpenApiReference['responses'][number]
  >();
  const responseBodies = new Map<
    string,
    OpenApiReference['responses'][number]['definitions'][number]
  >();
  for (const { id, status, response } of [...catalog.responses.values()].sort(
    (a, b) => a.status.localeCompare(b.status)
  )) {
    let group = responseGroups.get(status);
    if (!group) {
      group = {
        heading: heading(3, statusLabel(status), `http-status-${status}`),
        definitions: [],
      };
      responseGroups.set(status, group);
    }
    const rendered = responseModel(
      document,
      id,
      status,
      response,
      catalog.headers
    );
    const bodyKey = `${status}:${signature({
      content: rendered.content,
      headers: rendered.headers,
      links: rendered.links,
    })}`;
    let definition = responseBodies.get(bodyKey);
    if (!definition) {
      definition = { response: rendered, descriptions: [] };
      responseBodies.set(bodyKey, definition);
      group.definitions.push(definition);
    }
    const description = definition.descriptions.find(
      (item) => item.description.markdown === rendered.description.markdown
    );
    if (description) description.ids.push(id);
    else
      definition.descriptions.push({
        ids: [id],
        description: rendered.description,
      });
  }
  const responses = [...responseGroups.values()];
  const headers = [...catalog.headers.values()].map(
    ({ id, name, header, statuses }) => ({
      heading: heading(4, name, id),
      description: prose(text(header.description)),
      schema: prose(
        `Type: ${schemaType(document, header.schema)}. ${constraints(header.schema)}`
      ),
      fields: schemaFields(document, header.schema),
      content: contentModel(document, header.content),
      statuses: [...statuses].sort(),
    })
  );
  const schemas = Object.entries(object(components.schemas)).map(
    ([name, raw]) => ({
      heading: heading(3, schemaLabel(document, name), `schema-${name}`),
      description: prose(text(object(raw).description)),
      type: prose(`Type: ${schemaType(document, raw)}. ${constraints(raw)}`),
      fields: schemaFields(document, raw),
      definition: JSON.stringify(raw, null, 2),
    })
  );
  return {
    sourceUrl,
    title: document.info.title,
    version: document.info.version,
    introduction: prose(
      `This is an API reference of the Nx Cloud Public API.\n[View OpenAPI specification](${NX_CLOUD_PUBLIC_API_SPEC_URL})`
    ),
    description: prose(text(document.info.description)),
    navigation,
    servers: array(document.servers).map((server) =>
      prose(`${code(object(server).url)} ${text(object(server).description)}`)
    ),
    sections,
    endpoints,
    responses,
    headers,
    schemas,
  };
}

export function referenceHeadings(
  reference: OpenApiReference
): ReferenceHeading[] {
  const { sections, endpoints, responses, headers, schemas, servers } =
    reference;
  return [
    ...reference.navigation.map((group) => group.heading),
    ...(servers.length ? [sections.servers] : []),
    sections.endpoints,
    ...endpoints.map((item) => item.heading),
    sections.responses,
    ...responses.map((item) => item.heading),
    ...(headers.length
      ? [sections.headers, ...headers.map((item) => item.heading)]
      : []),
    sections.schemas,
    ...schemas.map((item) => item.heading),
  ];
}

/** Render only prose fragments. Do not store a second full HTML reference. */
export async function renderReferenceProse(
  reference: OpenApiReference,
  render: (markdown: string) => Promise<{ html: string }>
): Promise<void> {
  const cache = new Map<string, Promise<string>>();
  const visit = async (value: unknown): Promise<void> => {
    if (!value || typeof value !== 'object') return;
    if ('markdown' in value && 'html' in value) {
      const fragment = value as ReferenceProse;
      if (!cache.has(fragment.markdown))
        cache.set(
          fragment.markdown,
          fragment.markdown
            ? render(fragment.markdown).then((result) => result.html)
            : Promise.resolve('')
        );
      fragment.html = await cache.get(fragment.markdown)!;
      return;
    }
    await Promise.all(Object.values(value).map(visit));
  };
  await visit(reference);
}

function tableMarkdown(value: ReferenceTable): string {
  return table(
    value.columns,
    value.rows.map((row) => row.map((cell) => cell.markdown))
  );
}

function headingMarkdown(value: ReferenceHeading): string {
  return `${anchor(value.slug)}\n\n${'#'.repeat(value.depth)} ${value.text}`;
}

function fencedCode(value: string, language = 'json'): string {
  const fence = '`'.repeat(
    Math.max(
      3,
      ...[...value.matchAll(/`+/g)].map((match) => match[0].length + 1)
    )
  );
  return `${fence}${language}\n${value}\n${fence}`;
}

function contentMarkdown(content: ReferenceMedia[]): string {
  return content
    .map((media) =>
      [
        media.mediaType ? `Content type: ${code(media.mediaType)}.` : '',
        media.schema.markdown,
        media.description.markdown,
        tableMarkdown(media.fields),
        ...media.examples.flatMap((example) => [
          `**${example.label}**`,
          example.description.markdown,
          ...(example.code !== undefined
            ? [fencedCode(example.code, example.language)]
            : []),
          ...(example.url ? [`Example URL: ${example.url}`] : []),
        ]),
        media.fieldTarget
          ? `[View field definitions](#${media.fieldTarget})`
          : '',
        media.definition
          ? `<details>\n<summary>Schema definition</summary>\n\n${fencedCode(media.definition)}\n\n</details>`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
    .join('\n\n');
}

function responseDetailsMarkdown(
  response: ReferenceResponse,
  description = true
): string {
  return [
    description ? response.description.markdown : '',
    contentMarkdown(response.content),
    response.headers.length
      ? `Response headers: ${response.headers.map(({ name, target }) => `[${code(name)}](#${target})`).join(', ')}.`
      : '',
    response.links ? `Response links:\n\n${fencedCode(response.links)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The export uses the same facts, labels, and link targets as the Astro templates. */
export function renderOpenApiReference(reference: OpenApiReference): string {
  const lines = [
    reference.introduction.markdown,
    reference.description.markdown,
    `API: ${reference.title}. API version: ${code(reference.version)}.`,
    `Specification source: ${code(reference.sourceUrl)}.`,
    ...reference.navigation.flatMap((group) => [
      headingMarkdown(group.heading),
      group.links
        .map(
          ({ label, href, id }) =>
            `- ${id ? anchor(id) : ''}[${label}](${href})`
        )
        .join('\n'),
    ]),
    ...(reference.servers.length
      ? [
          headingMarkdown(reference.sections.servers),
          ...reference.servers.map((server) => `- ${server.markdown}`),
        ]
      : []),
  ];
  lines.push(headingMarkdown(reference.sections.endpoints));
  for (const endpoint of reference.endpoints) {
    lines.push(
      headingMarkdown(endpoint.heading),
      `${code(endpoint.method)} ${code(endpoint.path)}`,
      endpoint.description.markdown
    );
    if (endpoint.deprecated) lines.push('**Deprecated operation.**');
    if (endpoint.authentication)
      lines.push('**Authentication**', endpoint.authentication.markdown);
    if (endpoint.parameters.rows.length)
      lines.push('**Parameters**', tableMarkdown(endpoint.parameters));
    for (const parameter of endpoint.parameterDetails)
      lines.push(
        `**Parameter: ${code(parameter.name)}**`,
        contentMarkdown(parameter.content)
      );
    if (endpoint.requestBody)
      lines.push(
        '**Request body**',
        endpoint.requestBody.required ? 'Required.' : 'Optional.',
        endpoint.requestBody.description.markdown,
        contentMarkdown(endpoint.requestBody.content)
      );
    for (const response of endpoint.successes) {
      const details = responseDetailsMarkdown(response);
      lines.push(
        response.content.length
          ? `<details id="${response.id}">\n<summary>Response body — ${response.label}</summary>\n\n${details}\n\n</details>`
          : `${anchor(response.id)}\n\n**${response.label}**\n\n${details}`
      );
    }
    if (endpoint.otherResponses.length)
      lines.push(
        `Other response codes: ${endpoint.otherResponses.map(({ status, target, label }) => `[${code(status)}](#${target} "${label}")`).join(' • ')}`
      );
  }
  lines.push(headingMarkdown(reference.sections.responses));
  for (const group of reference.responses) {
    lines.push(headingMarkdown(group.heading));
    for (const definition of group.definitions) {
      for (const { ids, description } of definition.descriptions)
        lines.push(ids.map(anchor).join('\n'), description.markdown);
      lines.push(responseDetailsMarkdown(definition.response, false));
    }
  }
  if (reference.headers.length) {
    lines.push(headingMarkdown(reference.sections.headers));
    for (const header of reference.headers)
      lines.push(
        headingMarkdown(header.heading),
        header.description.markdown,
        header.schema.markdown,
        tableMarkdown(header.fields),
        contentMarkdown(header.content),
        `Documented with HTTP ${header.statuses.map(code).join(', ')}.`
      );
  }
  lines.push(headingMarkdown(reference.sections.schemas));
  for (const schema of reference.schemas)
    lines.push(
      headingMarkdown(schema.heading),
      schema.description.markdown,
      schema.type.markdown,
      tableMarkdown(schema.fields),
      `<details>\n<summary>Schema definition</summary>\n\n${fencedCode(schema.definition)}\n\n</details>`
    );
  return lines.filter(Boolean).join('\n\n');
}
