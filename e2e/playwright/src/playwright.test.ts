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
    'should test and lint example app',
    () => {
      runCLI(`g @nx/js:lib demo-e2e --unitTestRunner none --bundler none`);
      runCLI(`g @nx/playwright:configuration --project demo-e2e`);
      ensurePlaywrightBrowsersInstallation();

      const e2eResults = runCLI(`e2e demo-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const lintResults = runCLI(`lint demo-e2e`);
      expect(lintResults).toContain('All files pass linting');
    },
    TEN_MINS_MS
  );

  it(
    'should test and lint example app with js',
    () => {
      runCLI(
        `g @nx/js:lib demo-js-e2e --unitTestRunner none --bundler none --js`
      );
      runCLI(`g @nx/playwright:configuration --project demo-js-e2e --js`);
      ensurePlaywrightBrowsersInstallation();

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const lintResults = runCLI(`lint demo-e2e`);
      expect(lintResults).toContain('All files pass linting');
    },
    TEN_MINS_MS
  );
});
