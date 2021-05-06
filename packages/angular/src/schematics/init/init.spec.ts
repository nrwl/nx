import { Tree } from '@angular-devkit/schematics';
import { runSchematic, callRule } from '../../utils/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';

describe('init', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should add angular dependencies', async () => {
    const tree = await runSchematic('init', {}, appTree);
    const { dependencies, devDependencies } = readJsonInTree(
      tree,
      'package.json'
    );
    expect(dependencies['@angular/animations']).toBeDefined();
    expect(dependencies['@angular/common']).toBeDefined();
    expect(dependencies['@angular/compiler']).toBeDefined();
    expect(dependencies['@angular/core']).toBeDefined();
    expect(dependencies['@angular/platform-browser']).toBeDefined();
    expect(dependencies['@angular/platform-browser-dynamic']).toBeDefined();
    expect(dependencies['@angular/router']).toBeDefined();
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/compiler-cli']).toBeDefined();
    expect(devDependencies['@angular/language-service']).toBeDefined();
    expect(devDependencies['@angular-devkit/build-angular']).toBeDefined();

    // codelyzer should no longer be there by default
    expect(devDependencies['codelyzer']).toBeUndefined();
  });

  it('should add a postinstall script for ngcc', async () => {
    const tree = await runSchematic(
      'init',
      {
        unitTestRunner: 'karma',
      },
      appTree
    );

    const packageJson = readJsonInTree(tree, 'package.json');

    expect(packageJson.scripts.postinstall).toEqual(
      'ngcc --properties es2015 browser module main'
    );
  });

  describe('--unit-test-runner', () => {
    describe('karma', () => {
      it('should add karma dependencies', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'karma',
          },
          appTree
        );
        const { devDependencies } = readJsonInTree(tree, 'package.json');
        expect(devDependencies['karma']).toBeDefined();
        expect(devDependencies['karma-chrome-launcher']).toBeDefined();
        expect(
          devDependencies['karma-coverage-istanbul-reporter']
        ).toBeDefined();
        expect(devDependencies['karma-jasmine']).toBeDefined();
        expect(devDependencies['karma-jasmine-html-reporter']).toBeDefined();
        expect(devDependencies['jasmine-core']).toBeDefined();
        expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
        expect(devDependencies['@types/jasmine']).toBeDefined();
      });

      it('should add karma configuration', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'karma',
          },
          appTree
        );
        expect(tree.exists('karma.conf.js')).toBeTruthy();
      });

      it('should set defaults', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'karma',
          },
          appTree
        );
        const { schematics } = readJsonInTree(tree, 'workspace.json');
        expect(schematics['@nrwl/angular:application'].unitTestRunner).toEqual(
          'karma'
        );
        expect(schematics['@nrwl/angular:library'].unitTestRunner).toEqual(
          'karma'
        );
      });
    });

    describe('jest', () => {
      it('should add jest dependencies', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'jest',
          },
          appTree
        );
        const { devDependencies } = readJsonInTree(tree, 'package.json');
        expect(devDependencies['@nrwl/jest']).toBeDefined();
        expect(devDependencies['jest']).toBeDefined();
        expect(devDependencies['jest-preset-angular']).toBeDefined();
      });

      it('should add jest configuration', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'jest',
          },
          appTree
        );
        expect(tree.exists('jest.config.js')).toBeTruthy();
      });

      it('should set defaults', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'jest',
          },
          appTree
        );
        const { schematics } = readJsonInTree(tree, 'workspace.json');
        expect(schematics['@nrwl/angular:application'].unitTestRunner).toEqual(
          'jest'
        );
        expect(schematics['@nrwl/angular:library'].unitTestRunner).toEqual(
          'jest'
        );
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe('cypress', () => {
      it('should add cypress dependencies', async () => {
        const tree = await runSchematic(
          'init',
          {
            unitTestRunner: 'none',
            e2eTestRunner: 'cypress',
          },
          appTree
        );
        const { devDependencies } = readJsonInTree(tree, 'package.json');
        expect(devDependencies['@nrwl/cypress']).toBeDefined();
        expect(devDependencies['cypress']).toBeDefined();
      });

      it('should set defaults', async () => {
        const tree = await runSchematic(
          'init',
          {
            e2eTestRunner: 'cypress',
          },
          appTree
        );
        const { schematics } = readJsonInTree(tree, 'workspace.json');
        expect(schematics['@nrwl/angular:application'].e2eTestRunner).toEqual(
          'cypress'
        );
      });
    });

    describe('protractor', () => {
      it('should add protractor dependencies', async () => {
        const tree = await runSchematic(
          'init',
          {
            e2eTestRunner: 'protractor',
          },
          appTree
        );
        const { devDependencies } = readJsonInTree(tree, 'package.json');
        expect(devDependencies['protractor']).toBeDefined();
        expect(devDependencies['jasmine-core']).toBeDefined();
        expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
        expect(devDependencies['@types/jasmine']).toBeDefined();
        expect(devDependencies['@types/jasminewd2']).toBeDefined();
      });

      it('should set defaults', async () => {
        const tree = await runSchematic(
          'init',
          {
            e2eTestRunner: 'protractor',
          },
          appTree
        );
        const { schematics } = readJsonInTree(tree, 'workspace.json');
        expect(schematics['@nrwl/angular:application'].e2eTestRunner).toEqual(
          'protractor'
        );
      });
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should set the default to eslint', async () => {
        const tree = await runSchematic(
          'init',
          {
            linter: 'eslint',
          },
          appTree
        );
        const workspaceJson = readJsonInTree(tree, 'workspace.json');
        expect(
          workspaceJson.schematics['@nrwl/angular:application'].linter
        ).toEqual('eslint');
        expect(
          workspaceJson.schematics['@nrwl/angular:library'].linter
        ).toEqual('eslint');
      });
    });

    describe('tslint', () => {
      it('should set the default to tslint', async () => {
        const tree = await runSchematic(
          'init',
          {
            linter: 'tslint',
          },
          appTree
        );
        const workspaceJson = readJsonInTree(tree, 'workspace.json');
        expect(
          workspaceJson.schematics['@nrwl/angular:application'].linter
        ).toEqual('tslint');
        expect(
          workspaceJson.schematics['@nrwl/angular:library'].linter
        ).toEqual('tslint');
      });

      it('should add codelyzer', async () => {
        const tree = await runSchematic(
          'init',
          {
            linter: 'tslint',
          },
          appTree
        );
        const { devDependencies } = readJsonInTree(tree, 'package.json');
        expect(devDependencies['codelyzer']).toBeDefined();
      });
    });
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, appTree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/angular');
    });

    it.each(['css', 'scss', 'styl', 'less'])(
      'should set "%s" as default style extension for components',
      async (style) => {
        const result = await runSchematic('init', { style }, appTree);
        const workspaceJson = readJsonInTree(result, 'workspace.json');
        expect(
          workspaceJson.schematics['@nrwl/angular:component']['style']
        ).toBe(style);
      }
    );
  });
});
