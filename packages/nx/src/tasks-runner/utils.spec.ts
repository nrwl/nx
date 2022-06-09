import { getOutputsForTargetAndConfiguration } from './utils';
import { ProjectGraphProjectNode } from '../config/project-graph';

describe('utils', () => {
  describe('getOutputsForTargetAndConfiguration', () => {
    const task = {
      overrides: {},
      target: {
        project: 'myapp',
        target: 'build',
        configuration: 'production',
      },
    };

    function getNode(build): ProjectGraphProjectNode {
      return {
        name: 'myapp',
        type: 'app',
        data: {
          root: '/myapp',
          targets: {
            build: { ...build, executor: '' },
          },
          files: [],
        },
      };
    }

    describe('when `outputs` are defined', () => {
      it('should return them', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['one', 'two'],
            })
          )
        ).toEqual(['one', 'two']);
      });

      it('should return them', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['one', 'two'],
            })
          )
        ).toEqual(['one', 'two']);
      });

      it('should support interpolation based on options', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['path/{options.myVar}', 'two'],
              options: {
                myVar: 'one',
              },
            })
          )
        ).toEqual(['path/one', 'two']);
      });

      it('should support interpolating root', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['{project.root}/sub', 'two'],
              options: {
                myVar: 'one',
              },
            })
          )
        ).toEqual(['/myapp/sub', 'two']);
      });

      it('should support relative paths', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['./sub', 'two'],
              options: {
                myVar: 'one',
              },
            })
          )
        ).toEqual(['/myapp/sub', 'two']);
      });

      it('should support nested interpolation based on options', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['path/{options.nested.myVar}', 'two'],
              options: {
                nested: {
                  myVar: 'one',
                },
              },
            })
          )
        ).toEqual(['path/one', 'two']);
      });

      it('should support interpolation based on configuration-specific options', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              outputs: ['path/{options.myVar}', 'two'],
              options: {
                myVar: 'one',
              },
              configurations: {
                production: {
                  myVar: 'other',
                },
              },
            })
          )
        ).toEqual(['path/other', 'two']);
      });

      it('should support interpolation outputs from overrides', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            {
              ...task,
              overrides: {
                myVar: 'overridePath',
              },
            },
            getNode({
              outputs: ['path/{options.myVar}', 'two'],
              options: {
                myVar: 'one',
              },
              configurations: {
                production: {
                  myVar: 'other',
                },
              },
            })
          )
        ).toEqual(['path/overridePath', 'two']);
      });
    });

    describe('when `outputs` is missing (backwards compatibility)', () => {
      it('should return configuration-specific outputPath when defined', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              options: {
                outputPath: 'one',
              },
              configurations: {
                production: {
                  outputPath: 'two',
                },
              },
            })
          )
        ).toEqual(['two']);
      });

      it('should return configuration-independent outputPath when defined', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              options: {
                outputPath: 'one',
              },
              configurations: {
                production: {},
              },
            })
          )
        ).toEqual(['one']);
      });

      it('should handle invalid configuration', () => {
        expect(
          getOutputsForTargetAndConfiguration(
            task,
            getNode({
              options: {
                outputPath: 'one',
              },
            })
          )
        ).toEqual(['one']);
      });

      it('should handle overrides', () => {
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

      it('should return default output path when nothing else is defined', () => {
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
              files: [],
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
  });
});
