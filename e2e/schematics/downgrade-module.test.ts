import { newApp, newProject, runCLI, updateFile } from '../utils';

xdescribe('DowngradeModule', () => {
  it(
    'should generate a downgradeModule setup',
    () => {
      newProject();
      newApp('myapp');

      updateFile(
        'apps/myapp/src/legacy.js',
        `window.angular.module('legacy', []);`
      );

      runCLI('generate downgrade-module legacy --angularJsImport=./legacy');

      runCLI('build');
      expect(runCLI('test --no-watch')).toContain('Executed 1 of 1 SUCCESS');
    },
    1000000
  );
});
