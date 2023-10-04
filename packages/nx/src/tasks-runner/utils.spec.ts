import {
  expandDependencyConfigSyntaxSugar,
  getOutputsForTargetAndConfiguration,
  transformLegacyOutputs,
  validateOutputs,
} from './utils';
import { ProjectGraphProjectNode } from '../config/project-graph';

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
          task,
          getNode({
            outputs: [],
          })
        )
      ).toEqual([]);
    });

    it('should interpolate {workspaceRoot}, {projectRoot} and {projectName}', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task,
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

    it('should interpolate {projectRoot} when it is not at the beginning', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task,
          getNode({
            outputs: ['{workspaceRoot}/dist/{projectRoot}'],
          })
        )
      ).toEqual(['dist/myapp']);
    });

    it('should throw when {workspaceRoot} is used not at the beginning', () => {
      expect(() =>
        getOutputsForTargetAndConfiguration(
          task,
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
      expect(getOutputsForTargetAndConfiguration(task, data as any)).toEqual([
        'dist',
      ]);
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
      expect(getOutputsForTargetAndConfiguration(task, data as any)).toEqual([
        'dist',
      ]);
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
        getOutputsForTargetAndConfiguration(task, data as any)
      ).toThrow();
    });

    it('should support interpolation based on options', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          task,
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
          task,
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
          task,
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
          task,
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
          {
            ...task,
            overrides: {
              myVar: 'value/override',
            },
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
            task,
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
            {
              ...task,
              overrides: {
                outputPath: 'overrideOutputPath',
              },
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
            task,
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
            task,
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
          getOutputsForTargetAndConfiguration(task, {
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
            task,
            getNode({
              outputs: ['dist'],
            })
          )
        ).toEqual(['dist']);
      });
      it('should transform non-prefixed paths that use interpolation', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['dist/{projectRoot}'],
            })
          )
        ).toEqual(['dist/myapp']);
      });

      it('should transform relative paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['./sub'],
            })
          )
        ).toEqual(['myapp/sub']);
      });

      it('should transform unix-absolute paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['/dist'],
            })
          )
        ).toEqual(['dist']);
      });
    });
  });

  describe('transformLegacyOutputs', () => {
    it('should prefix paths with {workspaceRoot}', () => {
      const outputs = ['dist'];
      try {
        validateOutputs(outputs);
      } catch (e) {
        const result = transformLegacyOutputs('myapp', e);
        expect(result).toEqual(['{workspaceRoot}/dist']);
      }
    });

    it('should prefix unix-absolute paths with {workspaceRoot}', () => {
      const outputs = ['/dist'];
      try {
        validateOutputs(outputs);
      } catch (e) {
        const result = transformLegacyOutputs('myapp', e);
        expect(result).toEqual(['{workspaceRoot}/dist']);
      }
    });
  });

  it('should prefix relative paths with {projectRoot}', () => {
    const outputs = ['/dist'];
    try {
      validateOutputs(outputs);
    } catch (e) {
      const result = transformLegacyOutputs('myapp', e);
      expect(result).toEqual(['{workspaceRoot}/dist']);
    }
  });

  it('should prefix paths within the project with {projectRoot}', () => {
    const outputs = ['myapp/dist'];
    try {
      validateOutputs(outputs);
    } catch (e) {
      const result = transformLegacyOutputs('myapp', e);
      expect(result).toEqual(['{projectRoot}/dist']);
    }
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
  });
});
