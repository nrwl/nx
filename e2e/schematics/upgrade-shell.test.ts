import {cleanup, copyMissingPackages, newApp, readFile, runCLI, runSchematic, updateFile} from '../utils';

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

  it('should update package.json', () => {
    newApp('new proj2 --skipInstall');

    runSchematic('@nrwl/schematics:upgrade-shell ' +
      '--module=src/app/app.module.ts '+
      '--angularJsImport=../legacy ' +
      '--angularJsCmpSelector=rootLegacyCmp',
      {projectName: 'proj2'}
    );

    const contents = JSON.parse(readFile('proj2/package.json'));
    expect(contents.dependencies['@angular/upgrade']).toBeDefined();
    expect(contents.dependencies['angular']).toBeDefined();
  });

  it('should not update package.json when --skipPackageJson', () => {
    newApp('new proj3 --skipInstall');

    runSchematic('@nrwl/schematics:upgrade-shell ' +
      '--module=src/app/app.module.ts '+
      '--angularJsImport=../legacy ' +
      '--angularJsCmpSelector=rootLegacyCmp ' +
      '--skipPackageJson',
      {projectName: 'proj3'}
    );

    const contents = JSON.parse(readFile('proj3/package.json'));
    expect(contents.dependencies['@angular/upgrade']).not.toBeDefined();
  });
});

