import {
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  readFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
describe('Next TS Solutions', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/next'],
      preset: 'ts',
    });
  });
  afterAll(() => cleanupProject());

  it('should support importing a esm library', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --linter=none --unitTestRunner=none --e2eTestRunner=none`
    );

    runCLI(
      `generate @nx/js:lib packages/${libName} --bundler=vite --no-interactive --unit-test-runner=none --skipFormat --linter=eslint`
    );

    updateFile(
      `${appName}/src/app/page.tsx`,
      `
      import {${libName}} from '@${proj}/${libName}';
                ${readFile(`${appName}/src/app/page.tsx`)}
          console.log(${libName}());
        `
    );
    runCLI('sync');

    // Add library to package.json to make sure it is linked (not needed for npm package manager)
    updateJson(`${appName}/package.json`, (json) => {
      return {
        ...json,
        devDependencies: {
          ...(json.devDependencies || {}),
          [`@${proj}/${libName}`]: 'workspace:*',
        },
      };
    });

    runCommand(`cd ${appName} && ${getPackageManagerCommand().install}`);

    const output = runCLI(`build ${appName}`);
    expect(output).toContain(
      `Successfully ran target build for project @${proj}/${appName}`
    );
  });
});
