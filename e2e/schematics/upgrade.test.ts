import {
  addAngularJs, addNgRx, checkFilesExists, cleanup, newApp, readFile, runCLI, runCommand, runSchematic,
  updateFile
} from '../utils';
import {execSync} from 'child_process';

describe('Upgrade', () => {
  beforeEach(cleanup);

  it('should generate an upgrade shell', () => {
    newApp('new proj --skip-install');
    // addNgRx('proj');
    // addAngularJs('proj');
    updateFile('proj/src/legacy.js', `
      const angular = angular.module('legacy', []);
      angular.component('main', {
        template: 'main-component'
      });
    `);

    console.log(runSchematic('@nrwl/schematics:upgrade-shell --module=src/app/app.module.ts --name=legacy', {projectName: 'proj'}));
  }, 50000);

});

