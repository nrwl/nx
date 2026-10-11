import { STATUS_CODES } from 'node:http';
import GithubSlugger from 'github-slugger';
import { code, prose, referenceTable } from './formatting';
import {
  array,
  constraints,
  object,
  openApiOperations,
  resolve,
  schemaFields,
  schemaLabel,
  schemaName,
  schemaType,
  text,
} from './openapi';
import { NX_CLOUD_PUBLIC_API_SPEC_URL } from './source';
import type {
  OpenApiDocument,
  OpenApiObject,
  OpenApiReference,
  ReferenceEndpoint,
  ReferenceExample,
  ReferenceHeading,
  ReferenceMedia,
  ReferenceResponse,
} from './types';

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
        label: count === 1 ? exampleLabel : text(example.summary) || name,
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
    ...[...catalog.headers.values()].flatMap(({ id, name }) => [
      id,
      `http-header-${name.toLowerCase()}`,
    ]),
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
      const endpointHeading = heading(
        3,
        text(operation.summary) || `${method.toUpperCase()} ${path}`
      );
      return {
        heading: endpointHeading,
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
          ['Name', 'Location', 'Type', 'Description'],
          [...merged.values()].map((parameter) => ({
            required: !!parameter.required || parameter.in === 'path',
            cells: [
              code(parameter.name),
              text(parameter.in),
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
            ],
          })),
          `${endpointHeading.slug}-parameter`
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
  const headerGroups = new Map<string, OpenApiReference['headers'][number]>();
  for (const { id, name, header, statuses } of catalog.headers.values()) {
    const key = name.toLowerCase();
    let group = headerGroups.get(key);
    if (!group) {
      group = {
        heading: heading(4, name, `http-header-${key}`),
        definitions: [],
      };
      headerGroups.set(key, group);
    }
    const schema = prose(
      `Type: ${schemaType(document, header.schema)}. ${constraints(header.schema)}`
    );
    const fields = schemaFields(document, header.schema);
    const content = contentModel(document, header.content);
    const bodyKey = signature({ schema, fields, content });
    let definition = group.definitions.find(
      (item) =>
        signature({
          schema: item.schema,
          fields: item.fields,
          content: item.content,
        }) === bodyKey
    );
    if (!definition) {
      definition = { schema, fields, content, descriptions: [] };
      group.definitions.push(definition);
    }
    definition.descriptions.push({
      id,
      description: prose(text(header.description)),
      statuses: [...statuses].sort(),
    });
  }
  const headers = [...headerGroups.values()];
  const schemas = Object.entries(object(components.schemas)).map(
    ([name, raw]) => ({
      heading: heading(3, schemaLabel(document, name), `schema-${name}`),
      description: prose(text(object(raw).description)),
      type: prose(`Type: ${schemaType(document, raw)}. ${constraints(raw)}`),
      fields: schemaFields(document, raw, `schema-${name}-property`),
      definition: JSON.stringify(raw, null, 2),
    })
  );
  for (const table of [
    ...endpoints.map((endpoint) => endpoint.parameters),
    ...schemas.map((schema) => schema.fields),
  ]) {
    for (const row of table.rows) {
      if (row.id) row.id = slugger.slug(row.id);
    }
  }
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
