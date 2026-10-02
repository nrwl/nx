import { expect, test } from '@playwright/test';

const referencePath = '/docs/reference/nx-cloud/public-api';

test('renders the reference with usable schema links and a Markdown export', async ({
  page,
  request,
}) => {
  await page.goto(referencePath);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const name of ['Endpoint reference', 'Schema and field definitions']) {
    await expect(
      page.getByRole('heading', { name, level: 2, exact: true })
    ).toBeVisible();
  }

  await expect(page.locator('a[href^="#schema-"]').first()).toBeAttached();
  const missingSchemaAnchors = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#schema-"]')]
      .map((link) => decodeURIComponent(link.hash.slice(1)))
      .filter((id) => !document.getElementById(id))
  );
  expect(missingSchemaAnchors).toEqual([]);

  const responseBody = page
    .locator('details')
    .filter({
      has: page.locator('summary', { hasText: /^Response body/ }),
    })
    .first();
  await expect(responseBody).toHaveJSProperty('open', false);
  await responseBody.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(responseBody).toHaveJSProperty('open', true);

  const markdown = await request.get(`${referencePath}.md`);
  expect(markdown.ok()).toBe(true);
  const body = await markdown.text();
  expect(body).toContain('## Endpoint reference');
  expect(body).toContain('API version:');
  expect(body).toContain('Other response codes:');
  expect(body).toContain('/docs/kb/migrate-public-api-to-v1');

  const fullMarkdown = await request.get('/docs/llms-full.txt');
  expect(fullMarkdown.ok()).toBe(true);
  expect(await fullMarkdown.text()).toContain(
    '/docs/reference/nx-cloud/public-api.md -->'
  );
});
