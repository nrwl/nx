import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  ensurePlaywrightBrowsersInstallation,
  isNotWindows,
  killPorts,
  newProject,
  readFile,
  rmDist,
  runCLI,
  runCLIAsync,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';
import { copyFileSync } from 'fs';

describe('Web Components Applications', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive --compiler swc`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );
    runCLI(
      `generate @nx/react:lib ${libName} --bundler=rollup --no-interactive --compiler swc --unitTestRunner=jest`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/libs/${libName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --outputHashing none`);
    runCLI(`build ${libName}`);
    checkFilesDoNotExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/libs/${libName}/_should_remove.txt`
    );
    checkFilesExist(`dist/apps/_should_not_remove.txt`);

    // Asset that React runtime is imported
    expect(readFile(`dist/libs/${libName}/index.esm.js`)).toMatch(
      /react\/jsx-runtime/
    );

    // `delete-output-path`
    createFile(`dist/apps/${appName}/_should_keep.txt`);
    runCLI(`build ${appName} --delete-output-path=false --outputHashing none`);
    checkFilesExist(`dist/apps/${appName}/_should_keep.txt`);

    createFile(`dist/libs/${libName}/_should_keep.txt`);
    runCLI(`build ${libName} --delete-output-path=false --outputHashing none`);
    checkFilesExist(`dist/libs/${libName}/_should_keep.txt`);
  }, 120000);
});
