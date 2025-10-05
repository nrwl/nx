import {
  e2eCwd,
  exists,
  getPackageManagerCommand,
  getPublishedVersion,
  runCLI,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { removeSync } from 'fs-extra';

describe('nx init (for NestCLI - legacy)', () => {
  const pmc = getPackageManagerCommand({
    packageManager: 'npm',
  });
  const projectName = 'nest-app';
  const projectRoot = `${e2eCwd}/${projectName}`;
  const cliOptions = { cwd: projectRoot };

  beforeEach(() => {
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    delete process.env.NX_ADD_PLUGINS;
    removeSync(projectRoot);
  });

  // TODO(jack,nicholas,colum): Enable this when Nest 11.0.8 issue is resolved
  // See: https://github.com/nestjs/nest-cli/issues/3110
  it.skip('should convert NestCLI application to Nx standalone', () => {
    execSync(
      `${pmc.runUninstalledPackage} @nestjs/cli new ${projectName} --package-manager=npm`,
      {
        cwd: e2eCwd,
        encoding: 'utf-8',
        env: process.env,
        stdio: 'pipe',
      }
    );

    const output = execSync(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --cacheable=format --no-interactive`,
      {
        cwd: projectRoot,
        encoding: 'utf-8',
        env: process.env,
        stdio: 'pipe',
      }
    );

    expect(output).toContain('Learn more about what to do next');

    // nest-cli.json is removed
    expect(exists(`${projectRoot}/nest-cli.json`)).toBeFalsy();

    // root nx.json exists
    expect(exists(`${projectRoot}/nx.json`)).toBeTruthy();
    // root project.json exists
    expect(exists(`${projectRoot}/project.json`)).toBeTruthy();

    runCLI('build', cliOptions);
    expect(
      exists(`${projectRoot}/dist/${projectName}/src/main.js`)
    ).toBeTruthy();

    // run build again for cache
    const buildOutput = runCLI('build', cliOptions);
    expect(buildOutput).toContain('Nx read the output from the cache');
  }, 10000);
});
