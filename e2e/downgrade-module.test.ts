import {
  ensureProject,
  runCLI,
  uniq,
  updateFile,
  forEachCli,
  supportUi,
  patchKarmaToWorkOnWSL
} from './utils';

forEachCli('angular', () => {
  describe('DowngradeModule', () => {
    it('should generate a downgradeModule setup', async () => {
      ensureProject();

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

      runCLI(`build ${myapp}`);
      expect(runCLI(`test ${myapp} --no-watch`)).toContain('3 SUCCESS');
    }, 1000000);
  });
});

forEachCli('nx', () => {
  describe('DowngradeModule', () => {
    it('not supported', async () => {}, 1000000);
  });
});
