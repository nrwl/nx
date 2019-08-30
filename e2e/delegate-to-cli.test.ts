import {
  ensureProject,
  uniq,
  runCommand,
  checkFilesExist,
  forEachCli
} from './utils';

forEachCli(() => {
  describe('Delegate to CLI', () => {
    it('should delegate to the cli all non-standard commands', async () => {
      ensureProject();

      const appName = uniq('app');
      runCommand(`npm run nx -- g @nrwl/web:app ${appName}`);
      runCommand(`npm run nx -- build ${appName} --prod --outputHashing none`);

      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.esm.js`,
        `dist/apps/${appName}/main.esm.js`,
        `dist/apps/${appName}/polyfills.es5.js`,
        `dist/apps/${appName}/main.es5.js`,
        `dist/apps/${appName}/styles.css`
      );
    }, 120000);
  });
});
