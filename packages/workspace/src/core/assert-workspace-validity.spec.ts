import { assertWorkspaceValidity } from './assert-workspace-validity';

describe('assertWorkspaceValidity', () => {
  let mockNxJson: any;
  let mockWorkspaceJson: any;

  beforeEach(() => {
    mockNxJson = {
      implicitDependencies: {
        'nx.json': '*',
      },
    };
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
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
  });

  it('should throw for an invalid top-level implicit dependency', () => {
    mockNxJson.implicitDependencies = {
      'README.md': ['invalidproj'],
    };

    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('should not reach');
    } catch (e) {
      expect(e.message).toContain(
        'The following implicitDependencies specified in project configurations are invalid'
      );
      expect(e.message).toContain('README.md');
      expect(e.message).toContain('invalidproj');
    }
  });

  it('should throw for an invalid project-level implicit dependency', () => {
    mockWorkspaceJson.projects.app2.implicitDependencies = ['invalidproj'];

    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('should not reach');
    } catch (e) {
      expect(e.message).toContain(
        'The following implicitDependencies specified in project configurations are invalid'
      );
      expect(e.message).toContain('invalidproj');
      expect(e.message).toContain('invalidproj');
    }
  });

  it('should throw for a project-level implicit dependency that is a string', () => {
    mockNxJson.implicitDependencies['nx.json'] = 'invalidproj';

    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('should not reach');
    } catch (e) {
      expect(e.message).toContain('nx.json is not configured properly');
      expect(e.message).toContain('invalidproj');
    }
  });
});
