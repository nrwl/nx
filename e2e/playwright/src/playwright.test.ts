import {
  cleanupProject,
  newProject,
  uniq,
  runCLI,
  ensurePlaywrightBrowsersInstallation,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;
describe('Playwright E2E Test runner', () => {
  beforeAll(() => {
    newProject({ name: uniq('playwright') });
  });

  afterAll(() => cleanupProject());

  it(
    'should test example app',
    () => {
      runCLI(`g @nx/js:lib demo-e2e --unitTestRunner none --bundler none`);
      runCLI(`g @nx/playwright:configuration --project demo-e2e`);
      ensurePlaywrightBrowsersInstallation();

      const results = runCLI(`e2e demo-e2e`);
      expect(results).toContain('6 passed');
      expect(results).toContain('Successfully ran target e2e for project');
    },
    TEN_MINS_MS
  );

  it(
    'should test example app with js',
    () => {
      runCLI(
        `g @nx/js:lib demo-js-e2e --unitTestRunner none --bundler none --js`
      );
      runCLI(`g @nx/playwright:configuration --project demo-js-e2e --js`);
      ensurePlaywrightBrowsersInstallation();

      const results = runCLI(`e2e demo-js-e2e`);
      expect(results).toContain('6 passed');
      expect(results).toContain('Successfully ran target e2e for project');
    },
    TEN_MINS_MS
  );
});
