import { ProjectType, DependencyType } from './affected-apps';
import { createGraphviz, NodeEdgeVariant } from './dep-graph';

describe('dep-graph', () => {
  describe('getNodeProps', () => {
    const deps = {
      app1: [],
      app2: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        }
      ],
      lib1: [],
      lib2: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        }
      ],
      lib3: []
    };

    const projects = [
      {
        name: 'app1',
        root: 'apps/app1',
        type: ProjectType.app,
        tags: [],
        architect: {},
        files: []
      },
      {
        name: 'app2',
        root: 'apps/app2',
        type: ProjectType.app,
        tags: [],
        architect: {},
        files: []
      },
      {
        name: 'lib1',
        root: 'libs/lib1',
        type: ProjectType.lib,
        tags: [],
        architect: {},
        files: []
      },
      {
        name: 'lib2',
        root: 'libs/lib2',
        type: ProjectType.lib,
        tags: [],
        architect: {},
        files: []
      },
      {
        name: 'lib3',
        root: 'libs/lib3',
        type: ProjectType.lib,
        tags: [],
        architect: {},
        files: []
      }
    ];

    const graphvizOptions = {
      graph: [],
      nodes: {
        [ProjectType.app]: {
          [NodeEdgeVariant.default]: {},
          [NodeEdgeVariant.highlighted]: {}
        },
        [ProjectType.lib]: {
          [NodeEdgeVariant.default]: {},
          [NodeEdgeVariant.highlighted]: {
            color: 'red'
          }
        }
      },
      edges: {
        [DependencyType.es6Import]: {
          [NodeEdgeVariant.default]: {},
          [NodeEdgeVariant.highlighted]: {}
        },
        [DependencyType.loadChildren]: {
          [NodeEdgeVariant.default]: {},
          [NodeEdgeVariant.highlighted]: {}
        },
        [DependencyType.implicit]: {
          [NodeEdgeVariant.default]: {},
          [NodeEdgeVariant.highlighted]: {}
        }
      }
    };

    it('should generate the default dot output', () => {
      const resp = createGraphviz(graphvizOptions, deps, projects, {});

      expect(resp).toContain('"app1";');
      expect(resp).toContain('"app2";');
      expect(resp).toContain('"lib1";');
      expect(resp).toContain('"lib2";');
      expect(resp).toContain('"lib3";');
      expect(resp).toContain('"app2" -> "lib1";');
      expect(resp).toContain('"lib2" -> "lib1";');
    });

    it('should add style for highlighted nodes', () => {
      const modifiedOptions = {
        ...graphvizOptions,
        ...{
          nodes: {
            ...graphvizOptions.nodes,
            ...{
              [ProjectType.lib]: {
                [NodeEdgeVariant.default]: {},
                [NodeEdgeVariant.highlighted]: {
                  color: 'red'
                }
              }
            }
          }
        }
      };

      const resp = createGraphviz(modifiedOptions, deps, projects, {
        lib1: true
      });

      expect(resp).toContain('"lib1" [ color = "red" ];');
    });

    it('should add style for highlighted edges', () => {
      const modifiedOptions = {
        ...graphvizOptions,
        ...{
          nodes: {
            ...graphvizOptions.nodes,
            ...{
              [ProjectType.lib]: {
                [NodeEdgeVariant.default]: {},
                [NodeEdgeVariant.highlighted]: {}
              }
            }
          },
          edges: {
            ...graphvizOptions.edges,
            [DependencyType.es6Import]: {
              [NodeEdgeVariant.default]: {},
              [NodeEdgeVariant.highlighted]: {
                color: 'blue'
              }
            }
          }
        }
      };

      const resp = createGraphviz(modifiedOptions, deps, projects, {
        lib1: true
      });

      expect(resp).toContain('"lib1";');
      expect(resp).not.toContain('"lib1" [ color = "red" ];');

      expect(resp).toContain('"app2" -> "lib1" [ color = "blue" ];');

      expect(resp).toContain('"lib2" -> "lib1" [ color = "blue" ];');
    });

    it('should style all variants correctly', () => {
      const newDeps = {
        app1: [
          {
            projectName: 'lib1',
            type: DependencyType.es6Import
          }
        ],
        app2: [
          {
            projectName: 'lib1',
            type: DependencyType.loadChildren
          }
        ],
        lib1: [],
        lib2: [
          {
            projectName: 'lib1',
            type: DependencyType.implicit
          }
        ],
        lib3: []
      };

      const modifiedOptions = {
        ...graphvizOptions,
        ...{
          nodes: {
            [ProjectType.app]: {
              [NodeEdgeVariant.default]: {
                color: 'app-def'
              },
              [NodeEdgeVariant.highlighted]: {
                color: 'app-highlight'
              }
            },
            [ProjectType.lib]: {
              [NodeEdgeVariant.default]: {
                color: 'lib-def'
              },
              [NodeEdgeVariant.highlighted]: {
                color: 'lib-highlight'
              }
            }
          },
          edges: {
            [DependencyType.es6Import]: {
              [NodeEdgeVariant.default]: {
                color: 'es6Import-def'
              },
              [NodeEdgeVariant.highlighted]: {
                color: 'es6Import-highlight'
              }
            },
            [DependencyType.loadChildren]: {
              [NodeEdgeVariant.default]: {
                color: 'loadChildren-def'
              },
              [NodeEdgeVariant.highlighted]: {
                color: 'loadChildren-highlight'
              }
            },
            [DependencyType.implicit]: {
              [NodeEdgeVariant.default]: {
                color: 'implicit-def'
              },
              [NodeEdgeVariant.highlighted]: {
                color: 'implicit-highlight'
              }
            }
          }
        }
      };

      const resp = createGraphviz(modifiedOptions, newDeps, projects, {
        app1: true,
        app2: true,
        lib1: true
      });

      expect(resp).toContain('"app1" [ color = "app-highlight" ];');
      expect(resp).toContain('"app2" [ color = "app-highlight" ];');

      expect(resp).toContain('"lib1" [ color = "lib-highlight" ];');

      expect(resp).toContain('"lib2" [ color = "lib-def" ];');
      expect(resp).toContain('"lib3" [ color = "lib-def" ];');

      expect(resp).toContain(
        '"app1" -> "lib1" [ color = "es6Import-highlight" ];'
      );
      expect(resp).toContain(
        '"app2" -> "lib1" [ color = "loadChildren-highlight" ];'
      );
      expect(resp).toContain(
        '"lib2" -> "lib1" [ color = "implicit-highlight" ];'
      );

      const respNoCriticalPath = createGraphviz(
        modifiedOptions,
        newDeps,
        projects,
        {}
      );

      expect(respNoCriticalPath).toContain(
        '"app1" -> "lib1" [ color = "es6Import-def" ];'
      );
      expect(respNoCriticalPath).toContain(
        '"app2" -> "lib1" [ color = "loadChildren-def" ];'
      );
      expect(respNoCriticalPath).toContain(
        '"lib2" -> "lib1" [ color = "implicit-def" ];'
      );
    });
  });
});
