import { ensureProject, forEachCli } from './utils';

forEachCli(() => {
  describe('create playground', () => {
    it('create playground', () => {
      ensureProject();
    }, 120000);
  });
});
