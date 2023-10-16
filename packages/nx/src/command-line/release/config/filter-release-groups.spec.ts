import { type ProjectGraph } from '../../../devkit-exports';
import { NxReleaseConfig } from './config';
import { CATCH_ALL_RELEASE_GROUP } from './create-release-groups';
import { filterReleaseGroups } from './filter-release-groups';

describe('filterReleaseGroups()', () => {
  let projectGraph: ProjectGraph;
  let nxReleaseConfig: NxReleaseConfig;

  beforeEach(() => {
    nxReleaseConfig = {
      groups: {},
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
        },
        bar: {
          projects: ['lib-b'],
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, []);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
          },
          {
            "name": "bar",
            "projects": [
              "lib-b",
            ],
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
          } => Set {
            "lib-a",
          },
          {
            "name": "bar",
            "projects": [
              "lib-b",
            ],
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
        },
        bar: {
          projects: ['lib-b'],
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, ['lib-a']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
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
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, ['lib-a', 'lib-a']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "name": "__default__",
            "projects": [
              "lib-a",
              "lib-a",
            ],
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "name": "__default__",
            "projects": [
              "lib-a",
              "lib-a",
            ],
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
        },
        bar: {
          projects: ['lib-b'],
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, nxReleaseConfig, [], ['foo']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "name": "foo",
            "projects": [
              "lib-a",
            ],
          } => Set {
            "lib-a",
          },
        }
      `);
    });
  });
});
