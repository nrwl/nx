import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('bundling libs', () => {
  let scope: string;

  beforeEach(() => {
    scope = newProject();
  });

  afterEach(() => cleanupProject());

  it('should support esbuild and vite bundlers for building libs', () => {
    const esbuildLib = uniq('esbuildlib');
    const viteLib = uniq('vitelib');

    runCLI(
      `generate @nx/js:lib ${esbuildLib} --bundler=esbuild --no-interactive`
    );
    runCLI(`generate @nx/js:lib ${viteLib} --bundler=vite --no-interactive`);

    runCLI(`build ${esbuildLib}`);
    runCLI(`build ${viteLib}`);

    checkFilesExist(`dist/libs/${esbuildLib}/index.js`);
    checkFilesExist(`dist/libs/${viteLib}/index.js`);
  }, 240_000);
});
