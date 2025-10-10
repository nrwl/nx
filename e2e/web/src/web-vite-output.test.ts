import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  runCLI,
  uniq,
} from '@nx/e2e-utils';
import { setupWebViteTest } from './web-vite-setup';

describe('Web Components Applications with bundler set as vite', () => {
  setupWebViteTest();

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=vite --no-interactive --linter=eslint --unitTestRunner=vitest`
    );
    runCLI(
      `generate @nx/react:lib libs/${libName} --bundler=vite --no-interactive --unitTestRunner=vitest --linter=eslint`
    );

    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/libs/${libName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --emptyOutDir`);
    runCLI(`build ${libName} --emptyOutDir`);
    checkFilesDoNotExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/libs/${libName}/_should_remove.txt`
    );
    checkFilesExist(`dist/apps/_should_not_remove.txt`);
  }, 120000);
});
