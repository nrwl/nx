import { HashPlanInspector } from './hash-plan-inspector';
import { ProjectGraph } from '../config/project-graph';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';

describe('HashPlanInspector', () => {
  let tempFs: TempFs;
  let inspector: HashPlanInspector;
  let projectGraph: ProjectGraph;

  beforeEach(async () => {
    tempFs = new TempFs('hash-plan-inspector');

    // Create a minimal workspace structure
    await tempFs.createFiles({
      'package.json': JSON.stringify({
        name: 'test-workspace',
        devDependencies: {
          nx: '0.0.0',
        },
      }),
      'nx.json': JSON.stringify({
        extends: 'nx/presets/npm.json',
        targetDefaults: {
          build: {
            cache: true,
          },
          test: {
            cache: true,
          },
        },
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['default', '!{projectRoot}/**/*.spec.ts'],
        },
      }),
      'apps/test-app/project.json': JSON.stringify({
        name: 'test-app',
        sourceRoot: 'apps/test-app/src',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              outputPath: 'dist/apps/test-app',
            },
          },
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'apps/test-app/jest.config.ts',
            },
          },
        },
      }),
      'apps/test-app/src/main.ts': 'console.log("Hello from test-app");',
      'libs/test-lib/project.json': JSON.stringify({
        name: 'test-lib',
        sourceRoot: 'libs/test-lib/src',
        targets: {
          build: {
            executor: '@nx/rollup:rollup',
            options: {
              outputPath: 'dist/libs/test-lib',
            },
          },
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'libs/test-lib/jest.config.ts',
            },
          },
        },
      }),
      'libs/test-lib/src/index.ts': 'export const lib = "test-lib";',
    });

    // Build project graph
    const builder = new ProjectGraphBuilder();

    builder.addNode({
      name: 'test-app',
      type: 'app',
      data: {
        root: 'apps/test-app',
        sourceRoot: 'apps/test-app/src',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              outputPath: 'dist/apps/test-app',
            },
          },
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'apps/test-app/jest.config.ts',
            },
          },
        },
      },
    });

    builder.addNode({
      name: 'test-lib',
      type: 'lib',
      data: {
        root: 'libs/test-lib',
        sourceRoot: 'libs/test-lib/src',
        targets: {
          build: {
            executor: '@nx/rollup:rollup',
            options: {
              outputPath: 'dist/libs/test-lib',
            },
          },
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'libs/test-lib/jest.config.ts',
            },
          },
        },
      },
    });

    builder.addImplicitDependency('test-app', 'test-lib');

    projectGraph = builder.getUpdatedProjectGraph();

    inspector = new HashPlanInspector(projectGraph, tempFs.tempDir);
  });

  afterEach(() => {
    tempFs.reset();
  });

  describe('inspectHashPlan', () => {
    beforeEach(async () => {
      await inspector.init();
    });

    it('should inspect hash plan for single project and target', () => {
      const result = inspector.inspectHashPlan(['test-app'], ['build']);

      // Should return a record mapping task IDs to arrays of hash instructions
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      // Should only contain test-app:build (and not test-lib:build in this case)
      expect(Object.keys(result)).toEqual(['test-app:build']);

      const testAppPlan = result['test-app:build'];
      expect(Array.isArray(testAppPlan)).toBe(true);
      expect(testAppPlan.length).toBeGreaterThan(0);

      // Should include nx.json
      expect(testAppPlan).toContain('file:nx.json');

      // Should include environment variable
      expect(testAppPlan).toContain('env:NX_CLOUD_ENCRYPTION_KEY');

      // Should include test-app files
      expect(testAppPlan).toContain('file:apps/test-app/project.json');
      expect(testAppPlan).toContain('file:apps/test-app/src/main.ts');

      // Should include test-lib files (due to dependency)
      expect(testAppPlan).toContain('file:libs/test-lib/project.json');
      expect(testAppPlan).toContain('file:libs/test-lib/src/index.ts');

      // Should include project configurations
      expect(testAppPlan).toContain('test-app:ProjectConfiguration');
      expect(testAppPlan).toContain('test-lib:ProjectConfiguration');

      // Should include TypeScript configurations
      expect(testAppPlan).toContain('test-app:TsConfig');
      expect(testAppPlan).toContain('test-lib:TsConfig');
    });

    it('should inspect hash plan for multiple projects', () => {
      const result = inspector.inspectHashPlan(
        ['test-app', 'test-lib'],
        ['build']
      );

      // Should have hash plans for both projects
      expect(Object.keys(result).sort()).toEqual([
        'test-app:build',
        'test-lib:build',
      ]);

      // Check test-app:build hash plan
      const testAppPlan = result['test-app:build'];
      expect(Array.isArray(testAppPlan)).toBe(true);

      // test-app should include its own files
      expect(testAppPlan).toContain('file:apps/test-app/project.json');
      expect(testAppPlan).toContain('file:apps/test-app/src/main.ts');

      // test-app should also include test-lib files (due to dependency)
      expect(testAppPlan).toContain('file:libs/test-lib/project.json');
      expect(testAppPlan).toContain('file:libs/test-lib/src/index.ts');

      // Should include configurations for both projects
      expect(testAppPlan).toContain('test-app:ProjectConfiguration');
      expect(testAppPlan).toContain('test-lib:ProjectConfiguration');
      expect(testAppPlan).toContain('test-app:TsConfig');
      expect(testAppPlan).toContain('test-lib:TsConfig');

      // Should include common files
      expect(testAppPlan).toContain('file:nx.json');
      expect(testAppPlan).toContain('env:NX_CLOUD_ENCRYPTION_KEY');

      // Check test-lib:build hash plan
      const testLibPlan = result['test-lib:build'];
      expect(Array.isArray(testLibPlan)).toBe(true);

      // test-lib should only include its own files (no dependencies)
      expect(testLibPlan).toContain('file:libs/test-lib/project.json');
      expect(testLibPlan).toContain('file:libs/test-lib/src/index.ts');

      // Should not include test-app files
      expect(testLibPlan).not.toContain('file:apps/test-app/project.json');
      expect(testLibPlan).not.toContain('file:apps/test-app/src/main.ts');

      // Should include only test-lib configurations
      expect(testLibPlan).toContain('test-lib:ProjectConfiguration');
      expect(testLibPlan).toContain('test-lib:TsConfig');
      expect(testLibPlan).not.toContain('test-app:ProjectConfiguration');
      expect(testLibPlan).not.toContain('test-app:TsConfig');

      // Should include common files
      expect(testLibPlan).toContain('file:nx.json');
      expect(testLibPlan).toContain('env:NX_CLOUD_ENCRYPTION_KEY');
    });

    it('should inspect hash plan for multiple targets', () => {
      const result = inspector.inspectHashPlan(['test-app'], ['build', 'test']);

      expect(Object.keys(result)).toContain('test-app:build');
      expect(Object.keys(result)).toContain('test-app:test');
      expect(Array.isArray(result['test-app:build'])).toBe(true);
      expect(Array.isArray(result['test-app:test'])).toBe(true);
    });

    it('should handle configuration parameter', () => {
      const result = inspector.inspectHashPlan(
        ['test-app'],
        ['build'],
        'production'
      );

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should handle overrides parameter', () => {
      const overrides = { watch: true };
      const result = inspector.inspectHashPlan(
        ['test-app'],
        ['build'],
        undefined,
        overrides
      );

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should handle extraTargetDependencies parameter', () => {
      const extraTargetDependencies = {
        build: [{ target: 'test', projects: 'self' }],
      };
      const result = inspector.inspectHashPlan(
        ['test-app'],
        ['build'],
        undefined,
        {},
        extraTargetDependencies
      );

      // Should include both build and test tasks due to extra dependency
      expect(Object.keys(result)).toContain('test-app:build');
      expect(Object.keys(result)).toContain('test-app:test');
    });

    it('should handle excludeTaskDependencies parameter', () => {
      const result = inspector.inspectHashPlan(
        ['test-app'],
        ['build'],
        undefined,
        {},
        {},
        true
      );

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should handle empty project names array', () => {
      const result = inspector.inspectHashPlan([], ['build']);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle empty targets array', () => {
      const result = inspector.inspectHashPlan(['test-app'], []);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('inspectTask', () => {
    beforeEach(async () => {
      await inspector.init();
    });

    it('should inspect a single task', () => {
      const target = { project: 'test-app', target: 'build' };
      const result = inspector.inspectTask(target);

      // Should only contain test-app:build
      expect(Object.keys(result)).toEqual(['test-app:build']);

      const testAppPlan = result['test-app:build'];
      expect(Array.isArray(testAppPlan)).toBe(true);

      // Should include test-app files
      expect(testAppPlan).toContain('file:apps/test-app/project.json');
      expect(testAppPlan).toContain('file:apps/test-app/src/main.ts');

      // Should include test-lib files (due to dependency)
      expect(testAppPlan).toContain('file:libs/test-lib/project.json');
      expect(testAppPlan).toContain('file:libs/test-lib/src/index.ts');

      // Should include common files
      expect(testAppPlan).toContain('file:nx.json');
      expect(testAppPlan).toContain('env:NX_CLOUD_ENCRYPTION_KEY');

      // Should include configurations
      expect(testAppPlan).toContain('test-app:TsConfig');
      expect(testAppPlan).toContain('test-lib:TsConfig');
      expect(testAppPlan).toContain('test-app:ProjectConfiguration');
      expect(testAppPlan).toContain('test-lib:ProjectConfiguration');
    });

    it('should inspect task with configuration', () => {
      const target = {
        project: 'test-app',
        target: 'build',
        configuration: 'production',
      };
      const result = inspector.inspectTask(target);

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should handle parsed args parameter', () => {
      const target = { project: 'test-app', target: 'build' };
      const parsedArgs = { watch: true, verbose: true };
      const result = inspector.inspectTask(target, parsedArgs);

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should handle extraTargetDependencies parameter', () => {
      const target = { project: 'test-app', target: 'build' };
      const extraTargetDependencies = {
        build: [{ target: 'test', projects: 'self' }],
      };
      const result = inspector.inspectTask(target, {}, extraTargetDependencies);

      // Should include both build and test tasks due to extra dependency
      expect(Object.keys(result)).toContain('test-app:build');
      expect(Object.keys(result)).toContain('test-app:test');
    });

    it('should handle excludeTaskDependencies parameter', () => {
      const target = { project: 'test-app', target: 'build' };
      const result = inspector.inspectTask(target, {}, {}, true);

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });

    it('should inspect test target', () => {
      const target = { project: 'test-app', target: 'test' };
      const result = inspector.inspectTask(target);

      expect(result['test-app:test']).toBeDefined();
      expect(Array.isArray(result['test-app:test'])).toBe(true);
    });

    it('should inspect library project task', () => {
      const target = { project: 'test-lib', target: 'build' };
      const result = inspector.inspectTask(target);

      expect(result['test-lib:build']).toBeDefined();
      expect(Array.isArray(result['test-lib:build'])).toBe(true);
    });

    it('should handle complex parsed args with configuration override', () => {
      const target = { project: 'test-app', target: 'build' };
      const parsedArgs = {
        configuration: 'development',
        targets: ['build'],
        parallel: 3,
        maxParallel: 3,
      };
      const result = inspector.inspectTask(target, parsedArgs);

      expect(result['test-app:build']).toBeDefined();
      expect(Array.isArray(result['test-app:build'])).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      await inspector.init();
    });

    it('should handle both inspectHashPlan and inspectTask on same instance', () => {
      const hashPlanResult = inspector.inspectHashPlan(['test-app'], ['build']);
      const taskResult = inspector.inspectTask({
        project: 'test-app',
        target: 'build',
      });

      expect(hashPlanResult['test-app:build']).toBeDefined();
      expect(taskResult['test-app:build']).toBeDefined();
      expect(Array.isArray(hashPlanResult['test-app:build'])).toBe(true);
      expect(Array.isArray(taskResult['test-app:build'])).toBe(true);
    });

    it('should work with project dependencies', () => {
      // test-app depends on test-lib, so building test-app should include test-lib
      const result = inspector.inspectHashPlan(['test-app'], ['build']);

      // Should only contain test-app:build (test-lib:build is not included as a separate task)
      expect(Object.keys(result)).toEqual(['test-app:build']);

      const testAppPlan = result['test-app:build'];

      // Should include test-lib files in the hash plan due to the dependency
      expect(testAppPlan).toContain('file:libs/test-lib/project.json');
      expect(testAppPlan).toContain('file:libs/test-lib/src/index.ts');

      // Should include both project configurations
      expect(testAppPlan).toContain('test-app:ProjectConfiguration');
      expect(testAppPlan).toContain('test-lib:ProjectConfiguration');

      // Should include both TypeScript configurations
      expect(testAppPlan).toContain('test-app:TsConfig');
      expect(testAppPlan).toContain('test-lib:TsConfig');

      // Should include common files
      expect(testAppPlan).toContain('env:NX_CLOUD_ENCRYPTION_KEY');
      expect(testAppPlan).toContain('file:nx.json');

      // Should include test-app files
      expect(testAppPlan).toContain('file:apps/test-app/project.json');
      expect(testAppPlan).toContain('file:apps/test-app/src/main.ts');
    });

    it('should throw error for non-existent project', () => {
      expect(() => {
        inspector.inspectHashPlan(['non-existent-project'], ['build']);
      }).toThrow();
    });

    it('should throw error for non-existent target', () => {
      expect(() => {
        inspector.inspectHashPlan(['test-app'], ['non-existent-target']);
      }).toThrow();
    });
  });
});
