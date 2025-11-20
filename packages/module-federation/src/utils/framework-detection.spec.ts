import { ProjectGraph } from '@nx/devkit';
import { isReactProject } from './framework-detection';

describe('framework-detection', () => {
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    projectGraph = {
      nodes: {
        'react-app': {
          name: 'react-app',
          type: 'app',
          data: {
            root: 'apps/react-app',
            sourceRoot: 'apps/react-app/src',
            projectType: 'application',
          },
        },
        'angular-app': {
          name: 'angular-app',
          type: 'app',
          data: {
            root: 'apps/angular-app',
            sourceRoot: 'apps/angular-app/src',
            projectType: 'application',
          },
        },
        'vanilla-app': {
          name: 'vanilla-app',
          type: 'app',
          data: {
            root: 'apps/vanilla-app',
            sourceRoot: 'apps/vanilla-app/src',
            projectType: 'application',
          },
        },
      },
      dependencies: {
        'react-app': [
          { target: 'npm:react', source: 'react-app', type: 'static' },
          { target: 'npm:react-dom', source: 'react-app', type: 'static' },
          {
            target: 'npm:react-router-dom',
            source: 'react-app',
            type: 'static',
          },
        ],
        'angular-app': [
          {
            target: 'npm:@angular/core',
            source: 'angular-app',
            type: 'static',
          },
          {
            target: 'npm:@angular/common',
            source: 'angular-app',
            type: 'static',
          },
          {
            target: 'npm:@angular/platform-browser',
            source: 'angular-app',
            type: 'static',
          },
        ],
        'vanilla-app': [
          { target: 'npm:lodash', source: 'vanilla-app', type: 'static' },
        ],
      },
    };
  });

  describe('isReactProject', () => {
    it('should return true for React projects', () => {
      expect(isReactProject('react-app', projectGraph)).toBe(true);
    });

    it('should return false for Angular projects', () => {
      expect(isReactProject('angular-app', projectGraph)).toBe(false);
    });

    it('should return false for vanilla projects', () => {
      expect(isReactProject('vanilla-app', projectGraph)).toBe(false);
    });

    it('should return false for non-existent projects', () => {
      expect(isReactProject('non-existent', projectGraph)).toBe(false);
    });

    it('should return true if project has @types/react dependency', () => {
      projectGraph.dependencies['react-app'] = [
        { target: 'npm:@types/react', source: 'react-app', type: 'static' },
      ];
      expect(isReactProject('react-app', projectGraph)).toBe(true);
    });
  });
});
