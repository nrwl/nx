import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LoaderContext } from 'astro/loaders';
import {
  NxCloudPublicApiLoader,
  NX_CLOUD_PUBLIC_API_SPEC_URL,
} from './nx-cloud-public-api.loader';
import {
  referenceHeadings,
  type OpenApiReference,
} from './utils/openapi-reference';

function specification() {
  return {
    openapi: '3.1.0',
    info: { title: 'Test Public API', version: 'v1' },
    paths: {
      '/data/v1/tasks': {
        get: {
          summary: 'List tasks',
          description: 'Read recorded tasks.',
          responses: {
            '200': {
              description: 'A task.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Task' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Task: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
    },
  };
}

function context() {
  const entries = new Map<string, Record<string, unknown>>();
  const value = {
    store: {
      set(entry: Record<string, unknown> & { id: string }) {
        entries.set(entry.id, entry);
      },
    },
    async parseData({ data }: { data: unknown }) {
      return data;
    },
    async renderMarkdown(body: string) {
      return { html: body, metadata: {}, headings: [] };
    },
    generateDigest: (value: unknown) => JSON.stringify(value),
    logger: { info() {} },
  } as unknown as LoaderContext;
  return { value, entries };
}

test('loads the reference and refreshes it on each content sync', async () => {
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
  const first = state.entries.get('reference')!;
  const data = first.data as Record<string, unknown>;
  assert.deepEqual(requests, [NX_CLOUD_PUBLIC_API_SPEC_URL]);
  assert.equal(data.slug, 'reference/nx-cloud/public-api');
  const reference = data.reference as OpenApiReference;
  assert.equal(reference.version, 'v1');
  assert.equal(reference.sourceUrl, NX_CLOUD_PUBLIC_API_SPEC_URL);
  assert.equal(reference.endpoints[0].path, '/data/v1/tasks');
  assert.match(String(first.body), /`GET` `\/data\/v1\/tasks`/);
  assert.match(String(first.body), /#schema-Task/);
  assert.ok(reference.endpoints[0].description.html);
  assert.ok(referenceHeadings(reference).length);
  assert.equal(first.rendered, undefined);

  spec.info.version = 'v2';
  spec.paths['/data/v1/tasks'].get.description = 'Updated description.';
  await loader.load(state.value);
  const next = state.entries.get('reference')!;
  assert.equal(requests.length, 2);
  assert.notEqual(first.digest, next.digest);
  assert.match(String(next.body), /Updated description/);
  assert.equal(
    (next.data as { reference: OpenApiReference }).reference.version,
    'v2'
  );
});

test('fails the sync instead of publishing a fallback for failed or malformed fetches', async () => {
  for (const response of [
    new Response('Unavailable', { status: 503 }),
    Response.json({}),
    Response.json({
      openapi: '3.1.0',
      info: { title: 'Empty', version: 'v1' },
      paths: {},
    }),
    new Response('not JSON'),
  ]) {
    const state = context();
    const loader = NxCloudPublicApiLoader({ fetch: async () => response });
    await assert.rejects(() => loader.load(state.value));
    assert.equal(state.entries.size, 0);
  }
});

test('does not publish invalid collection data', async () => {
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
});
