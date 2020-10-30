import {
  getOutputsForTargetAndConfiguration,
  unparse,
} from '@nrwl/workspace/src/tasks-runner/utils';

describe('utils', () => {
  describe('getOutputsForTargetAndConfiguration', () => {
    it('should return outputs when defined', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              architect: {
                build: {
                  outputs: ['one', 'two'],
                },
              },
              files: [],
            },
          }
        )
      ).toEqual(['one', 'two']);
    });

    it('should return configuration-specific outputPath when defined', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              architect: {
                build: {
                  options: {
                    outputPath: 'one',
                  },
                  configurations: {
                    production: {
                      outputPath: 'two',
                    },
                  },
                },
              },
              files: [],
            },
          }
        )
      ).toEqual(['two']);
    });

    it('should return configuration-independent outputPath when defined', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              architect: {
                build: {
                  options: {
                    outputPath: 'one',
                  },
                  configurations: {
                    production: {},
                  },
                },
              },
              files: [],
            },
          }
        )
      ).toEqual(['one']);
    });

    it('should handle invalid configuration', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              architect: {
                build: {
                  options: {
                    outputPath: 'one',
                  },
                },
              },
              files: [],
            },
          }
        )
      ).toEqual(['one']);
    });

    it('should handle overrides', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {
              outputPath: 'overrideOutputPath',
            },
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              architect: {
                build: {
                  options: {
                    outputPath: 'one',
                  },
                },
              },
              files: [],
            },
          }
        )
      ).toEqual(['overrideOutputPath']);
    });

    it('should return default output path when nothing else is defined', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'build',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              root: 'root-myapp',
              architect: {
                build: {},
              },
              files: [],
            },
          }
        )
      ).toEqual(['dist/root-myapp']);
    });

    it('should return default path on test target when nothing else is defined', () => {
      expect(
        getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: 'myapp',
              target: 'test',
              configuration: 'production',
            },
          },
          {
            name: 'myapp',
            type: 'application',
            data: {
              root: 'root-myapp',
              architect: {
                test: {},
              },
              files: [],
            },
          }
        )
      ).toEqual(['coverage/root-myapp']);
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
  });
});
