import { NxJsonConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';

import init from './init';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import { Styles } from '../utils/types';

describe('init', () => {
  let host: Tree;

  beforeEach(() => {
    host = createTreeWithEmptyWorkspace();
  });

  it('should add angular dependencies', async () => {
    // ACT
    await init(host, {
      unitTestRunner: UnitTestRunner.Jest,
      linter: Linter.EsLint,
      skipFormat: false,
    });

    // ASSERT
    const { dependencies, devDependencies } = readJson(host, 'package.json');

    expect(dependencies['@angular/animations']).toBeDefined();
    expect(dependencies['@angular/common']).toBeDefined();
    expect(dependencies['@angular/compiler']).toBeDefined();
    expect(dependencies['@angular/core']).toBeDefined();
    expect(dependencies['@angular/platform-browser']).toBeDefined();
    expect(dependencies['@angular/platform-browser-dynamic']).toBeDefined();
    expect(dependencies['@angular/router']).toBeDefined();
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBeDefined();
    expect(devDependencies['@angular/compiler-cli']).toBeDefined();
    expect(devDependencies['@angular/language-service']).toBeDefined();
    expect(devDependencies['@angular-devkit/build-angular']).toBeDefined();

    // codelyzer should no longer be there by default
    expect(devDependencies['codelyzer']).toBeUndefined();
  });

  it('should add a postinstall script for ngcc by default', async () => {
    // ACT
    await init(host, {
      unitTestRunner: UnitTestRunner.Karma,
      linter: Linter.EsLint,
      skipFormat: false,
    });

    const packageJson = readJson(host, 'package.json');

    // ASSERT
    expect(packageJson.scripts.postinstall).toEqual(
      'ngcc --properties es2020 browser module main'
    );
  });

  it('should not add a postinstall script for ngcc if skipPostInstall=true', async () => {
    // ACT
    await init(host, {
      unitTestRunner: UnitTestRunner.Karma,
      linter: Linter.EsLint,
      skipFormat: false,
      skipPostInstall: true,
    });

    const packageJson = readJson(host, 'package.json');

    // ASSERT
    expect(packageJson?.scripts?.postinstall).toBeFalsy();
  });

  describe('--unit-test-runner', () => {
    describe('karma', () => {
      it('should add karma dependencies', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Karma,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(host, 'package.json');

        // ASSERT
        expect(devDependencies['karma']).toBeDefined();
        expect(devDependencies['karma-chrome-launcher']).toBeDefined();
        expect(devDependencies['karma-coverage']).toBeDefined();
        expect(devDependencies['karma-jasmine']).toBeDefined();
        expect(devDependencies['karma-jasmine-html-reporter']).toBeDefined();
        expect(devDependencies['jasmine-core']).toBeDefined();
        expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
        expect(devDependencies['@types/jasmine']).toBeDefined();
      });

      it('should add karma configuration', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Karma,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const hasKarmaConfigFile = host.exists('karma.conf.js');

        // ASSERT
        expect(hasKarmaConfigFile).toBeTruthy();
      });

      it('should set defaults', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Karma,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].unitTestRunner).toEqual(
          'karma'
        );
        expect(generators['@nrwl/angular:library'].unitTestRunner).toEqual(
          'karma'
        );
      });
    });

    describe('jest', () => {
      it('should add jest dependencies', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(host, 'package.json');

        // ASSERT
        expect(devDependencies['@nrwl/jest']).toBeDefined();
        expect(devDependencies['jest']).toBeDefined();
        expect(devDependencies['jest-preset-angular']).toBeDefined();
      });

      it('should add jest configuration', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const hasJestConfigFile = host.exists('jest.config.ts');

        // ASSERT
        expect(hasJestConfigFile).toBeTruthy();
      });

      it('should set defaults', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Jest,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].unitTestRunner).toEqual(
          'jest'
        );
        expect(generators['@nrwl/angular:library'].unitTestRunner).toEqual(
          'jest'
        );
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe('cypress', () => {
      it('should add cypress dependencies', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(host, 'package.json');

        // ASSERT
        expect(devDependencies['@nrwl/cypress']).toBeDefined();
        expect(devDependencies['cypress']).toBeDefined();
      });

      it('should set defaults', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].e2eTestRunner).toEqual(
          'cypress'
        );
      });
    });

    describe('protractor', () => {
      it('should add protractor dependencies', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Protractor,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { devDependencies } = readJson(host, 'package.json');

        // ASSERT
        expect(devDependencies['protractor']).toBeDefined();
        expect(devDependencies['jasmine-core']).toBeDefined();
        expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
        expect(devDependencies['@types/jasmine']).toBeDefined();
        expect(devDependencies['@types/jasminewd2']).toBeDefined();
      });

      it('should set defaults', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          e2eTestRunner: E2eTestRunner.Protractor,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].e2eTestRunner).toEqual(
          'protractor'
        );
      });
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should set the default to eslint', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          linter: Linter.EsLint,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].linter).toEqual(
          'eslint'
        );
        expect(generators['@nrwl/angular:library'].linter).toEqual('eslint');
      });
    });

    describe('none', () => {
      it('should set the default to none', async () => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.None,
          linter: Linter.None,
          skipFormat: false,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:application'].linter).toEqual('none');
        expect(generators['@nrwl/angular:library'].linter).toEqual('none');
      });
    });
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      // ACT
      await init(host, {
        unitTestRunner: UnitTestRunner.Jest,
        e2eTestRunner: E2eTestRunner.Cypress,
        linter: Linter.EsLint,
        skipFormat: false,
      });

      const { cli } = readJson<NxJsonConfiguration>(host, 'nx.json');

      // ASSERT
      expect(cli.defaultCollection).toEqual('@nrwl/angular');
    });

    it.each(['css', 'scss', 'less'])(
      'should set "%s" as default style extension for components',
      async (style: Styles) => {
        // ACT
        await init(host, {
          unitTestRunner: UnitTestRunner.Jest,
          e2eTestRunner: E2eTestRunner.Cypress,
          linter: Linter.EsLint,
          skipFormat: false,
          style,
        });

        const { generators } = readJson<NxJsonConfiguration>(host, 'nx.json');

        // ASSERT
        expect(generators['@nrwl/angular:component']['style']).toBe(style);
      }
    );
  });

  it('should add .angular to gitignore', async () => {
    host.write('.gitignore', '');

    await init(host, {
      unitTestRunner: UnitTestRunner.Jest,
      e2eTestRunner: E2eTestRunner.Cypress,
      linter: Linter.EsLint,
      skipFormat: false,
    });

    expect(host.read('.gitignore', 'utf-8')).toContain('.angular');
  });

  it('should not add .angular to gitignore when it already exists', async () => {
    host.write(
      '.gitignore',
      `foo
bar

.angular

`
    );

    await init(host, {
      unitTestRunner: UnitTestRunner.Jest,
      e2eTestRunner: E2eTestRunner.Cypress,
      linter: Linter.EsLint,
      skipFormat: false,
    });

    const angularEntries = host
      .read('.gitignore', 'utf-8')
      .match(/^.angular$/gm);
    expect(angularEntries).toHaveLength(1);
  });
});
