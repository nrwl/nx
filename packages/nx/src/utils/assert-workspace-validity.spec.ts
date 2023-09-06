import { assertWorkspaceValidity } from './assert-workspace-validity';

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
      "Configuration Error
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
});
