import { ensureProject, runCLI, uniq, forEachCli } from './utils';
import { toClassName } from '@nrwl/workspace';

forEachCli(() => {
  describe('Protractor', () => {
    beforeEach(() => {
      ensureProject();
    });

    it('should work', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --directory=myDir --routing --e2eTestRunner=protractor`
      );

      try {
        const r = runCLI(`e2e my-dir-${myapp}-e2e --no-webdriver-update`);
        console.log(r);
        expect(r).toContain('Executed 1 of 1 spec SUCCESS');
      } catch (e) {
        console.log(e);
        if (e.stdout) {
          console.log(e.stdout.toString());
        }
        if (e.stderr) {
          console.log(e.stdout.toString());
        }
        throw e;
      }
    }, 1000000);
  });
});
