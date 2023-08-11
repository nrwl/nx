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
    newProject();
    runCLI(`g @nx/angular:library ${angularStorybookLib} --no-interactive`);
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

    // TODO(@mandarini): reenable test after debugging flakiness
    xit('shoud build an Angular based storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
    }, 200_000);
  });
});
