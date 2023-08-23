import { ProjectGraphProjectNode } from '../../config/project-graph';
import {
  normalizeImplicitDependencies,
  normalizeProjectTargets,
} from './normalize-project-nodes';

describe('workspace-projects', () => {
  let projectGraph: Record<string, ProjectGraphProjectNode> = {
    'test-project': {
      name: 'test-project',
      type: 'lib',
      data: {
        root: 'lib/test-project',
        tags: ['api', 'theme1'],
      },
    },
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'lib/a',
        tags: ['api', 'theme2'],
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: {
        root: 'lib/b',
        tags: ['ui'],
      },
    },
    c: {
      name: 'c',
      type: 'lib',
      data: {
        root: 'lib/c',
        tags: ['api'],
      },
    },
  };

  describe('normalizeImplicitDependencies', () => {
    it('should expand "*" implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', ['*'], projectGraph)
      ).toEqual(['a', 'b', 'c']);
    });

    it('should return [] for null implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', null, projectGraph)
      ).toEqual([]);
    });

    it('should expand glob based implicit dependencies', () => {
      const projectGraphMod: typeof projectGraph = {
        ...projectGraph,
        'b-1': {
          name: 'b-1',
          type: 'lib',
          data: {
            root: 'lib/b-1',
            tags: [],
          },
        },
        'b-2': {
          name: 'b-2',
          type: 'lib',
          data: {
            root: 'lib/b-2',
            tags: [],
          },
        },
      };
      expect(
        normalizeImplicitDependencies('test-project', ['b*'], projectGraphMod)
      ).toEqual(['b', 'b-1', 'b-2']);
    });
  });

  describe('normalizeTargets', () => {
    it('should apply target defaults', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'a',
                },
              },
            },
          },
          {
            build: {
              executor: 'target',
              options: {
                b: 'b',
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ a: 'a', b: 'b' });
    });

    it('should overwrite target defaults when type doesnt match or provided an array', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'a',
                  b: ['project-value'],
                  c: 'project-value',
                },
              },
            },
          },
          {
            build: {
              executor: 'target',
              options: {
                a: 1,
                b: ['default-value'],
                c: ['default-value'],
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ a: 'a', b: ['project-value'], c: 'project-value' });
    });

    it('should overwrite object options from target defaults', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'a',
                  b: {
                    a: 'a',
                    b: 'project-value',
                  },
                },
              },
            },
          },
          {
            build: {
              executor: 'target',
              options: {
                b: {
                  b: 'default-value',
                  c: 'c',
                },
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({
        a: 'a',
        b: {
          a: 'a',
          b: 'project-value',
        },
      });
    });

    it('should convert command property to run-commands executor', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                command: 'echo',
              },
            },
          },
          {},
          'build'
        ).build
      ).toEqual({
        executor: 'nx:run-commands',
        configurations: {},
        options: {
          command: 'echo',
        },
      });
    });

    it('should apply defaults to run-commands from syntactic sugar', () => {
      const result = normalizeProjectTargets(
        {
          name: 'mylib',
          root: 'projects/mylib',
          targets: {
            echo: {
              command: 'echo "hello world"',
            },
          },
        },
        {
          'nx:run-commands': {
            options: {
              cwd: '{projectRoot}',
            },
          },
        },
        'echo'
      );
      expect(result.echo).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'echo "hello world"',
          cwd: 'projects/mylib',
        },
        configurations: {},
      });
    });

    it('should not apply defaults when executor is not nx:run-commands and using command syntactic sugar', () => {
      const result = normalizeProjectTargets(
        {
          name: 'mylib',
          root: 'projects/mylib',
          targets: {
            echo: {
              command: 'echo "hello world"',
            },
          },
        },
        {
          echo: {
            executor: 'nx:noop',
            options: {
              cwd: '{projectRoot}',
            },
          },
        },
        'echo'
      );
      expect(result.echo).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'echo "hello world"',
        },
        configurations: {},
      });
    });

    it('should support {projectRoot}, {workspaceRoot}, and {projectName} tokens', () => {
      expect(
        normalizeProjectTargets(
          {
            name: 'project',
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: '{projectRoot}',
                  b: '{workspaceRoot}',
                  c: '{projectName}',
                },
              },
            },
          },
          {},
          'build'
        ).build.options
      ).toEqual({ a: 'my/project', b: '', c: 'project' });
    });

    it('should suppport {projectRoot} token in targetDefaults', () => {
      expect(
        normalizeProjectTargets(
          {
            name: 'project',
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'a',
                },
              },
            },
          },
          {
            build: {
              executor: 'target',
              options: {
                b: '{projectRoot}',
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ a: 'a', b: 'my/project' });
    });

    it('should merge options when targets use executors with defaults', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                executor: '@nx/jest:jest',
                options: {
                  a: 'a',
                },
              },
            },
          },
          {
            '@nx/jest:jest': {
              options: {
                b: 'b',
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ a: 'a', b: 'b' });
    });

    it('should not merge options when targets use different executors', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'a',
                },
              },
            },
          },
          {
            build: {
              executor: 'different-target',
              options: {
                b: 'c',
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ a: 'a' });
    });

    it('should not merge options when either target or target defaults use `command`', () => {
      expect(
        normalizeProjectTargets(
          {
            root: 'my/project',
            targets: {
              build: {
                command: 'echo',
              },
            },
          },
          {
            build: {
              executor: 'target',
              options: {
                b: 'c',
              },
            },
          },
          'build'
        ).build.options
      ).toEqual({ command: 'echo' });
    });
  });
});
