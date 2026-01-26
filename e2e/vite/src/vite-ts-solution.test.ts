import { names } from '@nx/devkit';
import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('Vite - TS solution setup', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react', '@nx/js'],
      preset: 'ts',
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should generate app and consume libraries with different bundlers', () => {
    const reactApp = uniq('react-app');
    const esbuildLib = uniq('esbuild-lib');
    const rollupLib = uniq('rollup-lib');
    const swcLib = uniq('swc-lib');
    const tscLib = uniq('tsc-lib');
    const viteLib = uniq('vite-lib');
    const noBundlerLib = uniq('no-bundler-lib');

    runCLI(
      `generate @nx/react:app apps/${reactApp} --bundler=vite --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${esbuildLib} --bundler=esbuild --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${rollupLib} --bundler=rollup --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${swcLib} --bundler=swc --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${tscLib} --bundler=tsc --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${viteLib} --bundler=vite --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib packages/${noBundlerLib} --bundler=none --e2eTestRunner=none`
    );

    // import all libs from the app
    updateFile(
      `apps/${reactApp}/src/app/app.tsx`,
      (content) => `import { ${
        names(esbuildLib).propertyName
      } } from '@proj/${esbuildLib}';
import { ${names(rollupLib).propertyName} } from '@proj/${rollupLib}';
import { ${names(swcLib).propertyName} } from '@proj/${swcLib}';
import { ${names(tscLib).propertyName} } from '@proj/${tscLib}';
import { ${names(viteLib).propertyName} } from '@proj/${viteLib}';
import { ${names(noBundlerLib).propertyName} } from '@proj/${noBundlerLib}';

console.log(
  ${names(esbuildLib).propertyName}(),
  ${names(rollupLib).propertyName}(),
  ${names(swcLib).propertyName}(),
  ${names(tscLib).propertyName}(),
  ${names(viteLib).propertyName}(),
  ${names(noBundlerLib).propertyName}()
);

${content}`
    );

    const pm = getSelectedPackageManager();
    if (pm === 'pnpm') {
      // for pnpm we need to add the local packages as dependencies to each consumer package.json
      updateJson(`apps/${reactApp}/package.json`, (json) => {
        json.dependencies ??= {};
        json.dependencies[`@proj/${esbuildLib}`] = 'workspace:*';
        json.dependencies[`@proj/${rollupLib}`] = 'workspace:*';
        json.dependencies[`@proj/${swcLib}`] = 'workspace:*';
        json.dependencies[`@proj/${tscLib}`] = 'workspace:*';
        json.dependencies[`@proj/${viteLib}`] = 'workspace:*';
        json.dependencies[`@proj/${noBundlerLib}`] = 'workspace:*';
        return json;
      });

      const pmc = getPackageManagerCommand({ packageManager: pm });
      runCommand(pmc.install);
    }

    // sync to ensure the TS project references are updated
    runCLI(`sync`);

    // check build
    expect(runCLI(`build ${reactApp}`)).toContain(
      `Successfully ran target build for project @proj/${reactApp}`
    );

    // check typecheck
    expect(runCLI(`typecheck ${reactApp}`)).toContain(
      `Successfully ran target typecheck for project @proj/${reactApp}`
    );
  }, 300_000);
});
