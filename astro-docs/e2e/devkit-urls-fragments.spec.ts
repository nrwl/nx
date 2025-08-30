import { test, expect } from '@playwright/test';

test('links in descriptions of properties should correctly link to the same page w/ url fragments', async ({
  page,
}) => {
  await page.goto('/docs/reference/devkit/NxJsonConfiguration');

  await expect(
    page.getByRole('heading', { name: 'NxJsonConfiguration' })
  ).toBeVisible();

  await page.getByRole('link', { name: 'nxCloudAccessToken' }).click();

  await expect(
    page.getByRole('heading', { name: 'nxCloudAccessToken' })
  ).toBeVisible();

  const description = page
    .getByRole('paragraph')
    .filter({ has: page.getByRole('link', { name: 'tasksRunnerOptions' }) })
    .first();
  await expect(description).toBeVisible();

  const linkedProperty = description.getByRole('link', {
    name: 'tasksRunnerOptions',
  });

  await expect(linkedProperty).toBeVisible();

  await expect(linkedProperty).toHaveAttribute(
    'href',
    '/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions'
  );

  await linkedProperty.click();

  expect(page.url()).toContain('#tasksrunneroptions');

  await expect(
    page.getByRole('heading', { name: 'tasksRunnerOptions' })
  ).toBeVisible();
});
