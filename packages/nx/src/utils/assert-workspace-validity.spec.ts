import { assertWorkspaceValidity } from './assert-workspace-validity';

describe('assertWorkspaceValidity', () => {
  let mockWorkspaceJson: any;

  beforeEach(() => {
    mockWorkspaceJson = {
      projects: {
        app1: {},
        'app1-e2e': {},
        app2: {},
        'app2-e2e': {},
        lib1: {},
        lib2: {},
      },
    };
  });

  it('should not throw for a valid workspace', () => {
    assertWorkspaceValidity(mockWorkspaceJson, {});
  });

  it('should not throw for a project-level implicit dependency with a glob', () => {
    mockWorkspaceJson.projects.app2.implicitDependencies = ['lib*'];

    expect(() => {
      assertWorkspaceValidity(mockWorkspaceJson, {});
    }).not.toThrow();
  });

  it('should throw for an invalid project-level implicit dependency', () => {
    mockWorkspaceJson.projects.app2.implicitDependencies = ['invalidproj'];

    try {
      assertWorkspaceValidity(mockWorkspaceJson, {});
      fail('should not reach');
    } catch (e) {
      expect(e.message).toContain(
        'The following implicitDependencies point to non-existent project(s)'
      );
      expect(e.message).toContain('invalidproj');
      expect(e.message).toContain('invalidproj');
    }
  });

  it('should throw for an invalid project-level implicit dependency with glob', () => {
    mockWorkspaceJson.projects.app2.implicitDependencies = ['invalid*'];

    try {
      assertWorkspaceValidity(mockWorkspaceJson, {});
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
