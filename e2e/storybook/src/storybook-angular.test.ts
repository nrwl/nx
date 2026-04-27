import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  reservePort,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';

describe('Storybook executors for Angular', () => {
  const angularStorybookLib = uniq('test-ui-ng-lib');
  beforeAll(() => {
    newProject({
      packages: ['@nx/angular'],
    });
    runCLI(`g @nx/angular:library ${angularStorybookLib} --no-interactive`);
    runCLI(
      `generate @nx/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('serve and build storybook', () => {
    let storybookPort: number;
    afterAll(() => storybookPort && killPorts(storybookPort));

    // TODO(jack): re-enable when lodash@4.18.0 assignWith bug is resolved
    it.skip('should serve an Angular based Storybook setup', async () => {
      storybookPort = await reservePort();
      const p = await runCommandUntil(
        `run ${angularStorybookLib}:storybook --port ${storybookPort}`,
        (output) => {
          return /Storybook.*(started|ready)/gi.test(output);
        }
      );
      p.kill();
    }, 300_000);

    // Increased timeout because 92% sealing asset processing TerserPlugin
    // TODO(meeroslav) this test is still flaky and breaks the PR runs. We need to investigate why.
    xit('shoud build an Angular based storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook`);
      checkFilesExist(`${angularStorybookLib}/storybook-static/index.html`);
    }, 1_000_000);
  });
});
