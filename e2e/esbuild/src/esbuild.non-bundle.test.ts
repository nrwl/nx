import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

import { setupEsbuildSuite } from './esbuild.setup';

describe('Esbuild non-bundle build', () => {
  setupEsbuildSuite();

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
    checkFilesDoNotExist(
      `dist/libs/${myPkg}/libs/${myPkg}/src/lib/${myPkg}.spec.cjs`
    );
    expect(runCommand(`node dist/libs/${myPkg}`)).toMatch(/Hello/);
  }, 300_000);
});
