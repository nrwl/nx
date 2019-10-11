import { touchedProjects } from './touched';
import { ProjectType } from './shared';

describe('touchedProjects', () => {
  it('should return the list of touchedProjects', () => {
    const tp = touchedProjects(
      {
        files: {
          'package.json': ['app1Name', 'app2Name', 'lib1Name', 'lib2Name']
        },
        projects: {}
      },
      [
        {
          name: 'app1Name',
          root: 'apps/app1',
          files: ['app1.ts'],
          fileMTimes: {
            'app1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'app2Name',
          root: 'apps/app2',
          files: ['app2.ts'],
          fileMTimes: {
            'app2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'lib1Name',
          root: 'libs/lib1',
          files: ['lib1.ts'],
          fileMTimes: {
            'lib1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        },
        {
          name: 'lib2Name',
          root: 'libs/lib2',
          files: ['lib2.ts'],
          fileMTimes: {
            'lib2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        }
      ],
      ['lib2.ts', 'app2.ts', 'package.json']
    );

    expect(tp).toEqual(['app1Name', 'app2Name', 'lib1Name', 'lib2Name']);
  });

  it('should return the list of touchedProjects independent from the git structure', () => {
    const tp = touchedProjects(
      {
        files: {
          'package.json': ['app1Name', 'app2Name', 'lib1Name', 'lib2Name']
        },
        projects: {}
      },
      [
        {
          name: 'app1Name',
          root: 'apps/app1',
          files: ['apps/app1/app1.ts'],
          fileMTimes: {
            'apps/app1/app1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'app2Name',
          root: 'apps/app2',
          files: ['apps/app2/app2.ts'],
          fileMTimes: {
            'apps/app2/app2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'lib1Name',
          root: 'libs/lib1',
          files: ['libs/lib1/lib1.ts'],
          fileMTimes: {
            'libs/lib1/lib1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        },
        {
          name: 'lib2Name',
          root: 'libs/lib2',
          files: ['libs/lib2/lib2.ts'],
          fileMTimes: {
            'libs/lib2/lib2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        }
      ],
      ['libs/lib2/lib2.ts', 'apps/app2/app2.ts']
    );

    expect(tp).toEqual(['app2Name', 'lib2Name']);
  });

  it('should return the list of implicitly touched projects', () => {
    const tp = touchedProjects(
      {
        files: {
          'package.json': ['app1Name', 'app2Name', 'lib1Name', 'lib2Name'],
          Jenkinsfile: ['app1Name', 'app2Name']
        },
        projects: {}
      },
      [
        {
          name: 'app1Name',
          root: 'apps/app1',
          files: ['app1.ts'],
          fileMTimes: {
            'app1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'app2Name',
          root: 'apps/app2',
          files: ['app2.ts'],
          fileMTimes: {
            'app2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'lib1Name',
          root: 'libs/lib1',
          files: ['lib1.ts'],
          fileMTimes: {
            'lib1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        },
        {
          name: 'lib2Name',
          root: 'libs/lib2',
          files: ['lib2.ts'],
          fileMTimes: {
            'lib2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        }
      ],
      ['Jenkinsfile']
    );

    expect(tp).toEqual(['app1Name', 'app2Name']);
  });

  it('should return the list of implicitly touched projects independent from the git structure', () => {
    const tp = touchedProjects(
      {
        files: {
          'package.json': ['app1Name', 'app2Name', 'lib1Name', 'lib2Name'],
          Jenkinsfile: ['app1Name', 'app2Name']
        },
        projects: {}
      },
      [
        {
          name: 'app1Name',
          root: 'apps/app1',
          files: ['app1.ts'],
          fileMTimes: {
            'app1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'app2Name',
          root: 'apps/app2',
          files: ['app2.ts'],
          fileMTimes: {
            'app2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.app
        },
        {
          name: 'lib1Name',
          root: 'libs/lib1',
          files: ['lib1.ts'],
          fileMTimes: {
            'lib1.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        },
        {
          name: 'lib2Name',
          root: 'libs/lib2',
          files: ['lib2.ts'],
          fileMTimes: {
            'lib2.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        }
      ],
      ['Jenkinsfile']
    );

    expect(tp).toEqual(['app1Name', 'app2Name']);
  });
});
