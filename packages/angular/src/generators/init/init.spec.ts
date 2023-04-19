jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  // need to mock so it doesn't resolve what the workspace has installed
  // and be able to test with different versions
  ensurePackage: jest.fn(),
}));
import {
  NxJsonConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import { angularDevkitVersion, angularVersion } from '../../utils/versions';
import init from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add angular dependencies', async () => {
    // ACT
    await init(tree, {
      unitTestRunner: UnitTestRunner.Jest,
      linter: Linter.EsLint,
      skipFormat: false,
    });

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe(angularVersion);
    expect(dependencies['@angular/common']).toBe(angularVersion);
    expect(dependencies['@angular/compiler']).toBe(angularVersion);
    expect(dependencies['@angular/core']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser-dynamic']).toBe(
      angularVersion
    );
    expect(dependencies['@angular/router']).toBe(angularVersion);
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe(angularDevkitVersion);
    expect(devDependencies['@angular/compiler-cli']).toBe(angularVersion);
    expect(devDependencies['@angular/language-service']).toBe(angularVersion);
    expect(devDependencies['@angular-devkit/build-angular']).toBe(
      angularDevkitVersion
    );

    // codelyzer should no longer be there by default
    expect(devDependencies['codelyzer']).toBeUndefined();
  });

  it('should add angular dependencies respecting base packages versions', async () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@angular-devkit/build-angular': '~15.0.0',
      },
    }));

    // ACT
    await init(tree, {});

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~15.0.0');
    expect(dependencies['@angular/common']).toBe('~15.0.0');
    expect(dependencies['@angular/compiler']).toBe('~15.0.0');
    expect(dependencies['@angular/core']).toBe('~15.0.0');
    expect(dependencies['@angular/platform-browser']).toBe('~15.0.0');
    expect(dependencies['@angular/platform-browser-dynamic']).toBe('~15.0.0');
    expect(dependencies['@angular/router']).toBe('~15.0.0');
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe('~15.0.0');
    expect(devDependencies['@angular/compiler-cli']).toBe('~15.0.0');
    expect(devDependencies['@angular/language-service']).toBe('~15.0.0');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~15.0.0');
  });

  it('should not overwrite already installed dependencies', async () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/animations': '~15.0.1',
        '@angular/core': '~15.0.0',
      },
    }));

    // ACT
    await init(tree, {});

    // ASSERT
    const { dependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~15.0.1');
    expect(dependencies['@angular/core']).toBe('~15.0.0');
  });

  describe('--unit-test-runner', () => {
    describe('jest', () => {
      it('should add jest dependencies', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(tree, 'package.json');

        // ASSERT
        expect(devDependencies['@nx/jest']).toBeDefined();
        expect(devDependencies['jest']).toBeDefined();
        expect(devDependencies['jest-preset-angular']).toBeDefined();
      });

      it('should add jest configuration', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const hasJestConfigFile = tree.exists('jest.config.ts');

        // ASSERT
        expect(hasJestConfigFile).toBeTruthy();
      });

      it('should set defaults', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

        // ASSERT
        expect(generators['@nx/angular:application'].unitTestRunner).toEqual(
          'jest'
        );
        expect(generators['@nx/angular:library'].unitTestRunner).toEqual(
          'jest'
        );
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe('cypress', () => {
      it('should add cypress dependencies', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(tree, 'package.json');

        // ASSERT
        expect(devDependencies['@nx/cypress']).toBeDefined();
        expect(devDependencies['cypress']).toBeDefined();
      });

      it('should set defaults', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

        // ASSERT
        expect(generators['@nx/angular:application'].e2eTestRunner).toEqual(
          'cypress'
        );
      });
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should set the default to eslint', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.None,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

        // ASSERT
        expect(generators['@nx/angular:application'].linter).toEqual('eslint');
        expect(generators['@nx/angular:library'].linter).toEqual('eslint');
      });
    });

    describe('none', () => {
      it('should set the default to none', async () => {
        // ACT
        await init(tree, {
          unitTestRunner: UnitTestRunner.None,
          linter: Linter.None,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

        // ASSERT
        expect(generators['@nx/angular:application'].linter).toEqual('none');
        expect(generators['@nx/angular:library'].linter).toEqual('none');
      });
    });
  });

  describe('angular cache dir', () => {
    it('should add .angular to .gitignore', async () => {
      tree.write('.gitignore', '');

      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      expect(tree.read('.gitignore', 'utf-8')).toContain('.angular');
    });

    it('should not add .angular to .gitignore when it already exists', async () => {
      tree.write(
        '.gitignore',
        `foo
bar

.angular

`
      );

      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      const angularEntries = tree
        .read('.gitignore', 'utf-8')
        .match(/^.angular$/gm);
      expect(angularEntries).toHaveLength(1);
    });

    it('should add .angular to .prettierignore', async () => {
      tree.write('.prettierignore', '');

      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      expect(tree.read('.prettierignore', 'utf-8')).toContain('.angular');
    });

    it('should not add .angular to .prettierignore when it already exists', async () => {
      tree.write(
        '.prettierignore',
        `/coverage
/dist

.angular

`
      );

      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      const angularEntries = tree
        .read('.prettierignore', 'utf-8')
        .match(/^.angular$/gm);
      expect(angularEntries).toHaveLength(1);
    });

    it('should add configured angular cache dir to .gitignore and .prettierignore', async () => {
      tree.write('.gitignore', '');
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        cli: { cache: { path: 'node_modules/.cache/angular' } },
      } as any);

      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      expect(tree.read('.gitignore', 'utf-8')).toContain(
        'node_modules/.cache/angular'
      );
      expect(tree.read('.prettierignore', 'utf-8')).toContain(
        'node_modules/.cache/angular'
      );
    });
  });

  describe('v14 support', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '~14.2.0',
        },
      }));
    });

    it('should add angular dependencies', async () => {
      // ACT
      await init(tree, {
        unitTestRunner: UnitTestRunner.Jest,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      // ASSERT
      const { dependencies, devDependencies } = readJson(tree, 'package.json');

      expect(dependencies['@angular/animations']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/common']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/compiler']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/core']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/platform-browser']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/platform-browser-dynamic']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['@angular/router']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(dependencies['rxjs']).toEqual(
        backwardCompatibleVersions.angularV14.rxjsVersion
      );
      expect(dependencies['zone.js']).toEqual(
        backwardCompatibleVersions.angularV14.zoneJsVersion
      );
      expect(devDependencies['@angular/cli']).toEqual(
        backwardCompatibleVersions.angularV14.angularDevkitVersion
      );
      expect(devDependencies['@angular/compiler-cli']).toEqual(
        backwardCompatibleVersions.angularV14.angularDevkitVersion
      );
      expect(devDependencies['@angular/language-service']).toEqual(
        backwardCompatibleVersions.angularV14.angularVersion
      );
      expect(devDependencies['@angular-devkit/build-angular']).toEqual(
        backwardCompatibleVersions.angularV14.angularDevkitVersion
      );

      // codelyzer should no longer be there by default
      expect(devDependencies['codelyzer']).toBeUndefined();
    });

    it('should add angular dependencies respecting base packages versions', async () => {
      // ARRANGE
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '~14.0.0',
        },
        devDependencies: {
          ...json.devDependencies,
          '@angular-devkit/build-angular': '~14.0.0',
        },
      }));

      // ACT
      await init(tree, {});

      // ASSERT
      const { dependencies, devDependencies } = readJson(tree, 'package.json');

      expect(dependencies['@angular/animations']).toBe('~14.0.0');
      expect(dependencies['@angular/common']).toBe('~14.0.0');
      expect(dependencies['@angular/compiler']).toBe('~14.0.0');
      expect(dependencies['@angular/core']).toBe('~14.0.0');
      expect(dependencies['@angular/platform-browser']).toBe('~14.0.0');
      expect(dependencies['@angular/platform-browser-dynamic']).toBe('~14.0.0');
      expect(dependencies['@angular/router']).toBe('~14.0.0');
      expect(dependencies['rxjs']).toBeDefined();
      expect(dependencies['tslib']).toBeDefined();
      expect(dependencies['zone.js']).toBeDefined();
      expect(devDependencies['@angular/cli']).toBe('~14.0.0');
      expect(devDependencies['@angular/compiler-cli']).toBe('~14.0.0');
      expect(devDependencies['@angular/language-service']).toBe('~14.0.0');
      expect(devDependencies['@angular-devkit/build-angular']).toBe('~14.0.0');
    });

    it('should not overwrite already installed dependencies', async () => {
      // ARRANGE
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/animations': '~14.0.1',
          '@angular/core': '~14.0.0',
        },
      }));

      // ACT
      await init(tree, {});

      // ASSERT
      const { dependencies } = readJson(tree, 'package.json');

      expect(dependencies['@angular/animations']).toBe('~14.0.1');
      expect(dependencies['@angular/core']).toBe('~14.0.0');
    });

    describe('--unit-test-runner', () => {
      describe('jest', () => {
        it('should add jest dependencies', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.Jest,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const { devDependencies } = readJson(tree, 'package.json');

          // ASSERT
          expect(devDependencies['@nx/jest']).toBeDefined();
          expect(devDependencies['jest']).toBeDefined();
          expect(devDependencies['jest-preset-angular']).toEqual(
            backwardCompatibleVersions.angularV14.jestPresetAngularVersion
          );
        });

        it('should add jest configuration', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.Jest,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const hasJestConfigFile = tree.exists('jest.config.ts');

          // ASSERT
          expect(hasJestConfigFile).toBeTruthy();
        });

        it('should set defaults', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.Jest,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

          // ASSERT
          expect(generators['@nx/angular:application'].unitTestRunner).toEqual(
            'jest'
          );
          expect(generators['@nx/angular:library'].unitTestRunner).toEqual(
            'jest'
          );
        });
      });
    });

    describe('--e2e-test-runner', () => {
      describe('cypress', () => {
        it('should add cypress dependencies', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.None,
            e2eTestRunner: E2eTestRunner.Cypress,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const { devDependencies } = readJson(tree, 'package.json');

          // ASSERT
          expect(devDependencies['@nx/cypress']).toBeDefined();
          expect(devDependencies['cypress']).toBeDefined();
        });

        it('should set defaults', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.None,
            e2eTestRunner: E2eTestRunner.Cypress,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

          // ASSERT
          expect(generators['@nx/angular:application'].e2eTestRunner).toEqual(
            'cypress'
          );
        });
      });
    });

    describe('--linter', () => {
      describe('eslint', () => {
        it('should set the default to eslint', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.None,
            linter: Linter.EsLint,
            skipFormat: false,
          });

          const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

          // ASSERT
          expect(generators['@nx/angular:application'].linter).toEqual(
            'eslint'
          );
          expect(generators['@nx/angular:library'].linter).toEqual('eslint');
        });
      });

      describe('none', () => {
        it('should set the default to none', async () => {
          // ACT
          await init(tree, {
            unitTestRunner: UnitTestRunner.None,
            linter: Linter.None,
            skipFormat: false,
          });

          const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

          // ASSERT
          expect(generators['@nx/angular:application'].linter).toEqual('none');
          expect(generators['@nx/angular:library'].linter).toEqual('none');
        });
      });
    });

    describe('angular cache dir', () => {
      it('should add .angular to .gitignore', async () => {
        tree.write('.gitignore', '');

        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        expect(tree.read('.gitignore', 'utf-8')).toContain('.angular');
      });

      it('should not add .angular to .gitignore when it already exists', async () => {
        tree.write(
          '.gitignore',
          `foo
bar

.angular

`
        );

        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const angularEntries = tree
          .read('.gitignore', 'utf-8')
          .match(/^.angular$/gm);
        expect(angularEntries).toHaveLength(1);
      });

      it('should add .angular to .prettierignore', async () => {
        tree.write('.prettierignore', '');

        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        expect(tree.read('.prettierignore', 'utf-8')).toContain('.angular');
      });

      it('should not add .angular to .prettierignore when it already exists', async () => {
        tree.write(
          '.prettierignore',
          `/coverage
/dist

.angular

`
        );

        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const angularEntries = tree
          .read('.prettierignore', 'utf-8')
          .match(/^.angular$/gm);
        expect(angularEntries).toHaveLength(1);
      });

      it('should add configured angular cache dir to .gitignore and .prettierignore', async () => {
        tree.write('.gitignore', '');
        const nxJson = readNxJson(tree);
        updateNxJson(tree, {
          ...nxJson,
          cli: { cache: { path: 'node_modules/.cache/angular' } },
        } as any);

        await init(tree, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        expect(tree.read('.gitignore', 'utf-8')).toContain(
          'node_modules/.cache/angular'
        );
        expect(tree.read('.prettierignore', 'utf-8')).toContain(
          'node_modules/.cache/angular'
        );
      });
    });
  });
});
