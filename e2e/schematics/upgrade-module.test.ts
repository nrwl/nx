import { cleanup, copyMissingPackages, newApp, ngNew, readFile, runCLI, runSchematic, updateFile } from '../utils';

describe('Upgrade', () => {
  beforeEach(cleanup);

  it(
    'should generate an UpgradeModule setup',
    () => {
      ngNew('--collection=@nrwl/schematics');
      newApp('myapp');

      copyMissingPackages();
      updateFile(
        'apps/myapp/src/legacy.js',
        `
      const angular = window.angular.module('legacy', []);
      angular.component('rootLegacyCmp', {
        template: 'Expected Value'
      });
    `
      );

      updateFile(
        'apps/myapp/src/app/app.component.html',
        `
      EXPECTED [<rootLegacyCmp></rootLegacyCmp>]
    `
      );

      updateFile('apps/myapp/src/app/app.component.spec.ts', ``);

      runCLI('generate upgrade-module legacy --angularJsImport=./legacy ' + '--angularJsCmpSelector=rootLegacyCmp');

      runCLI('build');
      runCLI('test --single-run');
    },
    100000
  );
});
