import {cleanup, copyMissingPackages, newApp, ngNew, readFile, runCLI, runSchematic, updateFile} from '../utils';

describe('Upgrade', () => {
  beforeEach(cleanup);

  it('should generate an upgrade shell', () => {
    ngNew('--collection=@nrwl/schematics');
    newApp('myapp');

    copyMissingPackages();
    updateFile('apps/myapp/src/legacy.js', `
      const angular = window.angular.module('legacy', []);
      angular.component('rootLegacyCmp', {
        template: 'Expected Value'
      });
    `);

    updateFile('apps/myapp/src/app/app.component.html', `
      EXPECTED [<rootLegacyCmp></rootLegacyCmp>]
    `);

    updateFile('apps/myapp/src/app/app.component.spec.ts', ``);

    runCLI(
        'generate upgrade-shell legacy --module=apps/myapp/src/app/app.module.ts --angularJsImport=../legacy ' +
        '--angularJsCmpSelector=rootLegacyCmp');

    runCLI('build');
    runCLI('test --single-run');
  }, 50000);

  it('should update package.json', () => {
    ngNew('--skip-install');
    runCLI(
        'generate upgrade-shell legacy --module=src/app/app.module.ts --angularJsImport=../legacy ' +
        '--angularJsCmpSelector=rootLegacyCmp --collection=@nrwl/schematics');

    const contents = JSON.parse(readFile('package.json'));
    expect(contents.dependencies['@angular/upgrade']).toBeDefined();
    expect(contents.dependencies['angular']).toBeDefined();
  });

  it('should not update package.json when --skipPackageJson', () => {
    ngNew('--skipInstall');
    runCLI(
        'generate upgrade-shell legacy --module=src/app/app.module.ts --angularJsImport=../legacy ' +
        '--angularJsCmpSelector=rootLegacyCmp --skipPackageJson --collection=@nrwl/schematics');

    const contents = JSON.parse(readFile('package.json'));
    expect(contents.dependencies['@angular/upgrade']).not.toBeDefined();
  });
});
