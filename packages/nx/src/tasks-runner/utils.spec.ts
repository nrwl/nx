import {
  getOutputsForTargetAndConfiguration,
  unparse,
} from 'nx/src/tasks-runner/utils';
import { ProjectGraphProjectNode } from '../shared/project-graph';

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

  describe('unparse', () => {
    it('should unparse options whose values are primitives', () => {
      const options = {
        boolean1: false,
        boolean2: true,
        number: 4,
        string: 'foo',
        'empty-string': '',
        ignore: null,
      };

      expect(unparse(options)).toEqual([
        '--no-boolean1',
        '--boolean2',
        '--number=4',
        '--string=foo',
        '--empty-string=',
      ]);
    });

    it('should unparse options whose values are arrays', () => {
      const options = {
        array1: [1, 2],
        array2: [3, 4],
      };

      expect(unparse(options)).toEqual([
        '--array1=1',
        '--array1=2',
        '--array2=3',
        '--array2=4',
      ]);
    });

    it('should unparse options whose values are objects', () => {
      const options = {
        foo: {
          x: 'x',
          y: 'y',
          w: [1, 2],
          z: [3, 4],
        },
      };

      expect(unparse(options)).toEqual([
        '--foo.x=x',
        '--foo.y=y',
        '--foo.w=1',
        '--foo.w=2',
        '--foo.z=3',
        '--foo.z=4',
      ]);
    });

    it('should quote string values with space(s)', () => {
      const options = {
        string1: 'one',
        string2: 'one two',
        string3: 'one two three',
      };

      expect(unparse(options)).toEqual([
        '--string1=one',
        '--string2="one two"',
        '--string3="one two three"',
      ]);
    });
  });
});
