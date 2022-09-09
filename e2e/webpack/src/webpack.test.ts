import {
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Webpack Plugin', () => {
  beforeEach(() => newProject());
  // afterEach(() => cleanupProject());

  it('should be able to initialize and build node programs using webpack', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nrwl/js:lib ${myPkg} --buildable=false`);
    runCLI(
      `generate @nrwl/webpack:webpack-project ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    runCLI(`build ${myPkg}`);
    const output = runCommand(`node dist/libs/${myPkg}/main.js`);

    expect(output).toMatch(/Hello/);
  }, 500000);
});
