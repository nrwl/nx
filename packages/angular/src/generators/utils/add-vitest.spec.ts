import { updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { UnitTestRunner } from '../../utils/test-runners';
import { addVitestAngular } from './add-vitest';
import { generateTestApplication } from './testing';

const installedPackageJsons = vi.hoisted(
  () => ({}) as Record<string, Record<string, unknown>>
);
vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  readModulePackageJson: vi.fn((name: string) => {
    const packageJson = installedPackageJsons[name];
    if (!packageJson) {
      throw new Error(`Cannot find module '${name}'`);
    }
    return { packageJson, path: `node_modules/${name}/package.json` };
  }),
}));

describe('addVitestAngular', () => {
  let tree: Tree;

  beforeEach(async () => {
    for (const name of Object.keys(installedPackageJsons)) {
      delete installedPackageJsons[name];
    }
    tree = createTreeWithEmptyWorkspace();
    await generateTestApplication(tree, {
      name: 'app1',
      directory: 'app1',
      unitTestRunner: UnitTestRunner.None,
      skipFormat: true,
    });
  });

  function install(name: string, packageJson: Record<string, unknown>): void {
    installedPackageJsons[name] = { name, ...packageJson };
  }

  function setDevDependency(name: string, version: string): void {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies[name] = version;
      return json;
    });
  }

  function run() {
    return addVitestAngular(tree, {
      name: 'app1',
      projectRoot: 'app1',
      skipPackageJson: false,
    });
  }

  it('should refuse vitest 5 when the installed @angular/build peers vitest 4', async () => {
    install('vitest', { version: '5.0.3' });
    install('@angular/build', {
      version: '22.1.2',
      peerDependencies: { vitest: '^4.0.8' },
    });
    setDevDependency('@angular/build', '~22.1.2');

    await expect(run()).rejects.toThrow(
      'The installed vitest version "5.0.3" is not compatible with the version range Angular requires: "^4.0.8".'
    );
  });

  it('should accept vitest 5 when the installed @angular/build peers it', async () => {
    install('vitest', { version: '5.0.3' });
    install('@angular/build', {
      version: '22.2.2',
      peerDependencies: { vitest: '^4.0.8 || ^5.0.0' },
    });
    setDevDependency('@angular/build', '~22.2.2');

    await expect(run()).resolves.toBeDefined();
  });

  it('should accept a declared vitest 5 when the declared @angular/build peers it', async () => {
    setDevDependency('vitest', '~5.0.3');
    setDevDependency('@angular/build', '^22.2.0');

    await expect(run()).resolves.toBeDefined();
  });

  it('should refuse a declared vitest 5 when the declared @angular/build peers vitest 4', async () => {
    setDevDependency('vitest', '~5.0.3');
    setDevDependency('@angular/build', '~22.1.0');

    await expect(run()).rejects.toThrow(
      'The declared vitest version range "~5.0.3" does not overlap with the version range Angular requires: "^4.0.8".'
    );
  });
});
