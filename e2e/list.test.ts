import { renameSync } from 'fs';
import { forEachCli, newProject, runCommand, tmpProjPath } from './utils';

const testTimeout = 120000;

forEachCli(() => {
  describe('list', () => {
    beforeEach(() => {
      newProject();
    });

    it(
      `should work`,
      async () => {
        let listOutput = runCommand('npm run nx -- list');

        expect(listOutput).toContain('NX  Installed plugins');

        // just check for some, not all
        expect(listOutput).toContain('@nrwl/angular');
        expect(listOutput).toContain('@schematics/angular');
        expect(listOutput).toContain('@ngrx/store');

        expect(listOutput).not.toContain('NX  Also available');

        // temporarily make it look like this isn't installed
        renameSync(
          tmpProjPath('node_modules/@nrwl/angular'),
          tmpProjPath('node_modules/@nrwl/angular_tmp')
        );

        listOutput = runCommand('npm run nx -- list');
        expect(listOutput).toContain('NX  Also available');

        // look for specific plugin
        listOutput = runCommand('npm run nx -- list @nrwl/workspace');

        expect(listOutput).toContain('Capabilities in @nrwl/workspace');

        // check for schematics
        expect(listOutput).toContain('workspace');
        expect(listOutput).toContain('ng-add');
        expect(listOutput).toContain('library');

        // check for builders
        expect(listOutput).toContain('run-commands');

        // look for uninstalled approved plugin
        listOutput = runCommand('npm run nx -- list @nrwl/angular');

        expect(listOutput).toContain(
          'NX   NOTE  @nrwl/angular is not currently installed'
        );

        // look for an unknown plugin
        listOutput = runCommand('npm run nx -- list @wibble/fish');

        expect(listOutput).toContain(
          'NX   ERROR  Could not find plugin @wibble/fish'
        );

        // put back the @nrwl/angular module (or all the other e2e tests after this will fail)
        renameSync(
          tmpProjPath('node_modules/@nrwl/angular_tmp'),
          tmpProjPath('node_modules/@nrwl/angular')
        );
      },
      testTimeout
    );
  });
});
