import {
  cleanupProject,
  newProject,
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
    runCLI(`generate @nrwl/js:lib ${myPkg} --bundler=none`);
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nrwl/webpack:webpack-project ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );

    // Test `scriptType` later during during.
    updateFile(
      `libs/${myPkg}/webpack.config.js`,
      `
const { composePlugins, withNx } = require('@nrwl/webpack');

module.exports = composePlugins(withNx(), (config) => {
  console.log('scriptType is ' + config.output.scriptType);
  return config;
});
`
    );

    rmDist();

    const buildOutput = runCLI(`build ${myPkg}`);
    // Ensure scriptType is not set if we're in Node (it only applies to Web).
    expect(buildOutput).toContain('scriptType is undefined');
    let output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);
    expect(output).not.toMatch(/Conflicting/);
    expect(output).not.toMatch(/process.env.NODE_ENV/);

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
});
