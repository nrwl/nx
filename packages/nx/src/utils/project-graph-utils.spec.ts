let jsonFileOverrides: Record<string, any> = {};

jest.mock('nx/src/utils/fileutils', () => ({
  ...(jest.requireActual('nx/src/utils/fileutils') as any),
  readJsonFile: (path) => {
    if (path.endsWith('nx.json')) return {};
    if (!(path in jsonFileOverrides))
      throw new Error('Tried to read non-mocked json file: ' + path);
    return jsonFileOverrides[path];
  },
}));

import { PackageJson } from './package-json';
import { ProjectGraph } from '../config/project-graph';
import {
  getSourceDirOfDependentProjects,
  mergeNpmScriptsWithTargets,
} from './project-graph-utils';

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
        'implicit-lib': {
          name: 'implicit-lib',
          type: 'lib',
          data: {},
        },
      },
      externalNodes: {
        'npm:chalk': {},
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
    } as any;
    it('should correctly gather the source root dirs of the dependent projects', () => {
      const [paths] = getSourceDirOfDependentProjects('demo-app', projGraph);

      expect(paths.length).toBe(2);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
      expect(paths).toContain(projGraph.nodes['core'].data.sourceRoot);
    });

    it('should handle circular dependencies', () => {
      projGraph.dependencies['core'] = [
        {
          type: 'static',
          source: 'core',
          target: 'demo-app',
        },
      ];
      const [paths] = getSourceDirOfDependentProjects('demo-app', projGraph);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
    });

    it('should throw an error if the project does not exist', () => {
      expect(() =>
        getSourceDirOfDependentProjects('non-existent-app', projGraph)
      ).toThrowError();
    });

    describe('Given there is implicit library with no sourceRoot', () => {
      it('should return a warnings array with the library with no sourceRoot', () => {
        projGraph.dependencies['demo-app'].push({
          type: 'implicit',
          source: 'demo-app',
          target: 'implicit-lib',
        });

        const [_, warnings] = getSourceDirOfDependentProjects(
          'demo-app',
          projGraph
        );
        expect(warnings).toContain('implicit-lib');
      });
    });
  });

  describe('mergeNpmScriptsWithTargets', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '0.0.0',
      scripts: {
        build: 'echo 1',
      },
    };

    const packageJsonBuildTarget = {
      executor: 'nx:run-script',
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
          executor: 'nx:run-commands',
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
          executor: 'nx:run-commands',
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
          executor: 'nx:run-script',
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
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
      });

      expect(result).toEqual({
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
        test: {
          executor: 'nx:run-script',
          options: { script: 'test' },
        },
      });
    });

    it('should ignore scripts that are not in includedScripts', () => {
      jsonFileOverrides['includedScriptsTest/package.json'] = {
        name: 'included-scripts-test',
        scripts: {
          test: 'echo testing',
          fail: 'exit 1',
        },
        nx: {
          includedScripts: ['test'],
        },
      };

      const result = mergeNpmScriptsWithTargets('includedScriptsTest', {
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
      });

      expect(result).toEqual({
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
        test: {
          executor: 'nx:run-script',
          options: { script: 'test' },
        },
      });
    });
  });
});
