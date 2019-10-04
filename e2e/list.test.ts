import { ensureProject, forEachCli, runCommand } from './utils';

const testTimeout = 120000;

forEachCli(() => {
  describe('list', () => {
    beforeEach(() => {
      ensureProject();
    });

    it(
      `should list available collections`,
      async () => {
        const listOutput = runCommand('npm run nx list');

        expect(listOutput).toContain('Available collections');
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
        const listOutput = runCommand('npm run nx list @nrwl/angular');

        expect(listOutput).toContain('Available schematics in @nrwl/angular');
        // just check for some, not all
        expect(listOutput).toContain('init');
        expect(listOutput).toContain('application');
        expect(listOutput).toContain('library');
      },
      testTimeout
    );
  });
});
