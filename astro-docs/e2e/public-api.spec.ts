import { expect, test } from '@playwright/test';

const referencePath = '/docs/reference/nx-cloud/public-api';
const specificationUrl =
  process.env.NX_CLOUD_OPENAPI_URL ??
  'https://cloud.nx.app/nx-cloud/data/openapi.json';

test('renders operations from the deployed spec and resolves schema links', async ({
  page,
  request,
}) => {
  const [response] = await Promise.all([
    request.get(specificationUrl),
    page.goto(referencePath),
  ]);
  expect(response.ok()).toBe(true);
  const specification = await response.json();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    specification.info.title
  );
  await expect(
    page.getByRole('link', { name: 'deployed OpenAPI specification' })
  ).toHaveAttribute('href', specificationUrl);
  await expect(
    page.getByText('Use CiAccessToken.', { exact: true })
  ).toBeVisible();
  const workspaceIdLabel =
    specification.components.securitySchemes.workspaceId['x-displayName'] ??
    'WorkspaceId';
  await expect(
    page.getByText(
      `Or, use both PersonalAccessToken and ${workspaceIdLabel}.`,
      {
        exact: true,
      }
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      'Use one of these alternatives. Schemes in the same alternative are required together.',
      { exact: true }
    )
  ).toHaveCount(0);

  const headings = (await page.getByRole('heading').allTextContents()).map(
    (heading) => heading.replace(/[‘’]/g, "'")
  );
  for (const [path, item] of Object.entries(specification.paths)) {
    for (const [method, operation] of Object.entries(
      item as Record<string, { summary?: string }>
    )) {
      if (
        ![
          'get',
          'put',
          'post',
          'delete',
          'options',
          'head',
          'patch',
          'trace',
        ].includes(method)
      )
        continue;
      await expect(
        page.getByText(`${method.toUpperCase()} ${path}`, { exact: true })
      ).toBeVisible();
      if (operation.summary) {
        expect(headings).toContain(operation.summary);
      }
    }
  }

  for (const [name, scheme] of Object.entries(
    specification.components.securitySchemes as Record<
      string,
      { 'x-displayName'?: string }
    >
  )) {
    const label =
      scheme['x-displayName'] ?? name.charAt(0).toUpperCase() + name.slice(1);
    await expect(
      page.getByRole('heading', { name: label, level: 3, exact: true })
    ).toHaveCount(1);
  }

  const missingSchemaAnchors = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#schema-"]')]
      .map((link) => decodeURIComponent(link.hash.slice(1)))
      .filter((id) => !document.getElementById(id))
  );
  expect(missingSchemaAnchors).toEqual([]);
});

test('shows shared response details once and links response codes to them', async ({
  page,
  request,
}) => {
  const [response] = await Promise.all([
    request.get(specificationUrl),
    page.goto(referencePath),
  ]);
  expect(response.ok()).toBe(true);
  const specification = await response.json();
  await expect(
    page.getByRole('heading', { name: 'HTTP response codes', exact: true })
  ).toHaveCount(1);
  const commonCodes = [
    '429 Too Many Requests',
    '503 Service Unavailable',
    ...Object.entries({
      '400': '400 Bad Request',
      '404': '404 Not Found',
      '409': '409 Conflict',
    })
      .filter(([status]) => specification.components?.responses?.[status])
      .map(([, name]) => name),
  ];
  for (const name of commonCodes) {
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(
      1
    );
  }
  for (const name of ['RateLimit', 'RateLimit-Policy']) {
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(
      1
    );
  }
  const headings = await page.getByRole('heading').allTextContents();
  expect(headings.some((heading) => heading.includes('PageResponse_'))).toBe(
    false
  );
  await expect(
    page.getByText('Example: completed.', { exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByText('Example response', { exact: true }).first()
  ).toBeHidden();
  const responseLink = page
    .getByRole('link', { name: '429', exact: true })
    .first();
  const fragment = await responseLink.getAttribute('href');
  await responseLink.click();
  await expect(page).toHaveURL(new RegExp(`${fragment}$`));
  await expect(
    page.getByRole('heading', { name: '429 Too Many Requests', exact: true })
  ).toBeInViewport();
});

test('collapses response bodies by default and reveals them through their summary or response code link', async ({
  page,
}) => {
  await page.goto(referencePath);
  const bodies = page.locator('details').filter({
    has: page.locator('summary', { hasText: /^Response body$/ }),
  });
  const firstBody = bodies.first();
  const summary = firstBody.locator('summary');
  const schemaLink = firstBody.locator('a[href^="#schema-"]').first();
  await expect(summary).toBeVisible();
  expect(
    await bodies.evaluateAll((elements) =>
      elements.every((element) => !element.hasAttribute('open'))
    )
  ).toBe(true);
  await expect(schemaLink).toBeHidden();
  await summary.click();
  await expect(firstBody).toHaveJSProperty('open', true);
  await expect(schemaLink).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(firstBody).toHaveJSProperty('open', false);
  await page.getByRole('link', { name: '200', exact: true }).first().click();
  await expect(firstBody).toHaveJSProperty('open', true);
  await expect(schemaLink).toBeInViewport();
});

test('exports generated Markdown and includes the reference in the AI index', async ({
  request,
}) => {
  const markdown = await request.get(`${referencePath}.md`);
  expect(markdown.ok()).toBe(true);
  const body = await markdown.text();
  expect(body).toContain('## Authentication');
  expect(body).toContain('## Operations');
  expect(body).toContain('## Schemas');

  const index = await request.get('/docs/reference/llms.txt');
  expect(index.ok()).toBe(true);
  expect(await index.text()).toContain(
    '/docs/reference/nx-cloud/public-api.md'
  );
});
