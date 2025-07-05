import { ProjectGraph } from '../../config/project-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import { parseRunOneOptions } from './run-one';

describe('parseRunOneOptions', () => {
  let projectGraph: ProjectGraph;
  let nxJson: NxJsonConfiguration;
  const testCwd = '/test/workspace';

  beforeEach(() => {
    projectGraph = {
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: {
            root: 'apps/my-app',
            targets: {
              build: { executor: '@nx/webpack:webpack' },
              serve: { executor: '@nx/webpack:dev-server' },
              run: { executor: '@nx/js:node' },
            },
          },
        },
        'my-lib': {
          name: 'my-lib',
          type: 'lib',
          data: {
            root: 'libs/my-lib',
            targets: {
              build: { executor: '@nx/js:tsc' },
              test: { executor: '@nx/jest:jest' },
            },
          },
        },
        'default-project': {
          name: 'default-project',
          type: 'app',
          data: {
            root: '.',
            targets: {
              build: { executor: '@nx/js:tsc' },
              serve: { executor: '@nx/webpack:dev-server' },
            },
          },
        },
      },
      dependencies: {},
    };

    nxJson = {
      defaultProject: 'default-project',
    };
  });

  describe('when project:target:configuration contains colon', () => {
    it('should parse project:target:configuration format', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-app:build:production',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('my-app');
      expect(result.target).toBe('build');
      expect(result.configuration).toBe('production');
    });

    it('should parse project:target format without configuration', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-app:build',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('my-app');
      expect(result.target).toBe('build');
      expect(result.configuration).toBeUndefined();
    });
  });

  describe('when parsedArgs.target is provided', () => {
    it('should use the provided target', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('build');
      expect(result.project).toBe('my-app');
    });
  });

  describe('when project has run target', () => {
    it('should set target to "run" when project exists with run target', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('run');
      expect(result.project).toBe('my-app');
    });

    it('should use argument as target when project does not have run target', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-lib',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('my-lib');
      expect(result.project).toBe('default-project');
    });
  });

  describe('when no special conditions are met', () => {
    it('should use project:target:configuration as target', () => {
      const parsedArgs = {
        'project:target:configuration': 'build',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('build');
      expect(result.project).toBe('my-app');
    });
  });

  describe('project resolution', () => {
    it('should use parsedArgs.project when provided', () => {
      const parsedArgs = {
        'project:target:configuration': 'build',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('my-app');
    });

    it('should use default project when no project specified and cwd is workspace root', () => {
      const parsedArgs = {
        target: 'build',
      };

      // Test with cwd at workspace root to trigger default project logic
      const result = parseRunOneOptions(
        '/test/workspace',
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('default-project');
    });
  });

  describe('error handling', () => {
    it('should throw error when target is missing', () => {
      const parsedArgs = {
        project: 'my-app',
        // No target and no 'project:target:configuration'
      };

      expect(() => {
        parseRunOneOptions(
          '/some/other/path',
          parsedArgs,
          projectGraph,
          nxJson
        );
      }).toThrow('Both project and target have to be specified');
    });

    it('should parse successfully when "nx run app" is used even if app does not have run target', () => {
      const parsedArgs = {
        target: 'run',
        project: 'my-lib', // my-lib doesn't have a run target in our test setup
      };

      // The function should parse successfully - target validation happens later in the pipeline
      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('my-lib');
      expect(result.target).toBe('run');
    });
  });

  describe('target aliases', () => {
    it('should resolve target alias "b" to "build"', () => {
      const parsedArgs = {
        target: 'b',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('build');
    });

    it('should resolve target alias "e" to "e2e"', () => {
      const parsedArgs = {
        target: 'e',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('e2e');
    });

    it('should resolve target alias "l" to "lint"', () => {
      const parsedArgs = {
        target: 'l',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('lint');
    });

    it('should resolve target alias "s" to "serve"', () => {
      const parsedArgs = {
        target: 's',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('serve');
    });

    it('should resolve target alias "t" to "test"', () => {
      const parsedArgs = {
        target: 't',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('test');
    });

    it('should not resolve non-alias targets', () => {
      const parsedArgs = {
        target: 'custom-target',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('custom-target');
    });
  });

  describe('configuration handling', () => {
    it('should use parsedArgs.configuration when provided', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
        configuration: 'staging',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.configuration).toBe('staging');
    });

    it('should set configuration to "production" when prod flag is true', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
        prod: true,
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.configuration).toBe('production');
    });

    it('should prefer explicit configuration over prod flag', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
        configuration: 'staging',
        prod: true,
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.configuration).toBe('staging');
    });

    it('should leave configuration undefined when neither flag is set', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.configuration).toBeUndefined();
    });
  });

  describe('parsedArgs cleanup', () => {
    it('should remove specific properties from parsedArgs', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-app:build',
        target: 'build',
        project: 'my-app',
        configuration: 'production',
        prod: true,
        c: 'some-value',
        otherProperty: 'should-remain',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.parsedArgs).toEqual({
        otherProperty: 'should-remain',
        target: 'build',
      });
      expect(result.parsedArgs['project:target:configuration']).toBeUndefined();
      expect(result.parsedArgs.project).toBeUndefined();
      expect(result.parsedArgs.configuration).toBeUndefined();
      expect(result.parsedArgs.prod).toBeUndefined();
      expect(result.parsedArgs.c).toBeUndefined();
    });

    it('should preserve other properties in parsedArgs', () => {
      const parsedArgs = {
        target: 'build',
        project: 'my-app',
        verbose: true,
        output: 'dist',
        customFlag: 'value',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.parsedArgs).toEqual({
        verbose: true,
        output: 'dist',
        customFlag: 'value',
        target: 'build',
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle project:target format without configuration', () => {
      const parsedArgs = {
        'project:target:configuration': 'my-app:build',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('my-app');
      expect(result.target).toBe('build');
      expect(result.configuration).toBeUndefined();
    });

    it('should handle target alias with configuration', () => {
      const parsedArgs = {
        target: 's',
        project: 'my-app',
        configuration: 'development',
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.target).toBe('serve');
      expect(result.configuration).toBe('development');
    });

    it('should use default project with target alias and prod flag', () => {
      const parsedArgs = {
        target: 'b',
        prod: true,
      };

      const result = parseRunOneOptions(
        testCwd,
        parsedArgs,
        projectGraph,
        nxJson
      );

      expect(result.project).toBe('default-project');
      expect(result.target).toBe('build');
      expect(result.configuration).toBe('production');
    });
  });
});
