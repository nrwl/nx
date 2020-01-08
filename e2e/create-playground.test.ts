import { ensureProject, forEachCli, newProject, runCLI } from './utils';

forEachCli(() => {
  describe('create playground', () => {
    it('create playground', () => {
      newProject();
    }, 120000);
  });
});
