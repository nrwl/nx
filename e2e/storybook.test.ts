import {
  createTestUILib,
  forEachCli,
  runCLI,
  supportUi,
  newProject,
  runYarnInstall,
  uniq
} from './utils';

forEachCli(() => {
  describe('Storybook schematics', () => {
    if (supportUi()) {
      describe('running Storybook and Cypress', () => {
        it('should execute e2e tests using Cypress running against Storybook', () => {
          newProject();

          const myapp = uniq('myapp');
          runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

          const mylib = uniq('test-ui-lib');
          createTestUILib(mylib);

          runCLI(
            `generate @nrwl/storybook:configuration ${mylib} --configureCypress --generateStories --generateCypressSpecs --noInteractive`
          );
          runYarnInstall();

          expect(
            runCLI(`run ${mylib}-e2e:e2e --configuration=headless --no-watch`)
          ).toContain('All specs passed!');
        }, 1000000);
      });
    }
  });
});
