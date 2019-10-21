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

          const mylib2 = uniq('test-ui-lib2');
          createTestUILib(mylib2);

          runCLI(
            `generate @nrwl/storybook:configuration ${mylib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
          );
          runCLI(
            `generate @nrwl/storybook:configuration ${mylib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/storybook:configuration ${mylib2} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
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
