import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LoaderContext } from 'astro/loaders';
import {
  NxCloudPublicApiLoader,
  NX_CLOUD_PUBLIC_API_SPEC_URL,
} from './nx-cloud-public-api.loader';
import {
  parseOpenApiDocument,
  renderOpenApiReference,
} from './utils/openapi-reference';

function specification() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Test Public API',
      version: 'v2',
      description: 'A **read-only** API.',
    },
    security: [{ token: [] }, { pat: [], workspace: [] }],
    paths: {
      '/data/v2/tasks': {
        parameters: [{ $ref: '#/components/parameters/limit' }],
        get: {
          operationId: 'listTasks',
          summary: 'List tasks',
          description: 'Read recorded tasks.',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Operation override.',
              schema: { type: 'integer', default: 10 },
            },
          ],
          responses: {
            '200': {
              description: 'A task list.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Task' },
                  example: { id: 'task-1' },
                },
              },
            },
            '429': { $ref: '#/components/responses/rateLimit' },
          },
        },
        post: {
          summary: 'Create task',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Task' },
              },
            },
          },
          responses: { '201': { description: 'Created.' } },
        },
      },
    },
    components: {
      parameters: {
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Inherited description.',
          schema: { type: 'integer' },
        },
      },
      responses: {
        rateLimit: {
          description: 'Quota exhausted.',
          headers: {
            'Retry-After': {
              description: 'Seconds to wait.',
              schema: { type: 'integer' },
            },
          },
        },
      },
      securitySchemes: {
        token: {
          type: 'http',
          scheme: 'bearer',
          description: 'Workspace token.',
        },
        pat: { type: 'apiKey', in: 'header', name: 'Personal-Token' },
        workspace: { type: 'apiKey', in: 'header', name: 'Workspace-ID' },
      },
      schemas: {
        Task: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID with | separator.' },
            status: {
              type: ['string', 'null'],
              enum: ['FAILED', 'SUCCEEDED', null],
            },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/Task' },
            },
          },
        },
      },
    },
  };
}

test('renders the contract, security alternatives, parameters, responses, and schema links', () => {
  const markdown = renderOpenApiReference(
    parseOpenApiDocument(specification())
  );
  for (const expected of [
    'A **read-only** API.',
    '`GET /data/v2/tasks`',
    '`POST /data/v2/tasks`',
    '`Pat` **and** `Workspace`',
    'Workspace token.',
    'Personal-Token',
    'Operation override.',
    'Default: `10`.',
    'Quota exhausted.',
    'Retry-After',
    '#### Request body',
    'Required.',
    'No authentication required.',
    '[`Task`](#schema-Task)',
    '<a id="schema-Task"></a>',
    'ID with \\| separator.',
    '`string` or `null`',
    'Schema definition',
    'task-1',
  ])
    assert.ok(markdown.includes(expected), `Missing ${expected}`);
  const getOperation = markdown
    .split('### List tasks')[1]
    .split('### Create task')[0];
  assert.ok(!getOperation.includes('Inherited description.'));
});

test('collapses success response bodies by default without hiding response code links', () => {
  const markdown = renderOpenApiReference(
    parseOpenApiDocument(specification())
  );
  const bodies = [
    ...markdown.matchAll(
      /<details>\n<summary>Response body<\/summary>\n\n([\s\S]*?)\n\n<\/details>/g
    ),
  ];
  assert.equal(bodies.length, 2);
  assert.match(bodies[0][1], /<a id="operation-1-response-200"><\/a>/);
  assert.match(bodies[0][1], /A task list\./);
  assert.match(bodies[0][1], /\*\*Example response\*\*/);
  assert.match(bodies[0][1], /task-1/);
  assert.match(bodies[1][1], /<a id="operation-2-response-201"><\/a>/);
  assert.match(bodies[1][1], /Created\./);
  assert.match(
    markdown,
    /\[`200`\]\(#operation-1-response-200\)[\s\S]*?<details>/
  );
  assert.doesNotMatch(markdown, /<details\s+open/);
});

test('uses authentication display names consistently without changing scheme keys or headers', () => {
  const spec = JSON.parse(JSON.stringify(specification()));
  spec.components.securitySchemes.token['x-displayName'] = 'CiAccessToken';
  spec.components.securitySchemes.pat['x-displayName'] = 'PersonalAccessToken';
  spec.components.securitySchemes.workspace['x-displayName'] = 'NxCloudId';
  spec.paths['/data/v2/tasks'].get.security = [{ pat: [], workspace: [] }];
  const markdown = renderOpenApiReference(parseOpenApiDocument(spec));
  for (const name of ['CiAccessToken', 'PersonalAccessToken', 'NxCloudId']) {
    assert.ok(markdown.includes(`### ${name}`));
  }
  assert.match(markdown, /- Use `CiAccessToken`\./);
  assert.match(
    markdown,
    /- \*\*Or\*\*, use both `PersonalAccessToken` \*\*and\*\* `NxCloudId`\./
  );
  assert.doesNotMatch(markdown, /Schemes in the same alternative/);
  assert.equal(
    markdown.split('`PersonalAccessToken` **and** `NxCloudId`').length - 1,
    2
  );
  assert.match(markdown, /\| `name` \| `Personal-Token` \|/);
  assert.match(markdown, /\| `name` \| `Workspace-ID` \|/);
  assert.deepEqual(spec.security, [{ token: [] }, { pat: [], workspace: [] }]);
});

test('handles a recursive schema without recursively expanding it', () => {
  const markdown = renderOpenApiReference(
    parseOpenApiDocument(specification())
  );
  assert.match(
    markdown,
    /\| `children` \| No \| \[`Task`\]\(#schema-Task\)\[\]/
  );
});

test('supports local JSON pointers with escaped names', () => {
  const spec = specification();
  const raw = JSON.parse(JSON.stringify(spec));
  raw.components.responses['rate/limit'] = raw.components.responses.rateLimit;
  raw.paths['/data/v2/tasks'].get.responses['429'].$ref =
    '#/components/responses/rate~1limit';
  assert.match(
    renderOpenApiReference(parseOpenApiDocument(raw)),
    /Quota exhausted/
  );
});

test('rejects unsupported documents, missing references, and an empty operation list', () => {
  for (const value of [
    null,
    [],
    {},
    { ...specification(), openapi: '2.0' },
    { ...specification(), paths: [] },
  ]) {
    assert.throws(() => parseOpenApiDocument(value));
  }
  const broken = specification();
  broken.paths['/data/v2/tasks'].get.responses['429'].$ref =
    '#/components/responses/missing';
  assert.throws(
    () => renderOpenApiReference(parseOpenApiDocument(broken)),
    /Missing OpenAPI reference/
  );
  assert.throws(
    () =>
      renderOpenApiReference(
        parseOpenApiDocument({ ...specification(), paths: {} })
      ),
    /no operations/
  );
});

test('uses readable page names and an example response label without changing schema anchors', () => {
  const spec = JSON.parse(JSON.stringify(specification()));
  spec.components.schemas.RunGroupListResponse = {
    type: 'object',
    properties: { id: { type: 'string' } },
  };
  spec.components.schemas.PageResponse_RunGroupListResponse = {
    type: 'object',
    title: 'PageResponse_RunGroupListResponse',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/RunGroupListResponse' },
      },
      nextCursor: { type: ['string', 'null'] },
      prevCursor: { type: ['string', 'null'] },
    },
  };
  const media =
    spec.paths['/data/v2/tasks'].get.responses['200'].content[
      'application/json'
    ];
  delete media.example;
  media.schema = {
    $ref: '#/components/schemas/PageResponse_RunGroupListResponse',
  };
  media.examples = {
    completed: {
      summary: 'An illustrative completed result',
      value: { items: [] },
    },
  };
  const markdown = renderOpenApiReference(parseOpenApiDocument(spec));
  assert.match(markdown, /### Paginated run group list/);
  assert.match(
    markdown,
    /\[`Paginated run group list`\]\(#schema-PageResponse_RunGroupListResponse\)/
  );
  assert.match(markdown, /\*\*Example response\*\*/);
  assert.doesNotMatch(markdown, /Example: `completed`/);
  assert.doesNotMatch(markdown, /### PageResponse_RunGroupListResponse/);
  assert.match(
    markdown,
    /<a id="schema-PageResponse_RunGroupListResponse"><\/a>/
  );
});

test('renders common HTTP meanings and header descriptions once and links every endpoint to them', () => {
  const spec = JSON.parse(JSON.stringify(specification()));
  const meanings = {
    '400': 'One or more request parameters are invalid.',
    '404': 'The requested resource or parent was not found.',
    '409': 'The resource, parent, or workflow has not finished.',
  };
  const responses = {
    ...Object.fromEntries(
      Object.keys(meanings).map((status) => [
        status,
        { description: `List-specific ${status}.` },
      ])
    ),
    '429': { $ref: '#/components/responses/rateLimit' },
  };
  Object.assign(spec.paths['/data/v2/tasks'].get.responses, responses);
  spec.paths['/data/v2/tasks'].get.responses['400'].headers = {};
  spec.paths['/data/v2/tasks'].get.responses['409'].links = {};
  spec.paths['/data/v2/tasks/{id}'] = {
    get: {
      summary: 'Get task',
      responses: {
        ...Object.fromEntries(
          Object.keys(meanings).map((status) => [
            status,
            { description: `Get-specific ${status}.` },
          ])
        ),
        '429': { $ref: '#/components/responses/rateLimit' },
      },
    },
  };
  Object.assign(
    spec.components.responses,
    Object.fromEntries(
      Object.entries(meanings).map(([status, description]) => [
        status,
        { description },
      ])
    )
  );
  const markdown = renderOpenApiReference(parseOpenApiDocument(spec));
  for (const description of [
    ...Object.values(meanings),
    'Quota exhausted.',
    'Seconds to wait.',
  ]) {
    assert.equal(markdown.split(description).length - 1, 1, description);
  }
  assert.doesNotMatch(markdown, /(?:List|Get)-specific/);
  assert.match(markdown, /## HTTP response codes/);
  for (const status of [...Object.keys(meanings), '429']) {
    const links = [
      ...markdown.matchAll(
        new RegExp(`\\[\\\`${status}\\\`\\]\\(#(http-response-\\d+)\\)`, 'g')
      ),
    ];
    assert.equal(links.length, 2, status);
    assert.equal(links[0][1], links[1][1], status);
    assert.ok(markdown.includes(`<a id="${links[0][1]}"></a>`));
  }
  assert.equal(
    (markdown.match(/\[`Retry-After`\]\(#response-header-\d+\)/g) ?? []).length,
    1
  );
});

test('preserves response and header variants instead of merging different payloads under one HTTP code', () => {
  const spec = JSON.parse(JSON.stringify(specification()));
  spec.components.responses['409'] = {
    description: 'Default conflict.',
    content: { 'application/json': { schema: { type: 'object' } } },
  };
  spec.paths['/data/v2/tasks'].get.responses['409'] = {
    description: 'A conflict with a different body.',
    content: { 'text/plain': { schema: { type: 'string' } } },
  };
  spec.paths['/data/v2/other'] = {
    get: {
      responses: {
        '409': { description: 'Another conflict.' },
        '429': {
          description: 'A different quota.',
          headers: {
            'Retry-After': {
              description: 'A different retry policy.',
              schema: { type: 'integer' },
            },
          },
        },
      },
    },
  };
  const markdown = renderOpenApiReference(parseOpenApiDocument(spec));
  assert.match(markdown, /A conflict with a different body/);
  assert.match(markdown, /Another conflict/);
  assert.doesNotMatch(markdown, /Default conflict/);
  assert.match(markdown, /Content type: `text\/plain`/);
  assert.match(markdown, /Seconds to wait/);
  assert.match(markdown, /A different retry policy/);
  const links = [...markdown.matchAll(/\[`409`\]\(#(http-response-\d+)\)/g)];
  assert.equal(links.length, 2);
  assert.notEqual(links[0][1], links[1][1]);
});

test('keeps example summaries for multiple examples and distinguishes request examples', () => {
  const spec = JSON.parse(JSON.stringify(specification()));
  spec.paths['/data/v2/tasks'].get.responses['200'].content[
    'application/json'
  ].examples = {
    first: { summary: 'First task', value: { id: 'first' } },
    second: { summary: 'Second task', value: { id: 'second' } },
  };
  spec.paths['/data/v2/tasks'].post.requestBody.content[
    'application/json'
  ].example = { id: 'new' };
  const markdown = renderOpenApiReference(parseOpenApiDocument(spec));
  assert.match(markdown, /\*\*First task\*\*/);
  assert.match(markdown, /\*\*Second task\*\*/);
  assert.match(markdown, /\*\*Example request\*\*/);
});

function context() {
  const entries = new Map<string, Record<string, unknown>>();
  const calls: string[] = [];
  const value = {
    store: {
      set(entry: Record<string, unknown> & { id: string }) {
        entries.set(entry.id, entry);
      },
    },
    async parseData({ data }: { data: unknown }) {
      calls.push('parse');
      return data;
    },
    async renderMarkdown(body: string) {
      calls.push('render');
      return { html: body, metadata: {}, headings: [] };
    },
    generateDigest: (value: unknown) => JSON.stringify(value),
    logger: { info() {} },
  } as unknown as LoaderContext;
  return { value, entries, calls };
}

test('loads the live spec into a rendered collection entry and refreshes it on each sync', async () => {
  const requests: string[] = [];
  const spec = specification();
  const loader = NxCloudPublicApiLoader({
    specificationUrl: NX_CLOUD_PUBLIC_API_SPEC_URL,
    fetch: async (url) => {
      requests.push(String(url));
      return Response.json(spec);
    },
  });
  const state = context();
  await loader.load(state.value);
  assert.deepEqual(requests, [NX_CLOUD_PUBLIC_API_SPEC_URL]);
  const first = state.entries.get('reference')!;
  assert.deepEqual(state.calls, ['parse', 'render']);
  const data = first.data as Record<string, unknown>;
  assert.equal(data.slug, 'reference/nx-cloud/public-api');
  assert.equal(data.operationCount, 2);
  assert.equal(data.apiVersion, 'v2');
  spec.info.version = 'v3';
  spec.paths['/data/v2/tasks'].get.description = 'Updated description.';
  await loader.load(state.value);
  const next = state.entries.get('reference')!;
  assert.equal(requests.length, 2);
  assert.notEqual(first.digest, next.digest);
  assert.match(String(next.body), /Updated description/);
});

test('fails the sync rather than publishing a fallback for failed or malformed fetches', async () => {
  for (const response of [
    new Response('Unavailable', { status: 503 }),
    Response.json({}),
    new Response('not JSON'),
  ]) {
    const state = context();
    const loader = NxCloudPublicApiLoader({ fetch: async () => response });
    await assert.rejects(() => loader.load(state.value));
    assert.equal(state.entries.size, 0);
  }
});

test('does not replace the current entry if schema validation fails', async () => {
  const state = context();
  state.value.parseData = async () => {
    throw new Error('Invalid collection data.');
  };
  const loader = NxCloudPublicApiLoader({
    fetch: async () => Response.json(specification()),
  });
  await assert.rejects(
    () => loader.load(state.value),
    /Invalid collection data/
  );
  assert.equal(state.entries.size, 0);
  assert.deepEqual(state.calls, []);
});
