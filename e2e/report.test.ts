import { packagesWeCareAbout } from '@nrwl/workspace/src/command-line/report';
import { ensureProject, forEachCli, runCLI } from './utils';

const testTimeout = 120000;

forEachCli('nx', () => {
  describe('report', () => {
    it(
      `should report package versions`,
      async () => {
        ensureProject();

        const reportOutput = runCLI('report');

        packagesWeCareAbout.forEach(p => {
          expect(reportOutput).toContain(p);
        });
      },
      testTimeout
    );
  });
});

forEachCli('angular', () => {
  describe('report', () => {
    it(
      `shouldn't do anything at all`,
      async () => {
        // report is an Nx only command
      },
      testTimeout
    );
  });
});
