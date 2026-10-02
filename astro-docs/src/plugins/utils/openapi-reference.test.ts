import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildOpenApiReference,
  parseOpenApiDocument,
  referenceHeadings,
  renderOpenApiReference,
  renderReferenceProse,
  type OpenApiObject,
} from './openapi-reference';

function reference(schema: OpenApiObject, ref?: string) {
  return buildOpenApiReference(
    parseOpenApiDocument({
      openapi: '3.1.0',
      info: { title: 'Test API', version: 'v1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                description: 'Items.',
                content: {
                  'application/json': { schema: ref ? { $ref: ref } : schema },
                },
              },
            },
          },
        },
      },
      components: { schemas: { Foo: schema } },
    }),
    'https://example.com/openapi.json'
  );
}

test('resolves local schema references through arrays', () => {
  const model = reference(
    { allOf: [{ type: 'string' }] },
    '#/components/schemas/Foo/allOf/0'
  );
  assert.equal(
    model.endpoints[0].successes[0].content[0].fieldTarget,
    'schema-Foo'
  );
  assert.match(renderOpenApiReference(model), /\(#schema-Foo\)/);
  assert.throws(
    () =>
      reference(
        { allOf: [{ type: 'string' }] },
        '#/components/schemas/Foo/allOf/1'
      ),
    /Missing OpenAPI reference/
  );
  assert.throws(
    () =>
      reference(
        { allOf: [{ $ref: '#/components/schemas/Foo/allOf/0' }] },
        '#/components/schemas/Foo/allOf/0'
      ),
    /circular OpenAPI reference/
  );
});

test('links nested schema references to the containing component', () => {
  const model = reference(
    { type: 'object', properties: { id: { type: 'string' } } },
    '#/components/schemas/Foo/properties/id'
  );
  const media = model.endpoints[0].successes[0].content[0];
  assert.equal(media.fieldTarget, 'schema-Foo');
  assert.match(media.schema.markdown, /\(#schema-Foo\)/);
  assert.doesNotMatch(renderOpenApiReference(model), /#schema-id/);
});

test('combines allOf required fields without leaking them into child objects', () => {
  const model = reference({
    type: 'object',
    required: ['id'],
    properties: {
      nested: { type: 'object', properties: { id: { type: 'string' } } },
    },
    allOf: [
      { properties: { id: { type: 'string' } } },
      { required: ['name'] },
      {
        properties: { name: { type: 'string' }, optional: { type: 'string' } },
      },
    ],
  });
  for (const fields of [
    model.schemas[0].fields,
    model.endpoints[0].successes[0].content[0].fields,
  ]) {
    const required = new Map(
      fields.rows.map((row) => [row[0].markdown, row[1].markdown])
    );
    assert.equal(required.get('`id`'), 'Yes');
    assert.equal(required.get('`name`'), 'Yes');
    assert.equal(required.get('`optional`'), 'No');
    assert.equal(required.get('`nested.id`'), 'No');
  }
});

test('keeps endpoint headings distinct from all reserved anchors', () => {
  const summaries = [
    'Operations',
    'Schemas',
    'HTTP response 1',
    'Response header 1',
    'Schema foo',
    'Operation 1 response 200',
    'Operations',
  ];
  const model = buildOpenApiReference(
    parseOpenApiDocument({
      openapi: '3.1.0',
      info: { title: 'Test API', version: 'v1' },
      paths: Object.fromEntries(
        summaries.map((summary, index) => [
          `/items/${index}`,
          {
            get: {
              summary,
              responses: {
                '200': {
                  description: 'Items.',
                  headers: { 'X-Test': { schema: { type: 'string' } } },
                },
                '400': { description: 'Invalid request.' },
              },
            },
          },
        ])
      ),
      components: { schemas: { foo: { type: 'string' } } },
    }),
    'https://example.com/openapi.json'
  );
  const ids = [
    ...referenceHeadings(model).map((heading) => heading.slug),
    ...model.navigation.flatMap(({ id }) => (id ? [id] : [])),
    ...model.endpoints.flatMap((endpoint) =>
      endpoint.successes.map(({ id }) => id)
    ),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(model.sections.endpoints.slug, 'operations');
  assert.equal(model.sections.schemas.slug, 'schemas');
  assert.equal(model.schemas[0].heading.slug, 'schema-foo');
});

test('preserves literal backticks and spaces in inline code', async () => {
  const patterns = [
    '^`[a-z]+`$',
    '`start',
    'end`',
    'two `` runs `',
    ' padded ',
  ];
  const model = reference({
    type: 'object',
    properties: Object.fromEntries(
      patterns.map((pattern, index) => [
        `field${index}`,
        { type: 'string', pattern },
      ])
    ),
  });
  const { createMarkdownProcessor } = await import('@astrojs/markdown-remark');
  const processor = await createMarkdownProcessor();
  await renderReferenceProse(model, async (markdown) => ({
    html: (await processor.render(markdown)).code,
  }));
  const rows = model.schemas[0].fields.rows;
  for (const [index, pattern] of patterns.entries()) {
    assert.ok(rows[index][3].html.includes(`<code>${pattern}</code>`));
    assert.ok(!rows[index][3].html.includes('&#x26;#96;'));
  }
  const exported = await processor.render(renderOpenApiReference(model));
  for (const pattern of patterns) {
    assert.ok(exported.code.includes(`<code>${pattern}</code>`));
  }
});
