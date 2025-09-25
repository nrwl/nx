import {
  checkFilesExist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  createFile,
} from '@nx/e2e-utils';

import { setupEsbuildSuite } from './esbuild.setup';

describe('Esbuild declarations', () => {
  setupEsbuildSuite();

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
