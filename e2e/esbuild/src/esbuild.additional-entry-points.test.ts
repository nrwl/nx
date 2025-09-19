import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('EsBuild Plugin - additional entry points', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

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


