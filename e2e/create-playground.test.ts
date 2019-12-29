import { ensureProject, forEachCli, newProject, runCLI } from './utils';

forEachCli('angular', () => {
  describe('create playground', () => {
    it('create playground', () => {
      newProject();
    }, 120000);
  });
});
