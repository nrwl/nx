import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupEsbuildTest, cleanupEsbuildTest } from './esbuild-setup';

describe('EsBuild Plugin - Basic - Non-Bundle', () => {
  let proj: string;

  beforeEach(() => (proj = setupEsbuildTest()));

  afterEach(() => cleanupEsbuildTest());

  it('should support non-bundle builds', () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
    );
    updateFile(`libs/${myPkg}/src/lib/${myPkg}.ts`, `console.log('Hello');\n`);
    updateFile(`libs/${myPkg}/src/index.ts`, `import './lib/${myPkg}.cjs';\n`);

    runCLI(`build ${myPkg} --bundle=false`);

    checkFilesExist(
      `dist/libs/${myPkg}/libs/${myPkg}/src/lib/${myPkg}.cjs`,
      `dist/libs/${myPkg}/index.cjs`
    );
    // Test files are excluded in tsconfig (e.g. tsconfig.lib.json)
    checkFilesDoNotExist(
      `dist/libs/${myPkg}/libs/${myPkg}/src/lib/${myPkg}.spec.cjs`
    );
    // Can run package (package.json fields are correctly generated)
    expect(runCommand(`node dist/libs/${myPkg}`)).toMatch(/Hello/);
  }, 300_000);
});
