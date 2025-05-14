import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('React (TS solution)', () => {
  let workspaceName: string;

  beforeAll(() => {
    workspaceName = newProject({ preset: 'ts', packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should respect and support generating libraries with a name different than the import path', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/react:library packages/${lib} --name=${lib} --bundler=vite --linter=eslint --unitTestRunner=vitest`
    );

    const packageJson = readJson(`packages/${lib}/package.json`);
    expect(packageJson.nx.name).toBe(lib);

    expect(runCLI(`build ${lib}`)).toContain(
      `Successfully ran target build for project ${lib}`
    );
    expect(runCLI(`typecheck ${lib}`)).toContain(
      `Successfully ran target typecheck for project ${lib}`
    );
    expect(runCLI(`lint ${lib}`)).toContain(
      `Successfully ran target lint for project ${lib}`
    );
    expect(runCLI(`test ${lib}`)).toContain(
      `Successfully ran target test for project ${lib}`
    );
  }, 90000);

  it('should be able to use Webpack to build apps with an imported lib', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/react:app packages/${appName} --bundler=webpack --no-interactive --skipFormat --linter=eslint --unitTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib libs/${libName} --bundler=none --no-interactive --unit-test-runner=none --skipFormat --linter=eslint`
    );

    const mainPath = `packages/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `
          import {${libName}} from '@${workspaceName}/${libName}';
          ${readFile(mainPath)}
          console.log(${libName}());
        `
    );

    runCLI('sync');

    // Add library to package.json to make sure it is linked (not needed for npm package manager)
    updateJson(`packages/${appName}/package.json`, (json) => {
      return {
        ...json,
        devDependencies: {
          ...(json.devDependencies || {}),
          [`@${workspaceName}/${libName}`]: 'workspace:*',
        },
      };
    });

    runCommand(
      `cd packages/${appName} && ${getPackageManagerCommand().install}`
    );

    runCLI(`build ${appName}`);

    checkFilesExist(`packages/${appName}/dist/index.html`);
  }, 90_000);
});
