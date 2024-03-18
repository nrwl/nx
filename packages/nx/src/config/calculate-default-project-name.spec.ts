import {
  calculateDefaultProjectName,
  findMatchingProjectInCwd,
} from './calculate-default-project-name';

describe('calculateDefaultProjectName', () => {
  describe('findMatchingProjectInCwd', () => {
    it('should return matching project if it is found', () => {
      const projects = {
        'demo-app': {
          name: 'demo-app',
          root: 'apps/demo-app',
        },
      };
      expect(findMatchingProjectInCwd(projects, 'apps/demo-app')).toEqual(
        'demo-app'
      );
      expect(
        findMatchingProjectInCwd(projects, 'apps/demo-app/src/main.tsx')
      ).toEqual('demo-app');
    });

    it('should return if it is root project and cwd is also root', () => {
      const projects = {
        'demo-app': {
          name: 'demo-app',
          root: '.',
        },
      };
      expect(findMatchingProjectInCwd(projects, '')).toEqual('demo-app');
      expect(findMatchingProjectInCwd(projects, '.')).toEqual('demo-app');
    });

    it('should return undefined if no matching project is found', () => {
      expect(
        findMatchingProjectInCwd(
          {
            'demo-app': {
              name: 'demo-app',
              root: 'apps/demo-app',
            },
          },
          'demo-app2'
        )
      ).toEqual(undefined);
    });
  });

  it('should return default project if cwd is root', () => {
    expect(
      calculateDefaultProjectName(
        '.',
        '.',
        { projects: { 'demo-app': { root: 'apps/demo-app' } }, version: 2 },
        { cli: { defaultProjectName: 'demo-app2' } }
      )
    ).toEqual('demo-app2');
  });

  it('should return matching app if cwd is inside an app', () => {
    expect(
      calculateDefaultProjectName(
        'apps/demo-app',
        '.',
        { projects: { 'demo-app': { root: 'apps/demo-app' } }, version: 2 },
        { cli: { defaultProjectName: 'demo-app2' } }
      )
    ).toEqual('demo-app');
  });

  it('should return matching app if cwd is at workspace root', () => {
    expect(
      calculateDefaultProjectName(
        'demo-app',
        'demo-app',
        { projects: { 'demo-app': { root: '.' } }, version: 2 },
        { cli: { defaultProjectName: 'demo-app2' } }
      )
    ).toEqual('demo-app');
  });
});
