import { recommendedCollectionMap } from '@nrwl/workspace/src/utils/collections';
import {
  ensureProject,
  forEachCli,
  newProject,
  readJson,
  runCommand,
  updateFile
} from './utils';

const testTimeout = 120000;

forEachCli(() => {
  describe('list', () => {
    describe('existing schematic interrogation', () => {
      beforeEach(() => {
        ensureProject();
      });

      it(
        `should list installed collections`,
        async () => {
          const listOutput = runCommand('npm run nx -- list');

          expect(listOutput).toContain('NX  Installed collections');

          // just check for some, not all
          expect(listOutput).toContain('@nrwl/angular');
          expect(listOutput).toContain('@schematics/angular');
          expect(listOutput).toContain('@ngrx/store');
        },
        testTimeout
      );

      it(
        `should list available schematics in a collection`,
        async () => {
          const listOutput = runCommand('npm run nx -- list @nrwl/angular');

          expect(listOutput).toContain('Available schematics in @nrwl/angular');

          // just check for some, not all
          expect(listOutput).toContain('init');
          expect(listOutput).toContain('application');
          expect(listOutput).toContain('library');
        },
        testTimeout
      );
    });

    it(
      `should list recommended schematic collections`,
      async () => {
        newProject();

        let listOutput = runCommand('npm run nx -- list --recommended');

        expect(listOutput).toContain(
          'The following collections are available to install'
        );

        // just check for some, not all
        expect(listOutput).toContain('@nrwl/cypress INSTALLED');
        expect(listOutput).toContain('@nrwl/jest INSTALLED');

        // Add @angular/core to the package.json
        const dummyVersion = '0.0.1'; // versions are irrelevant to this test
        const packageJson = readJson('package.json');
        packageJson.dependencies['@angular/core'] = dummyVersion;
        updateFile('package.json', JSON.stringify(packageJson));

        listOutput = runCommand('npm run nx -- list --recommended');

        expect(listOutput).toContain(
          'For your current workspace the following collections are recommended'
        );
        expect(listOutput).toContain(
          'You may also consider the following collections'
        );

        // Add the rest
        Object.values(recommendedCollectionMap)
          .filter(x => x.for)
          .reduce((acc, current) => {
            acc.push(...current.for);
            return acc;
          }, [])
          .forEach(dep => {
            packageJson.dependencies[dep] = dummyVersion;
          });
        updateFile('package.json', JSON.stringify(packageJson));

        listOutput = runCommand('npm run nx -- list --recommended');

        expect(listOutput).toContain(
          'For your current workspace the following collections are recommended'
        );
        expect(listOutput).not.toContain(
          'You may also consider the following collections'
        );
      },
      testTimeout
    );
  });
});
