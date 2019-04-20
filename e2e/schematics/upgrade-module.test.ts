import {
  ensureProject,
  patchKarmaToWorkOnWSL,
  runCLI,
  uniq,
  updateFile
} from '../utils';

describe('Upgrade', () => {
  it('should generate an UpgradeModule setup', async () => {
    ensureProject();
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

    runCLI(`build ${myapp}`);
    expect(runCLI(`test ${myapp} --no-watch`)).toContain('1 SUCCESS');
  }, 1000000);
});
