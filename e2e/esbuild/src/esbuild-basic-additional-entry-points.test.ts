import {
  checkFilesExist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupEsbuildTest, cleanupEsbuildTest } from './esbuild-setup';

describe('EsBuild Plugin - Basic - Additional Entry Points', () => {
  let proj: string;

  beforeEach(() => (proj = setupEsbuildTest()));

  afterEach(() => cleanupEsbuildTest());

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
});
