import { STATUS_CODES } from 'node:http';

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
    target =
      object(target)[
        decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~')
      ];
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
  return `\`${String(value).replace(/`/g, '&#96;')}\``;
}

function anchor(id: string): string {
  return `<a id="${id.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></a>`;
}

function schemaName(ref: unknown): string {
  return decodeURIComponent(text(ref).split('/').pop() ?? '')
    .replace(/~1/g, '/')
    .replace(/~0/g, '~');
}

function readableSchemaName(name: string): string {
  const label = name
    .replace(/Response$/, '')
    .replace(/_/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function schemaLabel(
  document: OpenApiDocument,
  name: string,
  seen = new Set<string>()
): string {
  const schema = object(object(object(document.components).schemas)[name]);
  if (schema.title && schema.title !== name) return text(schema.title);
  const properties = object(schema.properties);
  const items = object(properties.items);
  const itemRef = object(items.items).$ref;
  if (
    !seen.has(name) &&
    items.type === 'array' &&
    itemRef &&
    properties.nextCursor &&
    properties.prevCursor
  ) {
    const itemLabel = schemaLabel(
      document,
      schemaName(itemRef),
      new Set([...seen, name])
    );
    return `Paginated ${itemLabel.charAt(0).toLowerCase()}${itemLabel.slice(1)}`;
  }
  return readableSchemaName(name);
}

function schemaType(document: OpenApiDocument, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Any value' : 'No value';
  const schema = object(value);
  if (schema.$ref) {
    const name = schemaName(schema.$ref);
    return `[${code(schemaLabel(document, name))}](#${encodeURIComponent(`schema-${name}`)})`;
  }
  const union = array(schema.oneOf).length
    ? array(schema.oneOf)
    : array(schema.anyOf);
  if (union.length)
    return union.map((value) => schemaType(document, value)).join(' or ');
  if (schema.allOf)
    return array(schema.allOf)
      .map((value) => schemaType(document, value))
      .join(' and ');
  const types = array(schema.type).length
    ? array(schema.type).map(String)
    : [text(schema.type) || (schema.properties ? 'object' : 'any')];
  let type = types
    .map((type) =>
      type === 'array' ? `${schemaType(document, schema.items)}[]` : code(type)
    )
    .join(' or ');
  if (schema.format) type += ` (${code(schema.format)})`;
  if (schema.nullable && !types.includes('null')) type += ' or `null`';
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
  ]) {
    if (key in schema) parts.push(`${key}: ${code(schema[key])}.`);
  }
  if (schema.readOnly) parts.push('Read-only.');
  if (schema.writeOnly) parts.push('Write-only.');
  if (schema.deprecated) parts.push('Deprecated.');
  return parts.join(' ');
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

function contentMarkdown(
  document: OpenApiDocument,
  value: unknown,
  exampleLabel = 'Example response'
): string {
  return Object.entries(object(value))
    .map(([mediaType, raw]) => {
      const media = object(raw);
      const lines = [
        `Content type: ${code(mediaType)}.`,
        `Schema: ${schemaType(document, media.schema)}. ${constraints(media.schema)}`,
      ];
      if ('example' in media)
        lines.push(
          `**${exampleLabel}**`,
          '```json',
          JSON.stringify(media.example, null, 2),
          '```'
        );
      const examples = Object.entries(object(media.examples));
      for (const [name, rawExample] of examples) {
        const example = resolve(document, rawExample);
        const label =
          examples.length === 1
            ? exampleLabel
            : text(example.summary) || readableSchemaName(name);
        lines.push(`**${label}**`, text(example.description));
        if ('value' in example)
          lines.push('```json', JSON.stringify(example.value, null, 2), '```');
        if (example.externalValue)
          lines.push(`Example URL: ${text(example.externalValue)}`);
      }
      return lines.filter(Boolean).join('\n\n');
    })
    .join('\n\n');
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

function responseMeaning(
  document: OpenApiDocument,
  status: string,
  response: OpenApiObject
): OpenApiObject {
  const raw = object(object(document.components).responses)[status];
  if (!raw) return response;
  const shared = resolve(document, raw);
  const shape = (value: OpenApiObject) =>
    Object.fromEntries(
      Object.entries(value).filter(([key, value]) => {
        if (key === 'description') return false;
        // Swagger may emit empty maps on operations but omit them on components.
        return !(
          ['headers', 'links', 'content'].includes(key) &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0
        );
      })
    );
  // A status-keyed component supplies the common meaning only for the same response
  // shape. Keep different payloads, headers, and links as distinct response details.
  return signature(shape(response)) === signature(shape(shared))
    ? shared
    : response;
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
      if (!isSuccess(status)) {
        const meaning = responseMeaning(document, status, response);
        const key = responseKey(status, meaning);
        if (!responses.has(key)) {
          responses.set(key, {
            id: `http-response-${responses.size + 1}`,
            status,
            response: meaning,
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

function responseHeaderLinks(
  document: OpenApiDocument,
  response: OpenApiObject,
  headers: Map<string, SharedHeader>
): string {
  const links = Object.entries(object(response.headers)).map(([name, raw]) => {
    const header = resolve(document, raw);
    const definition = headers.get(headerKey(name, header))!;
    return `[${code(name)}](#${definition.id})`;
  });
  return links.length ? `Response headers: ${links.join(', ')}.` : '';
}

function responseDetails(
  document: OpenApiDocument,
  response: OpenApiObject,
  headers: Map<string, SharedHeader>
): string[] {
  return [
    text(response.description),
    contentMarkdown(document, response.content),
    responseHeaderLinks(document, response, headers),
  ];
}

function securityLabel(document: OpenApiDocument, name: string): string {
  const schemes = object(object(document.components).securitySchemes);
  const scheme = resolve(document, schemes[name]);
  return (
    text(scheme['x-displayName']) ||
    name.charAt(0).toUpperCase() + name.slice(1)
  );
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

export function renderOpenApiReference(document: OpenApiDocument): string {
  const components = object(document.components);
  const operations = openApiOperations(document);
  if (!operations.length)
    throw new Error('The OpenAPI specification contains no operations.');
  const catalog = responseCatalog(document, operations);
  const lines = [text(document.info.description)];
  if (array(document.servers).length) {
    lines.push(
      '## Servers',
      ...array(document.servers).map(
        (server) =>
          `- ${code(object(server).url)} ${text(object(server).description)}`
      )
    );
  }
  lines.push(
    '## Authentication',
    securityMarkdown(document, document.security)
  );
  for (const [name, raw] of Object.entries(
    object(components.securitySchemes)
  )) {
    const scheme = resolve(document, raw);
    lines.push(
      `### ${securityLabel(document, name)}`,
      text(scheme.description),
      table(
        ['Property', 'Value'],
        ['type', 'scheme', 'bearerFormat', 'in', 'name', 'openIdConnectUrl']
          .filter((key) => key in scheme)
          .map((key) => [code(key), code(scheme[key])])
      )
    );
    if (scheme.flows)
      lines.push('```json', JSON.stringify(scheme.flows, null, 2), '```');
  }
  lines.push('## Operations');
  for (const [
    index,
    { path, method, operation, parameters },
  ] of operations.entries()) {
    lines.push(
      `### ${text(operation.summary) || `${method.toUpperCase()} ${path}`}`,
      `\`${method.toUpperCase()} ${path}\``,
      text(operation.description)
    );
    if (operation.deprecated) lines.push('**Deprecated operation.**');
    if (operation.operationId)
      lines.push(`Operation ID: ${code(operation.operationId)}.`);
    if ('security' in operation)
      lines.push(
        '#### Authentication',
        securityMarkdown(document, operation.security)
      );
    const mergedParameters = new Map<string, OpenApiObject>();
    for (const raw of [...parameters, ...array(operation.parameters)]) {
      const parameter = resolve(document, raw);
      mergedParameters.set(`${parameter.in}:${parameter.name}`, parameter);
    }
    if (mergedParameters.size) {
      lines.push(
        '#### Parameters',
        table(
          ['Name', 'Location', 'Required', 'Type', 'Description'],
          [...mergedParameters.values()].map((parameter) => [
            code(parameter.name),
            text(parameter.in),
            parameter.required || parameter.in === 'path' ? 'Yes' : 'No',
            schemaType(document, parameter.schema),
            [
              text(parameter.description),
              constraints(parameter.schema),
              parameter.explode ? 'Exploded values.' : '',
              parameter.deprecated ? 'Deprecated.' : '',
            ]
              .filter(Boolean)
              .join(' '),
          ])
        )
      );
    }
    if (operation.requestBody) {
      const body = resolve(document, operation.requestBody);
      lines.push(
        '#### Request body',
        body.required ? 'Required.' : 'Optional.',
        text(body.description),
        contentMarkdown(document, body.content, 'Example request')
      );
    }
    const responses = Object.entries(object(operation.responses)).map(
      ([status, raw]) => ({ status, response: resolve(document, raw) })
    );
    const successId = (status: string) =>
      `operation-${index + 1}-response-${status}`;
    lines.push(
      '#### Responses',
      table(
        ['HTTP code', 'Meaning'],
        responses.map(({ status, response }) => {
          const target = isSuccess(status)
            ? successId(status)
            : catalog.responses.get(
                responseKey(status, responseMeaning(document, status, response))
              )!.id;
          return [
            `[${code(status)}](#${target})`,
            STATUS_CODES[status] ??
              (status === 'default' ? 'Default response' : 'Response'),
          ];
        })
      )
    );
    for (const { status, response } of responses.filter(({ status }) =>
      isSuccess(status)
    )) {
      lines.push(
        '<details>\n<summary>Response body</summary>\n',
        anchor(successId(status)),
        ...responseDetails(document, response, catalog.headers),
        '</details>'
      );
    }
  }
  lines.push(
    '## HTTP response codes',
    'These descriptions apply to the endpoints that list each code. Response-code links select the matching details.'
  );
  for (const { id, status, response } of [...catalog.responses.values()].sort(
    (a, b) => a.status.localeCompare(b.status)
  )) {
    lines.push(
      anchor(id),
      `### ${status}${STATUS_CODES[status] ? ` ${STATUS_CODES[status]}` : ''}`,
      ...responseDetails(document, response, catalog.headers)
    );
  }
  if (catalog.headers.size) {
    lines.push('### Response headers');
    for (const { id, name, header, statuses } of catalog.headers.values()) {
      lines.push(
        anchor(id),
        `#### ${name}`,
        text(header.description),
        `Type: ${schemaType(document, header.schema)}. ${constraints(header.schema)}`,
        `Documented with HTTP ${[...statuses].sort().map(code).join(', ')}.`
      );
    }
  }
  lines.push('## Schemas');
  for (const [name, raw] of Object.entries(object(components.schemas))) {
    const schema = object(raw);
    lines.push(
      anchor(`schema-${name}`),
      `### ${schemaLabel(document, name)}`,
      text(schema.description),
      `Type: ${schemaType(document, schema)}. ${constraints(schema)}`
    );
    const required = array(schema.required);
    const properties = Object.entries(object(schema.properties));
    if (properties.length) {
      lines.push(
        table(
          ['Property', 'Required', 'Type', 'Description'],
          properties.map(([name, value]) => [
            code(name),
            required.includes(name) ? 'Yes' : 'No',
            schemaType(document, value),
            [text(object(value).description), constraints(value)]
              .filter(Boolean)
              .join(' '),
          ])
        )
      );
    }
    lines.push(
      '<details>\n<summary>Schema definition</summary>\n',
      '```json',
      JSON.stringify(raw, null, 2),
      '```',
      '</details>'
    );
  }
  return lines.filter(Boolean).join('\n\n');
}
