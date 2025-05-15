import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  detectPackageManager,
  newProject,
  packageInstall,
  packageManagerLockFile,
  readFile,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('EsBuild Plugin', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => cleanupProject());

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

  it('should support additional entry points', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('main');\n`);
    updateFile(`libs/${myPkg}/src/extra.ts`, `console.log('extra');\n`);
    updateJson(join('libs', myPkg, 'project.json'), (json) => {
      json.targets.build.options.additionalEntryPoints = [
        `libs/${myPkg}/src/extra.ts`,
      ];
      return json;
    });

    runCLI(`build ${myPkg}`);

    checkFilesExist(
      `dist/libs/${myPkg}/index.cjs`,
      `dist/libs/${myPkg}/extra.cjs`
    );
    expect(
      runCommand(`node dist/libs/${myPkg}/index.cjs`, { failOnError: true })
    ).toMatch(/main/);
    expect(
      runCommand(`node dist/libs/${myPkg}/extra.cjs`, { failOnError: true })
    ).toMatch(/extra/);
  }, 120_000);

  it('should bundle in non-sensitive NX_ environment variables', () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`,
      {}
    );

    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `
      console.log(process.env['NX_SOME_SECRET']);
      console.log(process.env['NX_SOME_TOKEN']);
      console.log(process.env['NX_PUBLIC_TEST']);
      `
    );

    runCLI(`build ${myPkg} --platform=browser`, {
      env: {
        NX_SOME_SECRET: 'secret',
        NX_SOME_TOKEN: 'secret',
        NX_PUBLIC_TEST: 'foobar',
      },
    });

    const output = runCommand(`node dist/libs/${myPkg}/index.cjs`, {
      failOnError: true,
    });
    expect(output).not.toMatch(/secret/);
    expect(output).toMatch(/foobar/);
  });

  it('should support declaration builds', () => {
    const declarationPkg = uniq('declaration-pkg');
    runCLI(
      `generate @nx/js:lib ${declarationPkg} --directory=libs/${declarationPkg} --bundler=esbuild`
    );
    createFile(
      `libs/${declarationPkg}/src/lib/testDir/sub.ts`,
      `
        export function sub(): string {
          return 'sub';
        }
      `
    );
    updateFile(
      `libs/${declarationPkg}/src/lib/${declarationPkg}.ts`,
      `
        import { sub } from './testDir/sub';
        
        console.log('${declarationPkg}-' + sub());
      `
    );

    runCLI(`build ${declarationPkg} --declaration=true`);

    checkFilesExist(
      `dist/libs/${declarationPkg}/index.cjs`,
      `dist/libs/${declarationPkg}/src/index.d.ts`,
      `dist/libs/${declarationPkg}/src/lib/${declarationPkg}.d.ts`,
      `dist/libs/${declarationPkg}/src/lib/testDir/sub.d.ts`
    );

    expect(runCommand(`node dist/libs/${declarationPkg}`)).toMatch(
      new RegExp(`${declarationPkg}-sub`)
    );
  }, 300_000);
});
