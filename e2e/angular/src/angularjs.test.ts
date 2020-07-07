import {
  ensureProject,
  runCLI,
  uniq,
  updateFile,
  forEachCli,
  patchKarmaToWorkOnWSL,
  runCommand,
} from '@nrwl/e2e/utils';

forEachCli('angular', () => {
  // TODO: This test is super flaky, investigate and re-enable.
  describe('AngularJS Schematics', () => {
    beforeEach(() => {
      ensureProject();
    });

    describe('DowngradeModule', () => {
      it('should generate a downgradeModule setup', async () => {
        const myapp = uniq('myapp');
        runCLI(`generate @nrwl/angular:app ${myapp} --unit-test-runner=karma`);
        patchKarmaToWorkOnWSL();

        updateFile(
          `apps/${myapp}/src/legacy.js`,
          `window.angular.module('legacy', []);`
        );

        runCLI(
          `generate @nrwl/angular:downgrade-module legacy --angularJsImport=./legacy --project=${myapp}`
        );

        runCommand('yarn postinstall');

        runCLI(`build ${myapp}`);
        expect(runCLI(`test ${myapp} --no-watch`)).toContain('3 SUCCESS');
      }, 1000000);
    });

    describe('UpgradeModule', () => {
      it('should generate an UpgradeModule setup', async () => {
        const myapp = uniq('myapp');
        runCLI(`generate @nrwl/angular:app ${myapp} --unit-test-runner=karma`);
        patchKarmaToWorkOnWSL();

        updateFile(
          `apps/${myapp}/src/legacy.js`,
          `
      const angular = window.angular.module('legacy', []);
      angular.component('proj-root-legacy', {
        template: 'Expected Value'
      });
    `
        );

        updateFile(
          `apps/${myapp}/src/app/app.component.html`,
          `
      EXPECTED [<proj-root-legacy></proj-root-legacy>]
    `
        );

        updateFile(`apps/${myapp}/src/app/app.component.spec.ts`, ``);

        runCLI(
          'generate @nrwl/angular:upgrade-module legacy --angularJsImport=./legacy ' +
            `--angularJsCmpSelector=proj-root-legacy --project=${myapp}`
        );

        runCommand('yarn postinstall');

        runCLI(`build ${myapp}`);
        expect(runCLI(`test ${myapp} --no-watch`)).toContain('1 SUCCESS');
      }, 1000000);
    });
  });
});

forEachCli('nx', () => {
  describe('DowngradeModule', () => {
    it('not supported', async () => {}, 1000000);
  });
});
