import { test, expect } from '@playwright/test';

test.describe('CLI sub-command formatting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs/reference/nx-commands');
    await expect(
      page.getByRole('heading', { name: 'Nx Commands' })
    ).toBeVisible();
  });

  test('parent commands render as h2 and sub-commands as h3', async ({
    page,
  }) => {
    const mainContent = page.getByTestId('main-pane');

    // "nx show" should be an h2 (top-level parent command)
    const showHeading = mainContent.getByRole('heading', {
      name: 'nx show',
      level: 2,
      exact: true,
    });
    await expect(showHeading).toBeVisible();

    // "nx show projects" should be an h3 (sub-command nested under parent)
    const showProjectsHeading = mainContent.getByRole('heading', {
      name: 'nx show projects',
      level: 3,
      exact: true,
    });
    await expect(showProjectsHeading).toBeVisible();

    // "nx show project" should also be an h3
    const showProjectHeading = mainContent.getByRole('heading', {
      name: 'nx show project',
      level: 3,
      exact: true,
    });
    await expect(showProjectHeading).toBeVisible();
  });

  test('sub-command usage blocks show the full command name', async ({
    page,
  }) => {
    const mainContent = page.getByTestId('main-pane');

    // Find the "nx show projects" section and verify its usage block
    // The usage code block should contain "nx show projects", not "nx projects"
    const showProjectsHeading = mainContent.getByRole('heading', {
      name: 'nx show projects',
      level: 3,
      exact: true,
    });
    await expect(showProjectsHeading).toBeVisible();

    // Get the section between "nx show projects" heading and the next heading.
    // We look for a code block containing the correct usage pattern.
    const codeBlocks = mainContent.locator('pre code');
    const allCodeTexts = await codeBlocks.allTextContents();

    // There should be a usage block with "nx show projects" (full sub-command name)
    expect(allCodeTexts.some((text) => text.includes('nx show projects'))).toBe(
      true
    );

    // There should NOT be a usage block with just "nx projects" (missing parent)
    expect(
      allCodeTexts.some(
        (text) => text.match(/^nx projects/) || text.match(/\nnx projects/)
      )
    ).toBe(false);
  });

  test('release sub-commands use correct heading and usage format', async ({
    page,
  }) => {
    const mainContent = page.getByTestId('main-pane');

    // "nx release" should be h2
    const releaseHeading = mainContent.getByRole('heading', {
      name: 'nx release',
      level: 2,
      exact: true,
    });
    await expect(releaseHeading).toBeVisible();

    // "nx release version" should be h3
    const releaseVersionHeading = mainContent.getByRole('heading', {
      name: 'nx release version',
      level: 3,
      exact: true,
    });
    await expect(releaseVersionHeading).toBeVisible();

    // Verify usage block includes the full command
    const codeBlocks = mainContent.locator('pre code');
    const allCodeTexts = await codeBlocks.allTextContents();

    expect(
      allCodeTexts.some((text) => text.includes('nx release version'))
    ).toBe(true);
  });

  test('options and examples are h4 headings excluded from the TOC', async ({
    page,
  }) => {
    const mainContent = page.getByTestId('main-pane');

    // Options/Examples should be h4 headings — linkable but below the TOC threshold (h2-h3)
    const sharedOptionsHeading = mainContent.getByRole('heading', {
      name: 'Shared Options',
      level: 4,
    });
    await expect(sharedOptionsHeading.first()).toBeVisible();

    const optionsHeading = mainContent.getByRole('heading', {
      name: 'Options',
      level: 4,
    });
    await expect(optionsHeading.first()).toBeVisible();

    // They should NOT appear as h2 or h3 (which would put them in the TOC)
    await expect(
      mainContent.getByRole('heading', { name: 'Options', level: 2 })
    ).toHaveCount(0);
    await expect(
      mainContent.getByRole('heading', { name: 'Options', level: 3 })
    ).toHaveCount(0);
  });
});
