import { AffectedMetadata, ProjectStates, ProjectType } from './shared';
import {
  getAffectedApps,
  getAffectedLibs,
  getAffectedProjects,
  getAffectedProjectsWithTarget,
  getAllApps,
  getAllLibs,
  getAllProjects,
  getAllProjectsWithTarget
} from './affected-apps';
import { DependencyType } from './deps-calculator';

describe('affected-apps', () => {
  let affectedMetadata: AffectedMetadata;
  let projectStates: ProjectStates;

  beforeEach(() => {
    const projects: any = {
      app1: {
        name: 'app1',
        type: ProjectType.app,
        architect: {
          lint: {},
          test: {},
          build: {}
        }
      },
      app2: {
        name: 'app2',
        type: ProjectType.app,
        architect: {
          lint: {},
          test: {},
          build: {}
        }
      },
      'app1-e2e': {
        name: 'app1-e2e',
        type: ProjectType.e2e,
        architect: {
          lint: {},
          e2e: {}
        }
      },
      'customName-e2e': {
        name: 'customName-e2e',
        type: ProjectType.e2e,
        architect: {
          lint: {},
          e2e: {}
        }
      },
      lib1: {
        name: 'lib1',
        type: ProjectType.lib,
        architect: {
          lint: {},
          test: {}
        }
      },
      lib2: {
        name: 'lib2',
        type: ProjectType.lib,
        architect: {
          lint: {},
          test: {}
        }
      }
    };
    projectStates = {
      app1: {
        touched: false,
        affected: false
      },
      app2: {
        touched: false,
        affected: false
      },
      'app1-e2e': {
        touched: false,
        affected: false
      },
      'customName-e2e': {
        touched: false,
        affected: false
      },
      lib1: {
        touched: false,
        affected: false
      },
      lib2: {
        touched: false,
        affected: false
      }
    };
    const dependencies = {
      'app1-e2e': [
        {
          projectName: 'app1',
          type: DependencyType.implicit
        }
      ],
      'customName-e2e': [
        {
          projectName: 'app2',
          type: DependencyType.implicit
        }
      ],
      app1: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        }
      ],
      app2: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        },
        {
          projectName: 'lib2',
          type: DependencyType.es6Import
        }
      ],
      lib1: [],
      lib2: []
    };
    affectedMetadata = {
      dependencyGraph: {
        projects,
        dependencies,
        roots: ['app1-e2e', 'customName-e2e']
      },
      projectStates
    };
  });

  describe('getAffectedApps', () => {
    it('should get none if no apps are affected', () => {
      expect(getAffectedApps(affectedMetadata)).toEqual([]);
    });

    it('should find affected apps', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedApps(affectedMetadata)).toEqual(['app1', 'app2']);
    });
  });

  describe('getAffectedLibs', () => {
    it('should get none if no libs are affected', () => {
      expect(getAffectedLibs(affectedMetadata)).toEqual([]);
    });

    it('should find affected libs', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedLibs(affectedMetadata)).toEqual(['lib1']);
    });
  });

  describe('getAffectedProjects', () => {
    it('should get none if no projects are affected', () => {
      expect(getAffectedProjects(affectedMetadata)).toEqual([]);
    });

    it('should find affected projects', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedProjects(affectedMetadata)).toEqual([
        'lib1',
        'app1',
        'app1-e2e',
        'app2',
        'customName-e2e'
      ]);
    });
  });

  describe('getAffectedProjectsWithTarget', () => {
    it('should get none if no projects are affected', () => {
      expect(getAffectedProjectsWithTarget(affectedMetadata, 'test')).toEqual(
        []
      );
    });

    it('should find affected projects that can be linted', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedProjectsWithTarget(affectedMetadata, 'lint')).toEqual([
        'lib1',
        'app1',
        'app1-e2e',
        'app2',
        'customName-e2e'
      ]);
    });

    it('should find affected projects that can be tested', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedProjectsWithTarget(affectedMetadata, 'test')).toEqual([
        'lib1',
        'app1',
        'app2'
      ]);
    });

    it('should find affected projects that can be e2e-tested', () => {
      projectStates.lib1 = {
        affected: true,
        touched: true
      };
      projectStates.app1.affected = true;
      projectStates['app1-e2e'].affected = true;
      projectStates.app2.affected = true;
      projectStates['customName-e2e'].affected = true;
      expect(getAffectedProjectsWithTarget(affectedMetadata, 'e2e')).toEqual([
        'app1-e2e',
        'customName-e2e'
      ]);
    });
  });

  describe('getAllApps', () => {
    it('should get all apps', () => {
      expect(getAllApps(affectedMetadata)).toEqual(['app1', 'app2']);
    });
  });

  describe('getAllLibs', () => {
    it('should get all libs', () => {
      expect(getAllLibs(affectedMetadata)).toEqual(['lib1', 'lib2']);
    });
  });

  describe('getAllProjects', () => {
    it('should get all projects', () => {
      expect(getAllProjects(affectedMetadata)).toEqual([
        'lib1',
        'app1',
        'app1-e2e',
        'lib2',
        'app2',
        'customName-e2e'
      ]);
    });
  });

  describe('getAllProjectsWithTarget', () => {
    it('should get all projects that can be linted', () => {
      expect(getAllProjectsWithTarget(affectedMetadata, 'lint')).toEqual([
        'lib1',
        'app1',
        'app1-e2e',
        'lib2',
        'app2',
        'customName-e2e'
      ]);
    });

    it('should get all projects that can be tested', () => {
      expect(getAllProjectsWithTarget(affectedMetadata, 'test')).toEqual([
        'lib1',
        'app1',
        'lib2',
        'app2'
      ]);
    });

    it('should get all projects that can be built', () => {
      expect(getAllProjectsWithTarget(affectedMetadata, 'build')).toEqual([
        'app1',
        'app2'
      ]);
    });

    it('should get all projects that can be e2e-tested', () => {
      expect(getAllProjectsWithTarget(affectedMetadata, 'e2e')).toEqual([
        'app1-e2e',
        'customName-e2e'
      ]);
    });
  });
});
