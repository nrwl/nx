import {
  assertWorkspaceValidity,
  getImplicitDependencies,
  getProjectNodes
} from './shared-utils';
import { NxJson, ProjectNode, ProjectType } from './shared-models';

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

describe('getImplicitDependencies', () => {
  let mockNxJson: NxJson;
  let mockworkspaceJson: any;

  beforeEach(() => {
    mockNxJson = {
      npmScope: 'proj',
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
    mockworkspaceJson = {
      projects: {
        app1: {
          projectType: 'application'
        },
        'app1-e2e': {
          projectType: 'application'
        },
        app2: {
          projectType: 'application'
        },
        'app2-e2e': {
          projectType: 'application'
        },
        lib1: {
          projectType: 'library'
        },
        lib2: {
          projectType: 'library'
        }
      }
    };
  });

  describe('top-level implicit dependencies', () => {
    it('should return implicit dependencies', () => {
      mockNxJson.implicitDependencies = {
        Jenkinsfile: ['app1', 'app2']
      };

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {
          Jenkinsfile: ['app1', 'app2']
        },
        projects: {
          app1: ['app1-e2e'],
          app2: ['app2-e2e']
        }
      });
    });

    it('should normalize wildcards into all projects', () => {
      mockNxJson.implicitDependencies = {
        'package.json': '*'
      };

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {
          'package.json': [
            'app1',
            'app1-e2e',
            'app2',
            'app2-e2e',
            'lib1',
            'lib2'
          ]
        },
        projects: {
          app1: ['app1-e2e'],
          app2: ['app2-e2e']
        }
      });
    });

    it('should call throw for an invalid workspace', () => {
      delete mockNxJson.projects.app1;
      try {
        getImplicitDependencies(
          getProjectNodes(mockworkspaceJson, mockNxJson),
          mockworkspaceJson,
          mockNxJson
        );
        fail('did not throw');
      } catch (e) {}
    });
  });

  describe('project-based implicit dependencies', () => {
    it('should default appropriately', () => {
      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {},
        projects: {
          app1: ['app1-e2e'],
          app2: ['app2-e2e']
        }
      });
    });

    it('should allow setting on libs and apps', () => {
      mockNxJson.projects.app2.implicitDependencies = ['app1'];
      mockNxJson.projects.lib2.implicitDependencies = ['lib1'];

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {},
        projects: {
          app1: ['app1-e2e', 'app2'],
          app2: ['app2-e2e'],
          lib1: ['lib2']
        }
      });
    });

    // NOTE: originally e2e apps had a magic dependency on their target app by naming convention.
    // So, 'appName-e2e' depended on 'appName'.
    it('should override magic e2e dependencies if specified', () => {
      mockNxJson.projects['app1-e2e'].implicitDependencies = ['app2'];

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {},
        projects: {
          app2: ['app1-e2e', 'app2-e2e']
        }
      });
    });

    it('should fallback to magic e2e dependencies if empty array specified', () => {
      mockNxJson.projects['app1-e2e'].implicitDependencies = [];

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {},
        projects: {
          app1: ['app1-e2e'],
          app2: ['app2-e2e']
        }
      });
    });
  });

  describe('project-based and top-level implicit dependencies', () => {
    it('allows setting both', () => {
      mockNxJson.implicitDependencies = {
        Jenkinsfile: ['app1', 'app2']
      };
      mockNxJson.projects.app2.implicitDependencies = ['app1'];

      const result = getImplicitDependencies(
        getProjectNodes(mockworkspaceJson, mockNxJson),
        mockworkspaceJson,
        mockNxJson
      );

      expect(result).toEqual({
        files: {
          Jenkinsfile: ['app1', 'app2']
        },
        projects: {
          app1: ['app1-e2e', 'app2'],
          app2: ['app2-e2e']
        }
      });
    });
  });
});

describe('getProjectNodes', () => {
  let mockNxJson: any;
  let mockworkspaceJson: any;

  beforeEach(() => {
    mockNxJson = {
      projects: {
        app1: {
          tags: []
        },
        'app1-e2e': {
          tags: []
        },
        'customName-e2e': {
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
    mockworkspaceJson = {
      projects: {
        app1: {
          projectType: 'application'
        },
        'app1-e2e': {
          projectType: 'application'
        },
        'customName-e2e': {
          projectType: 'application'
        },
        lib1: {
          projectType: 'library'
        },
        lib2: {
          projectType: 'library'
        }
      }
    };
  });

  it('should parse nodes as correct type', () => {
    const result: Pick<ProjectNode, 'name' | 'type'>[] = getProjectNodes(
      mockworkspaceJson,
      mockNxJson
    ).map(node => {
      return { name: node.name, type: node.type };
    });
    expect(result).toEqual([
      {
        name: 'app1',
        type: ProjectType.app
      },
      {
        name: 'app1-e2e',
        type: ProjectType.e2e
      },
      {
        name: 'customName-e2e',
        type: ProjectType.e2e
      },
      {
        name: 'lib1',
        type: ProjectType.lib
      },
      {
        name: 'lib2',
        type: ProjectType.lib
      }
    ]);
  });

  it('should normalize missing architect configurations to an empty object', () => {
    const result = getProjectNodes(mockworkspaceJson, mockNxJson).map(node => {
      return { name: node.name, architect: node.architect };
    });
    expect(result).toEqual([
      {
        name: 'app1',
        architect: {}
      },
      {
        name: 'app1-e2e',
        architect: {}
      },
      {
        name: 'customName-e2e',
        architect: {}
      },
      {
        name: 'lib1',
        architect: {}
      },
      {
        name: 'lib2',
        architect: {}
      }
    ]);
  });
});
