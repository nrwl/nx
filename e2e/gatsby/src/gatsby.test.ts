import {
  checkFilesExist,
  expectTestsPass,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Gatsby Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should generate a valid gatsby application', async () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/gatsby:app ${appName} --style css --no-interactive`);
    runCLI(
      `generate @nrwl/gatsby:component header --project ${appName} --style css --no-interactive`
    );

    checkFilesExist(
      `apps/${appName}/package.json`,
      `apps/${appName}/src/components/header.tsx`,
      `apps/${appName}/src/components/header.spec.tsx`,
      `apps/${appName}/src/pages/index.tsx`,
      `apps/${appName}/src/pages/index.spec.tsx`
    );

    updateFile(`apps/${appName}/src/pages/index.tsx`, (content) => {
      let updated = `import Header from '../components/header';\n${content}`;
      updated = updated.replace('<main>', '<Header /><main>');
      return updated;
    });

    runCLI(`build ${appName}`);
    checkFilesExist(
      `apps/${appName}/public/index.html`,
      `apps/${appName}/public/404.html`,
      `apps/${appName}/public/manifest.webmanifest`
    );

    const result = runCLI(`lint ${appName}`);
    expect(result).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${appName}`));
  }, 600000);

  it('should support styled-jsx', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/gatsby:app ${appName} --style styled-jsx --no-interactive`
    );

    runCLI(`build ${appName}`);
    checkFilesExist(
      `apps/${appName}/public/index.html`,
      `apps/${appName}/public/404.html`,
      `apps/${appName}/public/manifest.webmanifest`
    );

    const result = runCLI(`lint ${appName}`);
    expect(result).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${appName}`));
  }, 300000);

  it('should support scss', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/gatsby:app ${appName} --style scss --no-interactive`
    );

    runCLI(`build ${appName}`);
    checkFilesExist(
      `apps/${appName}/public/index.html`,
      `apps/${appName}/public/404.html`,
      `apps/${appName}/public/manifest.webmanifest`
    );

    const result = runCLI(`lint ${appName}`);
    expect(result).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${appName}`));
  }, 300000);

  it('should support --js option', async () => {
    const app = uniq('app');
    runCLI(
      `generate @nrwl/gatsby:app ${app} --js --style css --no-interactive`
    );

    checkFilesExist(
      `apps/${app}/package.json`,
      `apps/${app}/src/pages/index.js`,
      `apps/${app}/src/pages/index.spec.js`
    );

    runCLI(`build ${app}`);
    checkFilesExist(
      `apps/${app}/public/index.html`,
      `apps/${app}/public/404.html`,
      `apps/${app}/public/manifest.webmanifest`
    );
    expectTestsPass(await runCLIAsync(`test ${app}`));
  }, 300000);
});
