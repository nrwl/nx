import {
  checkFilesExist,
  checkFilesDoNotExist,
  detectPackageManager,
  packageManagerLockFile,
  readFile,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

import { setupEsbuildSuite } from './esbuild.setup';

describe('Esbuild build scenarios', () => {
  setupEsbuildSuite();

  it('should setup and build projects using build', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);
    updateJson(join('libs', myPkg, 'project.json'), (json) => {
      json.targets.build.options.assets = [`libs/${myPkg}/assets/*`];
      return json;
    });
    updateFile(`libs/${myPkg}/assets/a.md`, 'file a');
    updateFile(`libs/${myPkg}/assets/b.md`, 'file b');

    runCLI(`build ${myPkg} --generatePackageJson=false`);
    const packageJson = readJson(`libs/${myPkg}/package.json`);
    expect(packageJson).toEqual({
      name: `@proj/${myPkg}`,
      version: '0.0.1',
      private: true,
      type: 'commonjs',
      main: './index.cjs',
      types: './index.d.ts',
      dependencies: {},
    });

    runCLI(`build ${myPkg}`);

    expect(runCommand(`node dist/libs/${myPkg}/index.cjs`)).toMatch(/Hello/);
    checkFilesExist(
      `dist/libs/${myPkg}/package.json`,
      `dist/libs/${myPkg}/${
        packageManagerLockFile[detectPackageManager(tmpProjPath())]
      }`
    );

    expect(readFile(`dist/libs/${myPkg}/assets/a.md`)).toMatch(/file a/);
    expect(readFile(`dist/libs/${myPkg}/assets/b.md`)).toMatch(/file b/);

    checkFilesDoNotExist(`dist/libs/${myPkg}/meta.json`);
    runCLI(`build ${myPkg} --metafile`);
    checkFilesExist(`dist/libs/${myPkg}/meta.json`);

    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `
      const x: number = 'a';
      console.log('Bye');
    `
    );
    expect(() => runCLI(`build ${myPkg}`)).toThrow();
    expect(() =>
      runCLI(`build ${myPkg} --skipTypeCheck --no-declaration`)
    ).not.toThrow();
    expect(runCommand(`node dist/libs/${myPkg}/index.cjs`)).toMatch(/Bye/);
    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `
      console.log('Hello');
    `
    );
  }, 300_000);
});

