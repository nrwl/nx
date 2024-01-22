import { Page, test, expect } from '@playwright/test';
/**
 * Assert a text is present on the visited page.
 * @param page
 * @param path
 * @param title
 * @param selector
 */
export function assertTextOnPage(
  path: string,
  title: string,
  selector: string = 'h1'
): void {
  test.describe(path, () =>
    test(`should display "${title}"`, async ({ page }) => {
      await page.goto(path);
      const locator = page.locator(selector);
      await expect(locator).toContainText(title);
    })
  );
}
