import { type ProjectGraph } from '../../../devkit-exports';
import { CATCH_ALL_RELEASE_GROUP, NxReleaseConfig } from './config';
import { filterReleaseGroups } from './filter-release-groups';

describe('filterReleaseGroups()', () => {
  let projectGraph: ProjectGraph;
  let nxReleaseConfig: NxReleaseConfig;

  beforeEach(() => {
    nxReleaseConfig = {
      groups: {},
      changelog: {
        workspaceChangelog: false,
        projectChangelogs: false,
      },
      version: {
        generator: '',
        generatorOptions: {},
      },
      releaseTagPattern: '',
    };
    projectGraph = {
      nodes: {
        'lib-a': {
          name: 'lib-a',
          type: 'lib',
          data: {
            root: 'libs/lib-a',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
        'lib-b': {
          name: 'lib-b',
          type: 'lib',
          data: {
            root: 'libs/lib-b',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
      },
      dependencies: {},
    };
  });

  describe('projects filter', () => {
    it('should return an error if the user provided projects filter does not match any projects in the workspace', () => {
      const { error } = filterReleaseGroups(projectGraph, nxReleaseConfig, [
        'missing',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "title": "Your --projects filter "missing" did not match any projects in the workspace",
        }
      `);
    });

    it('should return an error if projects match the filter but do not belong to any release groups', () => {
      nxReleaseConfig.groups = {
        foo: {
          projects: ['lib-a'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error } = filterReleaseGroups(projectGraph, nxReleaseConfig, [
        'lib-b',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "- lib-b",
          ],
          "title": "The following projects which match your projects filter "lib-b" did not match any configured release groups:",
        }
      `);
    });

    it('should match all release groups and projects within them if the projects filter is empty', () => {
      nxReleaseConfig.groups = {
        foo: {
          projects: ['lib-a'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projects: ['lib-b'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, []);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          },
          {
            "changelog": false,
            "name": "bar",
            "projects": [
              "lib-b",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
          {
            "changelog": false,
            "name": "bar",
            "projects": [
              "lib-b",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-b",
          },
        }
      `);
    });

    it('should filter the release groups and projects appropriately', () => {
      nxReleaseConfig.groups = {
        foo: {
          projects: ['lib-a'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projects: ['lib-b'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, ['lib-a']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
        }
      `);
    });

    it('should work for the CATCH_ALL_RELEASE_GROUP', () => {
      nxReleaseConfig.groups = {
        [CATCH_ALL_RELEASE_GROUP]: {
          projects: ['lib-a', 'lib-a'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, ['lib-a', 'lib-a']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "__default__",
            "projects": [
              "lib-a",
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "__default__",
            "projects": [
              "lib-a",
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
        }
      `);
    });
  });

  describe('release groups filter', () => {
    it('should return an error if the user provided release groups filter does not match any release groups in the workspace', () => {
      const { error } = filterReleaseGroups(
        projectGraph,
        nxReleaseConfig,
        [],
        ['not-a-group-name']
      );
      expect(error).toMatchInlineSnapshot(`
        {
          "title": "Your --groups filter "not-a-group-name" did not match any release groups in the workspace",
        }
      `);
    });

    it('should filter based on the given release group name', () => {
      nxReleaseConfig.groups = {
        foo: {
          projects: ['lib-a'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projects: ['lib-b'],
          changelog: false,
          version: {
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, [], ['foo']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "releaseTagPattern": "",
            "version": {
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
        }
      `);
    });
  });
});
