import { PackageJson } from 'nx/src/shared/package-json';
import { ProjectGraph } from '../core/project-graph';
import {
  getProjectNameFromDirPath,
  getSourceDirOfDependentProjects,
  mergeNpmScriptsWithTargets,
} from './project-graph-utils';

jest.mock('@nrwl/devkit', () => ({
  ...(jest.requireActual('@nrwl/devkit') as any),
  readJsonFile: (path) => {
    if (!(path in jsonFileOverrides))
      throw new Error('Tried to read non-mocked json file: ' + path);
    return jsonFileOverrides[path];
  },
}));

let jsonFileOverrides: Record<string, any> = {};

describe('project graph utils', () => {
  describe('getSourceDirOfDependentProjects', () => {
    const projGraph: ProjectGraph = {
      nodes: {
        'demo-app': {
          name: 'demo-app',
          type: 'app',
          data: {
            root: 'apps/demo-app',
          },
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: {
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library',
            targets: {},
          },
        },
        core: {
          name: 'core',
          type: 'lib',
          data: {
            root: 'libs/core',
            sourceRoot: 'libs/core/src',
            projectType: 'library',
            targets: {},
          },
        },
      },
      dependencies: {
        'demo-app': [
          {
            type: 'static',
            source: 'demo-app',
            target: 'ui',
          },
          {
            type: 'static',
            source: 'demo-app',
            target: 'npm:chalk',
          },
          {
            type: 'static',
            source: 'demo-app',
            target: 'core',
          },
        ],
      },
    };
    it('should correctly gather the source root dirs of the dependent projects', () => {
      const paths = getSourceDirOfDependentProjects('demo-app', projGraph);

      expect(paths.length).toBe(2);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
      expect(paths).toContain(projGraph.nodes['core'].data.sourceRoot);
    });

    it('should throw an error if the project does not exist', () => {
      expect(() =>
        getSourceDirOfDependentProjects('non-existent-app', projGraph)
      ).toThrowError();
    });

    it('should find the project given a file within its src root', () => {
      expect(getProjectNameFromDirPath('apps/demo-app', projGraph)).toEqual(
        'demo-app'
      );

      expect(getProjectNameFromDirPath('apps/demo-app/src', projGraph)).toEqual(
        'demo-app'
      );

      expect(
        getProjectNameFromDirPath('apps/demo-app/src/subdir/bla', projGraph)
      ).toEqual('demo-app');
    });

    it('should throw an error if the project name has not been found', () => {
      expect(() => {
        getProjectNameFromDirPath('apps/demo-app-unknown');
      }).toThrowError();
    });
  });

  describe('mergeNpmScriptsWithTargets', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      scripts: {
        build: 'echo 1',
      },
    };

    const packageJsonBuildTarget = {
      executor: '@nrwl/workspace:run-script',
      options: {
        script: 'build',
      },
    };

    beforeAll(() => {
      jsonFileOverrides['apps/my-app/package.json'] = packageJson;
    });

    afterAll(() => {
      jsonFileOverrides = {};
    });

    it('should prefer project.json targets', () => {
      const projectJsonTargets = {
        build: {
          executor: '@nrwl/workspace:run-commands',
          options: {
            command: 'echo 2',
          },
        },
      };

      const result = mergeNpmScriptsWithTargets(
        'apps/my-app',
        projectJsonTargets
      );
      expect(result).toEqual(projectJsonTargets);
    });

    it('should provide targets from project.json and package.json', () => {
      const projectJsonTargets = {
        clean: {
          executor: '@nrwl/workspace:run-commands',
          options: {
            command: 'echo 2',
          },
        },
      };

      const result = mergeNpmScriptsWithTargets(
        'apps/my-app',
        projectJsonTargets
      );
      expect(result).toEqual({
        ...projectJsonTargets,
        build: packageJsonBuildTarget,
      });
    });

    it('should contain extended options from nx property in package.json', () => {
      jsonFileOverrides['apps/my-other-app/package.json'] = {
        name: 'my-other-app',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              outputs: ['custom'],
            },
          },
        },
      };

      const result = mergeNpmScriptsWithTargets('apps/my-other-app', null);
      expect(result).toEqual({
        build: { ...packageJsonBuildTarget, outputs: ['custom'] },
      });
    });

    it('should work when project.json targets is null', () => {
      const result = mergeNpmScriptsWithTargets('apps/my-app', null);

      expect(result).toEqual({
        build: {
          executor: '@nrwl/workspace:run-script',
          options: {
            script: 'build',
          },
        },
      });
    });

    it("should work when project root is ''", () => {
      jsonFileOverrides['package.json'] = {
        name: 'my-app',
        scripts: {
          test: 'echo testing',
        },
      };

      const result = mergeNpmScriptsWithTargets('', {
        build: {
          executor: '@nrwl/workspace:run-commands',
          options: { command: 'echo hi' },
        },
      });

      expect(result).toEqual({
        build: {
          executor: '@nrwl/workspace:run-commands',
          options: { command: 'echo hi' },
        },
        test: {
          executor: '@nrwl/workspace:run-script',
          options: { script: 'test' },
        },
      });
    });
  });
});
