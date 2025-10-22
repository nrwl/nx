import {
  packageInstall,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupEsbuildTest, cleanupEsbuildTest } from './esbuild-setup';

describe('EsBuild Plugin - Bundling', () => {
  let proj: string;

  beforeEach(() => (proj = setupEsbuildTest()));

  afterEach(() => cleanupEsbuildTest());

  it('should support bundling everything or only workspace libs', async () => {
    packageInstall('rambda', undefined, '~7.3.0', 'prod');
    packageInstall('lodash', undefined, '~4.14.0', 'prod');
    const parentLib = uniq('parent-lib');
    const childLib = uniq('child-lib');
    runCLI(
      `generate @nx/js:lib ${parentLib} --directory=libs/${parentLib} --bundler=esbuild`
    );
    runCLI(
      `generate @nx/js:lib ${childLib} --directory=libs/${childLib} --bundler=none`
    );
    updateFile(
      `libs/${parentLib}/src/index.ts`,
      `
        // @ts-ignore
        import _ from 'lodash';
        import { greet } from '@${proj}/${childLib}';

        console.log(_.upperFirst('hello world'));
        console.log(greet());
      `
    );
    updateFile(
      `libs/${childLib}/src/index.ts`,
      `
        import { always } from 'rambda';
        export const greet = always('Hello from child lib');
      `
    );

    // Bundle child lib and third-party packages
    runCLI(`build ${parentLib}`);

    expect(
      readJson(`dist/libs/${parentLib}/package.json`).dependencies?.['dayjs']
    ).not.toBeDefined();
    let runResult = runCommand(`node dist/libs/${parentLib}/index.cjs`);
    expect(runResult).toMatch(/Hello world/);
    expect(runResult).toMatch(/Hello from child lib/);

    // Bundle only child lib
    runCLI(`build ${parentLib} --third-party=false`);

    expect(
      readJson(`dist/libs/${parentLib}/package.json`).dependencies
    ).toEqual({
      // Don't care about the versions, just that they exist
      rambda: expect.any(String),
      lodash: expect.any(String),
    });
    runResult = runCommand(`node dist/libs/${parentLib}/index.cjs`);
    expect(runResult).toMatch(/Hello world/);
    expect(runResult).toMatch(/Hello from child lib/);
  }, 300_000);
});
