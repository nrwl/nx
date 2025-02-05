import {
  calculateReverseDeps,
  expandDependencyConfigSyntaxSugar,
  expandWildcardTargetConfiguration,
  getDependencyConfigs,
  getOutputsForTargetAndConfiguration,
  interpolate,
  removeTasksAndDependencies,
  transformLegacyOutputs,
  validateOutputs,
} from './utils';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { TaskGraph } from '../config/task-graph';

describe('utils', () => {
  function getNode(build): ProjectGraphProjectNode {
    return {
      name: 'myapp',
      type: 'app',
      data: {
        root: 'myapp',
        targets: {
          build: { ...build, executor: '' },
        },
      },
    };
  }

  describe('interpolate', () => {
    it('should not mangle URLs', () => {
      expect(interpolate('https://npm-registry.example.com/', {})).toEqual(
        'https://npm-registry.example.com/'
      );
    });
  });

  describe('getOutputsForTargetAndConfiguration', () => {
    const task = {
      overrides: {},
      target: {
        project: 'myapp',
        target: 'build',
        configuration: 'production',
      },
    };

    it('should return empty arrays', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: [],
          })
        )
      ).toEqual([]);
    });

    it('should interpolate {workspaceRoot}, {projectRoot} and {projectName}', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: [
              '{workspaceRoot}/one',
              '{projectRoot}/two',
              '{projectName}/three',
            ],
          })
        )
      ).toEqual(['one', 'myapp/two', 'myapp/three']);
    });

    it('should handle relative paths after {projectRoot}', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{projectRoot}/../relative/path'],
          })
        )
      ).toEqual(['relative/path']);
    });

    it('should interpolate {projectRoot} when it is not at the beginning', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{workspaceRoot}/dist/{projectRoot}'],
          })
        )
      ).toEqual(['dist/myapp']);
    });

    it('should throw when {workspaceRoot} is used not at the beginning', () => {
      expect(() =>
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['test/{workspaceRoot}/dist'],
          })
        )
      ).toThrow();
    });

    it('should interpolate {projectRoot} = . by removing the slash after it', () => {
      const data = {
        name: 'myapp',
        type: 'app',
        data: {
          root: '.',
          targets: {
            build: {
              outputs: ['{projectRoot}/dist'],
            },
          },
          files: [],
        },
      };
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          data as any
        )
      ).toEqual(['dist']);
    });

    it('should interpolate {workspaceRoot} when {projectRoot} = . by removing the slash after it', () => {
      const data = {
        name: 'myapp',
        type: 'app',
        data: {
          root: '.',
          targets: {
            build: {
              outputs: ['{workspaceRoot}/dist'],
            },
          },
          files: [],
        },
      };
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          data as any
        )
      ).toEqual(['dist']);
    });

    it('should throw when {projectRoot} is used not at the beginning and the value is .', () => {
      const data = {
        name: 'myapp',
        type: 'app',
        data: {
          root: '.',
          targets: {
            build: {
              outputs: ['test/{projectRoot}'],
            },
          },
          files: [],
        },
      };
      expect(() =>
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          data as any
        )
      ).toThrow();
    });

    it('should support interpolation based on options', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{workspaceRoot}/path/{options.myVar}'],
            options: {
              myVar: 'value',
            },
          })
        )
      ).toEqual(['path/value']);
    });

    it('should support nested interpolation based on options', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{options.nested.myVar}'],
            options: {
              nested: {
                myVar: 'value',
              },
            },
          })
        )
      ).toEqual(['value']);
    });

    it('should support interpolation for non-existing options', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{options.outputFile}'],
            options: {},
          })
        )
      ).toEqual([]);
    });

    it('should support interpolation based on configuration-specific options', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          task.overrides,
          getNode({
            outputs: ['{options.myVar}'],
            options: {
              myVar: 'value',
            },
            configurations: {
              production: {
                myVar: 'value/production',
              },
            },
          })
        )
      ).toEqual(['value/production']);
    });

    it('should support interpolation outputs from overrides', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task.target,
          {
            myVar: 'value/override',
          },
          getNode({
            outputs: ['{options.myVar}'],
            options: {
              myVar: 'value',
            },
            configurations: {
              production: {
                myVar: 'value/production',
              },
            },
          })
        )
      ).toEqual(['value/override']);
    });

    describe('when `outputs` is missing (backwards compatibility)', () => {
      it('should return the outputPath option', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              options: {
                outputPath: 'value',
              },
            })
          )
        ).toEqual(['value']);
      });

      it('should handle outputPath overrides', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            {
              outputPath: 'overrideOutputPath',
            },
            getNode({
              options: {
                outputPath: 'one',
              },
            })
          )
        ).toEqual(['overrideOutputPath']);
      });

      it('should return configuration-specific outputPath when defined', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              options: {
                outputPath: 'value',
              },
              configurations: {
                production: {
                  outputPath: 'value/production',
                },
              },
            })
          )
        ).toEqual(['value/production']);
      });

      it('should return configuration-independent outputPath when defined', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              options: {
                outputPath: 'value',
              },
              configurations: {
                production: {},
              },
            })
          )
        ).toEqual(['value']);
      });

      it('should return default output paths when nothing else is defined', () => {
        expect(
          getOutputsForTargetAndConfiguration(task.target, task.overrides, {
            name: 'myapp',
            type: 'app',
            data: {
              root: 'root-myapp',
              targets: {
                build: {
                  executor: '',
                },
              },
            },
          })
        ).toEqual([
          'dist/root-myapp',
          'root-myapp/dist',
          'root-myapp/build',
          'root-myapp/public',
        ]);
      });
    });

    describe('invalid outputs should be transformed', () => {
      it('should transform non-prefixed paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              outputs: ['{workspaceRoot}/dist'],
            })
          )
        ).toEqual(['dist']);
      });
      it('should transform non-prefixed paths that use interpolation', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              outputs: ['{workspaceRoot}/dist/{projectRoot}'],
            })
          )
        ).toEqual(['dist/myapp']);
      });

      it('should transform relative paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              outputs: ['{projectRoot}/sub'],
            })
          )
        ).toEqual(['myapp/sub']);
      });

      it('should transform unix-absolute paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task.target,
            task.overrides,
            getNode({
              outputs: ['{workspaceRoot}/dist'],
            })
          )
        ).toEqual(['dist']);
      });
    });
  });

  describe('transformLegacyOutputs', () => {
    it('should prefix paths with {workspaceRoot}', () => {
      const outputs = ['dist'];
      const result = transformLegacyOutputs('myapp', outputs);
      expect(result).toEqual(['{workspaceRoot}/dist']);
    });

    it('should prefix unix-absolute paths with {workspaceRoot}', () => {
      const outputs = ['/dist'];
      const result = transformLegacyOutputs('myapp', outputs);
      expect(result).toEqual(['{workspaceRoot}/dist']);
    });
  });

  it('should prefix relative paths with {projectRoot}', () => {
    const outputs = ['./dist'];
    const result = transformLegacyOutputs('myapp', outputs);
    expect(result).toEqual(['{projectRoot}/dist']);
  });

  it('should prefix paths within the project with {projectRoot}', () => {
    const outputs = ['myapp/dist'];

    const result = transformLegacyOutputs('myapp', outputs);
    expect(result).toEqual(['{projectRoot}/dist']);
  });

  describe('expandDependencyConfigSyntaxSugar', () => {
    it('should expand syntax for simple target names', () => {
      const result = expandDependencyConfigSyntaxSugar('build', {
        dependencies: {},
        nodes: {},
      });
      expect(result).toEqual({
        target: 'build',
      });
    });

    it('should assume target of self if simple target also matches project name', () => {
      const result = expandDependencyConfigSyntaxSugar('build', {
        dependencies: {},
        nodes: {
          build: {
            name: 'build',
            type: 'lib',
            data: {
              root: 'libs/build',
            },
          },
        },
      });
      expect(result).toEqual({
        target: 'build',
      });
    });

    it('should expand syntax for simple target names targetting dependencies', () => {
      const result = expandDependencyConfigSyntaxSugar('^build', {
        dependencies: {},
        nodes: {},
      });
      expect(result).toEqual({
        target: 'build',
        dependencies: true,
      });
    });

    it('should expand syntax for strings like project:target if project is a valid project', () => {
      const result = expandDependencyConfigSyntaxSugar('project:build', {
        dependencies: {},
        nodes: {
          project: {
            name: 'project',
            type: 'app',
            data: {
              root: 'libs/project',
            },
          },
        },
      });
      expect(result).toEqual({
        target: 'build',
        projects: ['project'],
      });
    });

    it('should expand syntax for strings like target:with:colons', () => {
      const result = expandDependencyConfigSyntaxSugar('target:with:colons', {
        dependencies: {},
        nodes: {},
      });
      expect(result).toEqual({
        target: 'target:with:colons',
      });
    });

    it('supports wildcards in targets', () => {
      const result = getDependencyConfigs(
        { project: 'project', target: 'build' },
        {},
        {
          dependencies: {},
          nodes: {
            project: {
              name: 'project',
              type: 'app',
              data: {
                root: 'libs/project',
                targets: {
                  build: {
                    dependsOn: ['build-*'],
                  },
                  'build-css': {},
                  'build-js': {},
                  'then-build-something-else': {},
                },
              },
            },
          },
        },
        ['build', 'build-css', 'build-js', 'then-build-something-else']
      );
      expect(result).toEqual([
        {
          target: 'build-css',
          projects: ['project'],
        },
        {
          target: 'build-js',
          projects: ['project'],
        },
      ]);
    });

    it('should support wildcards with dependencies', () => {
      const result = getDependencyConfigs(
        { project: 'project', target: 'build' },
        {},
        {
          dependencies: {},
          nodes: {
            project: {
              name: 'project',
              type: 'app',
              data: {
                root: 'libs/project',
                targets: {
                  build: {
                    dependsOn: ['^build-*'],
                  },
                  'then-build-something-else': {},
                },
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {
                  'build-css': {},
                  'build-js': {},
                },
              },
            },
            dep2: {
              name: 'dep2',
              type: 'lib',
              data: {
                root: 'libs/dep2',
                targets: {
                  'build-python': {},
                },
              },
            },
          },
        },
        [
          'build',
          'build-css',
          'build-js',
          'then-build-something-else',
          'build-python',
        ]
      );
      expect(result).toEqual([
        {
          target: 'build-css',
          dependencies: true,
        },
        {
          target: 'build-js',
          dependencies: true,
        },
        {
          target: 'build-python',
          dependencies: true,
        },
      ]);
    });

    it('should support multiple dependsOn chains', () => {
      const graph = new GraphBuilder()
        .addProjectConfiguration({
          name: 'foo',
          targets: {
            build: {
              dependsOn: ['build:one'],
            },
            'build:one': {
              dependsOn: [{ target: 'build:two' }],
            },
            'build:two': {},
          },
        })
        .addProjectConfiguration({
          name: 'bar',
          targets: {
            build: {
              dependsOn: ['build:one'],
            },
            'build:one': {
              dependsOn: [{ target: 'build:two' }],
            },
            'build:two': {},
          },
        })
        .build();

      const getTargetDependencies = (project: string, target: string) =>
        getDependencyConfigs(
          {
            project,
            target,
          },
          {},
          graph,
          ['build', 'build:one', 'build:two']
        );

      expect(getTargetDependencies('foo', 'build')).toEqual([
        {
          target: 'build:one',
          projects: ['foo'],
        },
      ]);

      expect(getTargetDependencies('foo', 'build:one')).toEqual([
        {
          target: 'build:two',
          projects: ['foo'],
        },
      ]);

      expect(getTargetDependencies('foo', 'build:two')).toEqual([]);

      expect(getTargetDependencies('bar', 'build')).toEqual([
        {
          target: 'build:one',
          projects: ['bar'],
        },
      ]);

      expect(getTargetDependencies('bar', 'build:one')).toEqual([
        {
          target: 'build:two',
          projects: ['bar'],
        },
      ]);

      expect(getTargetDependencies('bar', 'build:two')).toEqual([]);
    });
  });

  describe('expandWildcardDependencies', () => {
    it('should expand wildcard dependencies', () => {
      const allTargets = ['build', 'build:test', 'build:prod', 'build:dev'];
      const results = expandWildcardTargetConfiguration(
        {
          target: 'build*',
          projects: ['a'],
        },
        allTargets
      );

      expect(results).toEqual([
        {
          target: 'build',
          projects: ['a'],
        },
        {
          target: 'build:test',
          projects: ['a'],
        },
        {
          target: 'build:prod',
          projects: ['a'],
        },
        {
          target: 'build:dev',
          projects: ['a'],
        },
      ]);

      const results2 = expandWildcardTargetConfiguration(
        {
          target: 'build*',
          projects: ['b'],
        },
        allTargets
      );

      expect(results2).toEqual([
        {
          target: 'build',
          projects: ['b'],
        },
        {
          target: 'build:test',
          projects: ['b'],
        },
        {
          target: 'build:prod',
          projects: ['b'],
        },
        {
          target: 'build:dev',
          projects: ['b'],
        },
      ]);
    });
  });

  describe('validateOutputs', () => {
    it('returns undefined if there are no errors', () => {
      expect(validateOutputs(['{projectRoot}/dist'])).toBeUndefined();
    });

    it('throws an error if the output is not an array', () => {
      expect(() => validateOutputs('output' as unknown as string[])).toThrow(
        "The 'outputs' field must be an array"
      );
    });

    it("throws an error if the output has entries that aren't strings", () => {
      expect(() =>
        validateOutputs(['foo', 1, null, true, {}, []] as unknown as string[])
      ).toThrow(
        "The 'outputs' field must contain only strings, but received types: [string, number, object, boolean, object, object]"
      );
    });

    it('throws an error if the output is a glob pattern from the workspace root', () => {
      expect(() => validateOutputs(['{workspaceRoot}/**/dist/*.js']))
        .toThrowErrorMatchingInlineSnapshot(`
        "The following outputs are defined by a glob pattern from the workspace root: 
         - {workspaceRoot}/**/dist/*.js

        These can be slow, replace them with a more specific pattern."
      `);
    });

    it("shouldn't throw an error if the output is a glob pattern from the project root", () => {
      expect(() => validateOutputs(['{projectRoot}/*.js'])).not.toThrow();
    });

    it("shouldn't throw an error if the pattern is a glob based in a subdirectory of workspace root", () => {
      expect(() =>
        validateOutputs(['{workspaceRoot}/dist/**/*.js'])
      ).not.toThrow();
    });

    it("throws an error if the output doesn't start with a prefix", () => {
      expect(() => validateOutputs(['dist']))
        .toThrowErrorMatchingInlineSnapshot(`
        "The following outputs are invalid: 
         - dist

        Run \`nx repair\` to fix this."
      `);
    });
  });

  describe('removeTasksAndDependencies', () => {
    it('removes tasks', () => {
      const graph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'b:build': {
            id: 'b:build',
            target: {
              project: 'b',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': ['b:build'],
          'b:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
        },
        roots: ['b:build'],
      };

      const reverse = calculateReverseDeps(graph);

      expect(
        removeTasksAndDependencies(graph, reverse, new Set(['b:build']))
      ).toEqual({
        continuousDependencies: {
          'a:build': [],
        },
        dependencies: {
          'a:build': [],
        },
        roots: ['a:build'],
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
      });
    });
    it('removes tasks with no dependencies', () => {
      const graph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': [],
        },
        continuousDependencies: {
          'a:build': [],
        },
        roots: ['a:build'],
      };

      const reverse = calculateReverseDeps(graph);

      expect(
        removeTasksAndDependencies(graph, reverse, new Set(['a:build']))
      ).toEqual({
        continuousDependencies: {},
        dependencies: {},
        roots: [],
        tasks: {},
      });
    });
    it('should remove specified tasks and their dependencies from the task graph', () => {
      const taskGraph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'b:build': {
            id: 'b:build',
            target: { project: 'b', target: 'build' },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'c:build': {
            id: 'c:build',
            target: { project: 'c', target: 'build' },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': ['b:build'],
          'b:build': ['c:build'],
          'c:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
          'c:build': [],
        },
        roots: ['c:build'],
      };

      const reverseTaskDeps = calculateReverseDeps(taskGraph);
      const tasksToRemove = new Set(['b:build']);

      expect(
        removeTasksAndDependencies(taskGraph, reverseTaskDeps, tasksToRemove)
      ).toEqual({
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': [],
        },
        continuousDependencies: {
          'a:build': [],
        },
        roots: ['a:build'],
      });
    });
    it('should remove multiple tasks with dependencies', () => {
      const graph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'b:build': {
            id: 'b:build',
            target: {
              project: 'b',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'c:build': {
            id: 'c:build',
            target: {
              project: 'c',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': ['c:build'],
          'b:build': ['c:build'],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
        },
        roots: ['c:build'],
      };

      const reverse = calculateReverseDeps(graph);

      expect(
        removeTasksAndDependencies(
          graph,
          reverse,
          new Set(['a:build', 'b:build'])
        )
      ).toEqual({
        continuousDependencies: {},
        dependencies: {},
        roots: [],
        tasks: {},
      });
    });
    it('should remove tasks that are needed only by tasks which are also being removed', () => {
      const graph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'b:build': {
            id: 'b:build',
            target: {
              project: 'b',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'c:build': {
            id: 'c:build',
            target: {
              project: 'c',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'd:build': {
            id: 'd:build',
            target: {
              project: 'd',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': ['b:build', 'c:build'],
          'b:build': ['d:build'],
          'c:build': ['d:build'],
          'd:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
          'c:build': [],
          'd:build': [],
        },
        roots: ['d:build'],
      };

      const reverse = calculateReverseDeps(graph);

      expect(
        removeTasksAndDependencies(graph, reverse, new Set(['a:build']))
      ).toEqual({
        continuousDependencies: {},
        dependencies: {},
        roots: [],
        tasks: {},
      });
    });
    it('should keep tasks that are needed', () => {
      const graph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: {
              project: 'a',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'b:build': {
            id: 'b:build',
            target: {
              project: 'b',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'c:build': {
            id: 'c:build',
            target: {
              project: 'c',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
        dependencies: {
          'a:build': ['c:build'],
          'b:build': ['c:build'],
          'c:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
          'c:build': [],
        },
        roots: ['c:build'],
      };

      const reverse = calculateReverseDeps(graph);

      expect(
        removeTasksAndDependencies(graph, reverse, new Set(['a:build']))
      ).toEqual({
        continuousDependencies: {
          'b:build': [],
          'c:build': [],
        },
        dependencies: {
          'b:build': ['c:build'],
          'c:build': [],
        },
        roots: ['c:build'],
        tasks: {
          'b:build': {
            id: 'b:build',
            target: {
              project: 'b',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          'c:build': {
            id: 'c:build',
            target: {
              project: 'c',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        },
      });
    });
  });
});

class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};

  addProjectConfiguration(
    project: Omit<ProjectConfiguration, 'root'>,
    type?: ProjectGraph['nodes'][string]['type']
  ) {
    const t = type ?? 'lib';
    this.nodes[project.name] = {
      name: project.name,
      type: t,
      data: { ...project, root: `${t}/${project.name}` },
    };
    return this;
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes,
      dependencies: {},
      externalNodes: {},
    };
  }
}
