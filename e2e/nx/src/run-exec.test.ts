import {
  cleanupProject,
  fileExists,
  readJson,
  removeFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { PackageJson } from 'nx/src/utils/package-json';
import * as path from 'path';
import { setupRunTests } from './run-setup';

describe('exec', () => {
  let proj: string;
  let pkg: string;
  let pkg2: string;
  let pkgRoot: string;
  let pkg2Root: string;
  let originalRootPackageJson: PackageJson;

  beforeAll(() => {
    proj = setupRunTests();
    originalRootPackageJson = readJson<PackageJson>('package.json');
    pkg = uniq('package');
    pkg2 = uniq('package');
    pkgRoot = tmpProjPath(path.join('libs', pkg));
    pkg2Root = tmpProjPath(path.join('libs', pkg2));
    runCLI(
      `generate @nx/js:lib ${pkg} --bundler=none --unitTestRunner=none --directory=libs/${pkg}`
    );
    runCLI(
      `generate @nx/js:lib ${pkg2} --bundler=none --unitTestRunner=none --directory=libs/${pkg2}`
    );

    updateJson<PackageJson>('package.json', (v) => {
      v.workspaces = ['libs/*'];
      return v;
    });

    updateFile(
      `libs/${pkg}/package.json`,
      JSON.stringify(<PackageJson>{
        name: pkg,
        version: '0.0.1',
        scripts: {
          build: 'nx exec -- echo HELLO',
          'build:option': 'nx exec -- echo HELLO WITH OPTION',
        },
        nx: {
          targets: {
            build: {
              cache: true,
            },
          },
        },
      })
    );

    updateFile(
      `libs/${pkg2}/package.json`,
      JSON.stringify(<PackageJson>{
        name: pkg2,
        version: '0.0.1',
        scripts: {
          build: "nx exec -- echo '$NX_PROJECT_NAME'",
        },
      })
    );

    updateJson(`libs/${pkg2}/project.json`, (content) => {
      content['implicitDependencies'] = [pkg];
      return content;
    });
  });

  afterAll(() => {
    updateJson('package.json', () => originalRootPackageJson);
    cleanupProject();
  });

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateJson('nx.json', () => existingNxJson);
  });

  it('should work for npm scripts', () => {
    const output = runCommand('npm run build', {
      cwd: pkgRoot,
    });
    expect(output).toContain('HELLO');
    expect(output).toContain(`nx run ${pkg}:build`);
  });

  it('should run adhoc tasks in topological order', () => {
    let output = runCLI('exec -- echo HELLO');
    expect(output).toContain('HELLO');

    output = runCLI(`build ${pkg}`);
    expect(output).toContain(pkg);
    expect(output).not.toContain(pkg2);

    output = runCommand('npm run build', {
      cwd: pkgRoot,
    });
    expect(output).toContain(pkg);
    expect(output).not.toContain(pkg2);

    output = runCLI(`exec -- echo '$NX_PROJECT_NAME'`).replace(/\s+/g, ' ');
    expect(output).toContain(pkg);
    expect(output).toContain(pkg2);

    output = runCLI("exec -- echo '$NX_PROJECT_ROOT_PATH'").replace(
      /\s+/g,
      ' '
    );
    expect(output).toContain(`${path.join('libs', pkg)}`);
    expect(output).toContain(`${path.join('libs', pkg2)}`);

    output = runCLI(`exec --projects ${pkg} -- echo WORLD`);
    expect(output).toContain('WORLD');

    output = runCLI(`exec --projects ${pkg} -- echo '$NX_PROJECT_NAME'`);
    expect(output).toContain(pkg);
    expect(output).not.toContain(pkg2);
  });

  it('should work for npm scripts with delimiter', () => {
    const output = runCommand('npm run build:option', { cwd: pkgRoot });
    expect(output).toContain('HELLO WITH OPTION');
    expect(output).toContain(`nx run ${pkg}:"build:option"`);
  });

  it('should pass overrides', () => {
    const output = runCommand('npm run build WORLD', {
      cwd: pkgRoot,
    });
    expect(output).toContain('HELLO WORLD');
  });

  describe('caching', () => {
    it('should cache subsequent calls', () => {
      runCommand('npm run build', {
        cwd: pkgRoot,
      });
      const output = runCommand('npm run build', {
        cwd: pkgRoot,
      });
      expect(output).toContain('Nx read the output from the cache');
    });

    it('should read outputs', () => {
      const nodeCommands = [
        "const fs = require('fs')",
        "fs.mkdirSync('../../tmp/exec-outputs-test', {recursive: true})",
        "fs.writeFileSync('../../tmp/exec-outputs-test/file.txt', 'Outputs')",
      ];
      updateFile(
        `libs/${pkg}/package.json`,
        JSON.stringify(<PackageJson>{
          name: pkg,
          version: '0.0.1',
          scripts: {
            build: `nx exec -- node -e "${nodeCommands.join(';')}"`,
          },
          nx: {
            targets: {
              build: {
                cache: true,
                outputs: ['{workspaceRoot}/tmp/exec-outputs-test'],
              },
            },
          },
        })
      );
      runCommand('npm run build', {
        cwd: pkgRoot,
      });
      expect(
        fileExists(tmpProjPath('tmp/exec-outputs-test/file.txt'))
      ).toBeTruthy();
      removeFile('tmp');
      const output = runCommand('npm run build', {
        cwd: pkgRoot,
      });
      expect(output).toContain('[local cache]');
      expect(
        fileExists(tmpProjPath('tmp/exec-outputs-test/file.txt'))
      ).toBeTruthy();
    });
  });
});
