import {
  cleanupProject,
  newProject,
  readFile,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('Webpack Plugin', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should be able to setup project to build node programs with webpack and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nrwl/js:lib ${myPkg} --buildable=false`);
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nrwl/webpack:webpack-project ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    let output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);

    updateProjectConfig(myPkg, (config) => {
      delete config.targets.build;
      return config;
    });

    // swc
    runCLI(
      `generate @nrwl/webpack:webpack-project ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=swc`
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);

    updateProjectConfig(myPkg, (config) => {
      delete config.targets.build;
      return config;
    });

    // tsc
    runCLI(
      `generate @nrwl/webpack:webpack-project ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=tsc`
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);
  }, 500000);

  it('should define process.env variables only for --platform=web', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nrwl/js:lib ${myPkg} --bundler=webpack`);
    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `console.log(process.env['NX_TEST_VAR']);\n`
    );

    process.env.NX_TEST_VAR = 'Hello build time';
    runCLI(`build ${myPkg} --platform=node`);

    process.env.NX_TEST_VAR = 'Hello run time';
    expect(runCommand(`node dist/libs/${myPkg}/main.js`)).toMatch(
      /Hello run time/
    );

    process.env.NX_TEST_VAR = 'Hello build time';
    runCLI(`build ${myPkg} --platform=web`);

    expect(readFile(`dist/libs/${myPkg}/main.js`)).toMatch(/Hello build time/);
    delete process.env.NX_TEST_VAR;
  }, 300_000);
});
