import { getImplicitDependencies, assertWorkspaceValidity } from './shared';

describe('assertWorkspaceValidity', () => {
  let mockNxJson;
  let mockAngularJson;

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
          tags: [],
          architect: {
            e2e: {}
          }
        },
        lib1: {
          tags: []
        },
        lib2: {
          tags: []
        }
      }
    };
    mockAngularJson = {
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
    assertWorkspaceValidity(mockAngularJson, mockNxJson);
  });

  it('should throw for a missing project in angular.json', () => {
    delete mockAngularJson.projects.app1;
    try {
      assertWorkspaceValidity(mockAngularJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain('projects are missing in angular.json');
    }
  });

  it('should throw for a missing project in nx.json', () => {
    delete mockNxJson.projects.app1;
    try {
      assertWorkspaceValidity(mockAngularJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain('projects are missing in nx.json');
    }
  });

  it('should throw for an invalid implicit dependency', () => {
    mockNxJson.implicitDependencies = {
      'README.md': ['invalidproj']
    };
    try {
      assertWorkspaceValidity(mockAngularJson, mockNxJson);
      fail('Did not throw');
    } catch (e) {
      expect(e.message).toContain(
        'implicitDependencies specified in nx.json are invalid'
      );
      expect(e.message).toContain('  README.md');
      expect(e.message).toContain('    invalidproj');
    }
  });
});

describe('getImplicitDependencies', () => {
  let mockNxJson;
  let mockAngularJson;

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
    mockAngularJson = {
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

  it('should return implicit dependencies', () => {
    mockNxJson.implicitDependencies = {
      Jenkinsfile: ['app1', 'app2']
    };

    const result = getImplicitDependencies(mockAngularJson, mockNxJson);

    expect(result).toEqual({
      Jenkinsfile: ['app1', 'app2']
    });
  });

  it('should normalize wildcards into all projects', () => {
    mockNxJson.implicitDependencies = {
      'package.json': '*'
    };

    const result = getImplicitDependencies(mockAngularJson, mockNxJson);

    expect(result).toEqual({
      'package.json': ['app1', 'app1-e2e', 'app2', 'app2-e2e', 'lib1', 'lib2']
    });
  });

  it('should call throw for an invalid workspace', () => {
    delete mockNxJson.projects.app1;
    try {
      getImplicitDependencies(mockAngularJson, mockNxJson);
      fail('did not throw');
    } catch (e) {}
  });
});
