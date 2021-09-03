import {
  checkFilesExist,
  checkFilesDoNotExist,
  isNotWindows,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runCypressTests,
  updateFile,
  uniq,
} from '@nrwl/e2e/utils';

describe('Webpack 5: React Apps', () => {
  it('should successfully build and run E2E tests', async () => {
    const appName = uniq('app');

    newProject();
    runCLI(`generate @nrwl/react:app ${appName} --style css`);
    runCLI(`generate @nrwl/web:webpack5`);

    // Make the entry file large to make sure it doesn't split
    updateFile(
      `apps/${appName}/src/styles.css`,
      Array.from({ length: 2000 })
        .map((_, i) => `.class-${i} { color: red; }`)
        .join('\n')
    );

    runCLI(`build ${appName} --prod --output-hashing none`);

    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.esm.js`,
      `dist/apps/${appName}/main.esm.js`,
      `dist/apps/${appName}/styles.css`
    );

    checkFilesDoNotExist(`dist/apps/${appName}/styles.js`);

    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      `<link rel="stylesheet" href="styles.css">`
    );

    if (isNotWindows() && runCypressTests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e --headless --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }
  }, 500000);
});
