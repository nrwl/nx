import { assertWorkspaceValidity } from './assert-workspace-validity';

describe('assertWorkspaceValidity', () => {
  let mockNxJson: any;
  let mockWorkspaceJson: any;

  beforeEach(() => {
    mockNxJson = {
      projects: {
        app1: {
          tags: []
        },
        'app1-e2e': {
          tags: []
        },
        app2: {
          tags: []
        },
        'app2-e2e': {
          tags: []
        },
        lib1: {
          tags: []
        },
        lib2: {
          tags: []
        }
      }
    };
    mockWorkspaceJson = {
      projects: {
        app1: {},
        'app1-e2e': {},
        app2: {},
        'app2-e2e': {},
        lib1: {},
        lib2: {}
      }
    };
  });

  it('should not throw for a valid workspace', () => {
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
  });

  it('should throw for a missing project in workspace.json', () => {
    delete mockWorkspaceJson.projects.app1;
    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain('projects are missing in');
    }
  });

  it('should throw for a missing project in nx.json', () => {
    delete mockNxJson.projects.app1;
    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain('projects are missing in nx.json');
    }
  });

  it('should throw for an invalid top-level implicit dependency', () => {
    mockNxJson.implicitDependencies = {
      'README.md': ['invalidproj']
    };
    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain(
        'implicitDependencies specified in nx.json are invalid'
      );
      expect(e.message).toContain('  README.md');
      expect(e.message).toContain('    invalidproj');
    }
  });

  it('should throw for an invalid project-level implicit dependency', () => {
    mockNxJson.projects.app2.implicitDependencies = ['invalidproj'];

    try {
      assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain(
        'implicitDependencies specified in nx.json are invalid'
      );
      expect(e.message).toContain('  app2');
      expect(e.message).toContain('    invalidproj');
    }
  });
});
