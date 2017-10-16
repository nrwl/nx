import { cleanup, copyMissingPackages, newApp, ngNew, readFile, runCLI, runSchematic, updateFile } from '../utils';

describe('DowngradeModule', () => {
  beforeEach(cleanup);

  it(
    'should generate a downgradeModule setup',
    () => {
      ngNew('--collection=@nrwl/schematics');
      newApp('myapp');

      copyMissingPackages();
      updateFile('apps/myapp/src/legacy.js', `window.angular.module('legacy', []);`);

      runCLI('generate downgrade-module legacy --angularJsImport=./legacy');

      runCLI('build');
      expect(runCLI('test --single-run')).toContain('Executed 1 of 1 SUCCESS');
    },
    100000
  );
});
