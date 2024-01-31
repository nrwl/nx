import {
  checkFilesExist,
  newProject,
  renameFile,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e/utils';

// TODO(jack): This test file can be removed when Vite goes ESM-only.
// This test ensures that when CJS is gone from the published `vite` package, Nx will continue to work.
describe('Vite ESM tests', () => {
  beforeAll(() =>
    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/react'],
    })
  );

  it('should build with Vite when it is ESM-only', async () => {
    const appName = uniq('viteapp');
    runCLI(`generate @nx/react:app ${appName} --bundler=vite`);

    // .mts file is needed because Nx will transpile .ts files as CJS
    renameFile(
      `apps/${appName}/vite.config.ts`,
      `apps/${appName}/vite.config.mts`
    );

    // Remove CJS entry point for Vite
    updateJson('node_modules/vite/package.json', (json) => {
      for (const [key, value] of Object.entries(json.exports['.'])) {
        if (typeof value === 'string' && value.endsWith('.cjs')) {
          delete json.exports['.'][key];
        }
      }
      return json;
    });

    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/index.html`);
  });
});
