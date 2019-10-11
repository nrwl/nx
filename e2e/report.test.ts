import { packagesWeCareAbout } from '@nrwl/workspace/src/command-line/report';
import { ensureProject, forEachCli, runCommand } from './utils';

const testTimeout = 120000;

forEachCli(() => {
  describe('report', () => {
    it(
      `should report package versions`,
      async () => {
        ensureProject();

        const reportOutput = runCommand('npm run nx report');

        packagesWeCareAbout.forEach(p => {
          expect(reportOutput).toContain(p);
        });
      },
      testTimeout
    );
  });
});
