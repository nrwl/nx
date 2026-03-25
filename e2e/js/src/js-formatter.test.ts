import {
  checkFilesDoNotExist,
  cleanupProject,
  newProject,
  readJson,
  removeFile,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('formatter option', () => {
  beforeAll(() => {
    newProject({
      packages: [
        '@nx/js',
        '@nx/node',
        '@nx/react',
        '@nx/web',
        '@nx/jest',
        '@nx/vite',
      ],
    });

    // Remove prettier setup created during workspace init so we can
    // verify generators do not recreate it when formatter=none.
    removeFile('.prettierrc');
    removeFile('.prettierignore');
    updateJson('package.json', (json) => {
      delete json.devDependencies['prettier'];
      return json;
    });
  });

  afterAll(() => cleanupProject());

  function expectNoPrettierSetup() {
    checkFilesDoNotExist('.prettierrc', '.prettierignore');
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['prettier']).toBeUndefined();
  }

  it('should not add prettier when generating a js library with --formatter=none', () => {
    const lib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib libs/${lib} --bundler=tsc --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });

  it('should not add prettier when generating a node app with --formatter=none', () => {
    const app = uniq('nodeapp');
    runCLI(
      `generate @nx/node:app apps/${app} --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });

  it('should not add prettier when generating a react library with --formatter=none', () => {
    const lib = uniq('reactlib');
    runCLI(
      `generate @nx/react:lib libs/${lib} --style=css --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });

  it('should not add prettier when generating a web app with --formatter=none', () => {
    const app = uniq('webapp');
    runCLI(
      `generate @nx/web:app apps/${app} --bundler=vite --style=css --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });

  it('should not add prettier when adding jest config with --formatter=none', () => {
    const lib = uniq('jestlib');
    runCLI(
      `generate @nx/js:lib libs/${lib} --bundler=tsc --unitTestRunner=none --formatter=none --no-interactive --skipFormat`
    );
    runCLI(
      `generate @nx/jest:configuration ${lib} --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });

  it('should not add prettier when adding vite config with --formatter=none', () => {
    const lib = uniq('vitelib');
    runCLI(
      `generate @nx/js:lib libs/${lib} --bundler=none --unitTestRunner=none --formatter=none --no-interactive --skipFormat`
    );
    runCLI(
      `generate @nx/vite:configuration ${lib} --uiFramework=none --formatter=none --no-interactive --skipFormat`
    );
    expectNoPrettierSetup();
  });
});
