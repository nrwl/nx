import { DependencyType, ProjectGraph } from '../config/project-graph';
import {
  assertWorkspaceProjectGraphValidity,
  assertWorkspaceValidity,
} from './assert-workspace-validity';

describe('assertWorkspaceValidity', () => {
  let mockProjects: any;

  beforeEach(() => {
    mockProjects = {
      app1: {},
      'app1-e2e': {},
      app2: {},
      'app2-e2e': {},
      lib1: {},
      lib2: {},
    };
  });

  it('should not throw for a valid workspace', () => {
    assertWorkspaceValidity(mockProjects, {});
  });

  it('should not throw for a project-level implicit dependency with a glob', () => {
    mockProjects.app2.implicitDependencies = ['lib*'];

    expect(() => {
      assertWorkspaceValidity(mockProjects, {});
    }).not.toThrow();
  });

  it('should throw for an invalid project-level implicit dependency', () => {
    mockProjects.app2.implicitDependencies = ['invalidproj'];
    mockProjects.lib1.implicitDependencies = '*';

    expect(() => assertWorkspaceValidity(mockProjects, {}))
      .toThrowErrorMatchingInlineSnapshot(`
      "[Configuration Error]:
      The following implicitDependencies should be an array of strings:
        lib1.implicitDependencies: "*"

      The following implicitDependencies point to non-existent project(s):
        app2
          invalidproj"
    `);
  });

  it('should throw for an invalid project-level implicit dependency with glob', () => {
    mockProjects.app2.implicitDependencies = ['invalid*'];

    try {
      assertWorkspaceValidity(mockProjects, {});
      fail('should not reach');
    } catch (e) {
      expect(e.message).toContain(
        'The following implicitDependencies point to non-existent project(s)'
      );
      expect(e.message).toContain('invalid*');
      expect(e.message).toContain('invalid*');
    }
  });

  describe('assertWorkspaceProjectGraphValidity', () => {
    const createProjectGraph = (): ProjectGraph => ({
      nodes: {
        app1: { name: 'app1', type: 'app', data: { root: 'app1' } },
        lib1: { name: 'lib1', type: 'lib', data: { root: 'lib1' } },
        lib2: { name: 'lib2', type: 'lib', data: { root: 'lib2' } },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'lib1', type: DependencyType.static }],
        lib1: [{ source: 'lib1', target: 'app1', type: DependencyType.static }],
        lib2: [
          { source: 'lib2', target: 'npm:react', type: DependencyType.static },
        ],
      },
      externalNodes: {
        'npm:react': {
          name: 'npm:react',
          type: 'npm',
          data: { packageName: 'react', version: '19.0.0' },
        },
      },
    });

    it('should not throw when strict project graph cycle validation is disabled', () => {
      expect(() => {
        assertWorkspaceProjectGraphValidity(createProjectGraph(), {});
      }).not.toThrow();
    });

    it('should throw when strict project graph cycle validation is enabled', () => {
      expect(() =>
        assertWorkspaceProjectGraphValidity(createProjectGraph(), {
          strictProjectGraphCycles: true,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        "[Configuration Error]:
        The project graph contains a circular dependency:
          app1 -> lib1 -> app1

        This validation is enabled by \"strictProjectGraphCycles\" in nx.json."
      `);
    });

    it('should ignore external nodes when checking project graph cycles', () => {
      const projectGraph = createProjectGraph();
      projectGraph.dependencies.app1 = [];
      projectGraph.dependencies.lib1 = [
        { source: 'lib1', target: 'npm:react', type: DependencyType.static },
      ];

      expect(() =>
        assertWorkspaceProjectGraphValidity(projectGraph, {
          strictProjectGraphCycles: true,
        })
      ).not.toThrow();
    });
  });
});
