import {cleanup, copyMissingPackages, newApp, runCLI, runSchematic, updateFile} from '../utils';

describe('Upgrade', () => {
  beforeEach(cleanup);

  it('should generate an upgrade shell', () => {
    newApp('new proj');

    copyMissingPackages('proj');
    updateFile('proj/src/legacy.js', `
      const angular = window.angular.module('legacy', []);
      angular.component('rootLegacyCmp', {
        template: 'Expected Value'
      });
    `);

    updateFile('proj/src/app/app.component.html', `
      EXPECTED [<rootLegacyCmp></rootLegacyCmp>]
    `);

    updateFile('proj/src/app/app.component.spec.ts', ``);

    runSchematic('@nrwl/schematics:upgrade-shell ' +
      '--module=src/app/app.module.ts '+
      '--angularJsImport=../legacy ' +
      '--angularJsCmpSelector=rootLegacyCmp',
      {projectName: 'proj'}
    );

    runCLI('build', {projectName: 'proj'});
    runCLI('test --single-run', {projectName: 'proj'});
  }, 50000);
});

