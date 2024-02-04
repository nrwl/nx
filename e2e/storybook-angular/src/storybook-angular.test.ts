import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';

describe('Storybook executors for Angular', () => {
  const angularStorybookLib = uniq('test-ui-ng-lib');
  beforeAll(() => {
    newProject({
      packages: ['@nx/angular'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `g @nx/angular:library ${angularStorybookLib} --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('serve and build storybook', () => {
    afterAll(() => killPorts());

    it('should serve an Angular based Storybook setup', async () => {
      const p = await runCommandUntil(
        `run ${angularStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 200_000);

    // Increased timeout because 92% sealing asset processing TerserPlugin
    // TODO(meeroslav) this test is still flaky and breaks the PR runs. We need to investigate why.
    xit('shoud build an Angular based storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook`);
      checkFilesExist(`${angularStorybookLib}/storybook-static/index.html`);
    }, 1_000_000);
  });
});
