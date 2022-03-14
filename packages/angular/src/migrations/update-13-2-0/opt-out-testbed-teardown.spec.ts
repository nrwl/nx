import { addProjectConfiguration, logger, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import testbedTeardownOptOutMigration from './opt-out-testbed-teardown';

describe('opt-out-testbed-teardown migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
    jest.doMock('nx/src/utils/app-root', () => ({ appRootPath: '' }));
  });

  it('should warn when the jestConfig property is not configured', async () => {
    // Arrange
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {},
        },
      },
    });

    // Act
    await testbedTeardownOptOutMigration(tree);

    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'The "jestConfig" property is not configured for the test target of the project "app1". Skipping it.'
    );
  });

  it('should warn when the specified jestConfig file does not exist', async () => {
    // Arrange
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'some-path/jest.config.js',
          },
        },
      },
    });

    // Act
    await testbedTeardownOptOutMigration(tree);

    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'The specified "jestConfig" path "some-path/jest.config.js" for the project "app1" can not be found. Skipping it.'
    );
  });

  describe('update initTestEnvironment calls in test setup', () => {
    it('should update correctly when there are no calls to initTestEnvironment', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        'import "jest-preset-angular/setup-jest";'
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when no options are passed to the initTestEnvironment call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when the options passed to the initTestEnvironment call is an empty object', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {});
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when the options passed to the initTestEnvironment call does not have the teardown property', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), { aotSummaries: () => [] });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when an aotSummaries function is passed to the initTestEnvironment call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), function() { return []; });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when an aotSummaries named function is passed to the initTestEnvironment call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), function aotSummaries() { return []; });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should update correctly when an aotSummaries arrow function is passed to the initTestEnvironment call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), () => []);
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });

    it('should not re-add the teardown property twice when it is already being passed to the initTestEnvironment call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), { teardown: { destroyAfterEach: true } });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testSetupFile = tree.read('apps/app1/src/test-setup.ts', 'utf-8');
      expect(testSetupFile).toMatchSnapshot();
    });
  });

  describe('update configureTestingModule in test files', () => {
    it('should not be updated when the test setup file was updated', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        'import "jest-preset-angular/setup-jest";'
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should not be updated when the test setup file had the teardown options already configured', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), { teardown: { destroyAfterEach: true } });
        `
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should update correctly when teardown options and setupFilesAfterEnv are not configured', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should update correctly when teardown options have not been configured and there is no test setup file configured', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: [],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should update correctly when teardown options have not been configured and the specified test setup file does not exist', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should update correctly when teardown options have not been configured and the initTestEnvironment call is invalid', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          setupFilesAfterEnv: ['<rootDir>src/test-setup.ts'],
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";
        import { getTestBed } from '@angular/core/testing';
        import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

        getTestBed().resetTestEnvironment();
        // this is a type error, missing 2nd parameter
        getTestBed().initTestEnvironment(BrowserDynamicTestingModule);
        `
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });`
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should update correctly when there are multiple calls to configureTestingModule', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent1', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });

        describe('AppComponent2', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });

        describe('AppComponent3', () => {
          test('some test case', async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          
            expect(true).toBe(true);
          });
        });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });

    it('should not re-add the teardown property or overwrite when it is already configured for configureTestingModule call', async () => {
      // Arrange
      const jestConfigPath = 'apps/app1/jest.config.js';
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: { jestConfig: jestConfigPath },
          },
        },
      });
      tree.write(
        jestConfigPath,
        `module.exports = {
          transform: { '^.+.(ts|mjs|js|html)$': 'jest-preset-angular' },
        };`
      );
      tree.write(
        'apps/app1/src/app.component.spec.ts',
        `describe('AppComponent1', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          });
        });

        describe('AppComponent2', () => {
          beforeEach(async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
              teardown: { destroyAfterEach: true },
            }).compileComponents();
          });
        });

        describe('AppComponent3', () => {
          test('some test case', async () => {
            await TestBed.configureTestingModule({
              declarations: [AppComponent],
            }).compileComponents();
          
            expect(true).toBe(true);
          });
        });
        `
      );

      // Act
      await testbedTeardownOptOutMigration(tree);

      // Assert
      const testFile = tree.read(
        'apps/app1/src/app.component.spec.ts',
        'utf-8'
      );
      expect(testFile).toMatchSnapshot();
    });
  });
});
