import type { ProjectGraph } from '@nx/devkit';
import type { WorkspaceFileMap } from 'nx/src/project-graph/file-map-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectOwnersConfig } from '../config';
import { createMetadata } from './plugin';

// `vi.mock` factories are hoisted above every import, so the doubles they
// install have to be hoisted too.
const { mockCreateFileMapUsingProjectGraph, mockReadFileSync } = vi.hoisted(
  () => ({
    mockCreateFileMapUsingProjectGraph: vi.fn(),
    mockReadFileSync: vi.fn(),
  })
);

let nxJson = {};
let projectJsonContents = JSON.stringify({});

// Only the license gate is stubbed. The rest of the module (the
// `FeaturePermission` enum the gate is called with) stays real.
vi.mock('@nx/devkit/internal', async () => {
  return {
    ...(await vi.importActual<typeof import('@nx/devkit/internal')>(
      '@nx/devkit/internal'
    )),
    createFileMapUsingProjectGraph: mockCreateFileMapUsingProjectGraph,
  };
});

vi.mock('node:fs', async () => {
  const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  // Every path the fixtures do not stub falls through to the real reader, so
  // the implementation is wired here where the unmocked module is in scope.
  mockReadFileSync.mockImplementation((path: any, ...rest: any[]) => {
    if (path.endsWith('nx.json')) {
      return stringifyNxJson(nxJson);
    }
    if (path.endsWith('project.json')) {
      return projectJsonContents;
    }
    return actualFs.readFileSync(path, ...rest);
  });
  return {
    ...actualFs,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: mockReadFileSync,
  };
});

describe('createMetadata()', () => {
  let projectGraph: ProjectGraph;
  let workspaceFileMap: WorkspaceFileMap;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty metadata if owners config is not set in nx.json', async () => {
    ({ projectGraph, workspaceFileMap } = createProjectGraphAndWorkspaceFileMap(
      []
    ));
    mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
    nxJson = {};

    await expect(
      createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      )
    ).resolves.toMatchInlineSnapshot(`{}`);
  });

  describe('explicit project owners', () => {
    it('should return project metadata containing owners for entire projects, including configuration location data', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              projects: ['f*'], // should work with patterns
              owners: ['@owner1', '@owner2'],
            },
          ],
        },
      };

      // ownedFiles is '*' because the entire project is owned
      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 9,
                  "startLine": 9,
                },
              },
            },
          ],
        },
        "@owner2": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 10,
                  "startLine": 10,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });
  });

  describe('file based owners', () => {
    it('should return project metadata containing owners for projects with the subset of files specified, including configuration location data', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['**/index.ts'],
              owners: ['@owner1'],
            },
            {
              files: ['**/jest.config.ts'],
              owners: ['@owner2'],
            },
          ],
        },
      };
      // ownedFiles is only the files specified in the pattern for the particular owner
      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/index.ts",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 9,
                  "startLine": 9,
                },
              },
            },
          ],
        },
        "@owner2": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/jest.config.ts",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 17,
                  "startLine": 17,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });

    it('should return project metadata containing deduplicated owners if they match multiple files under a specific project', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts', 'something.json'],
          },
          {
            projectName: 'bar',
            projectFiles: ['index.ts', 'jest.config.ts', 'something.json'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['**/index.ts', '**/something.json'],
              owners: ['@owner1'],
            },
            {
              files: ['**/jest.config.ts'],
              owners: ['@owner1'],
            },
          ],
        },
      };
      // @owner1 matches multiple individual patterns for the foo project based on files, it should deduplicate to a single entry in the metadata ownerFiles
      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "bar": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "libs/bar/index.ts",
                "libs/bar/something.json",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 10,
                  "startLine": 10,
                },
              },
            },
            {
              "files": [
                "libs/bar/jest.config.ts",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 18,
                  "startLine": 18,
                },
              },
            },
          ],
        },
      },
    },
  },
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/index.ts",
                "libs/foo/something.json",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 10,
                  "startLine": 10,
                },
              },
            },
            {
              "files": [
                "libs/foo/jest.config.ts",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 18,
                  "startLine": 18,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });
  });

  describe('CODEOWNERS-style file pattern semantics', () => {
    it('should treat a default "*" pattern as owning files in all projects, like the generated CODEOWNERS file does', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['src/index.ts'],
          },
          {
            projectName: 'bar',
            projectFiles: ['src/nested/util.ts', '.eslintrc.json'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              description: 'Default',
              files: ['*'],
              owners: ['@default-team'],
            },
          ],
        },
      };

      const metadata = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      expect(Object.keys(metadata).sort()).toEqual(['bar', 'foo']);
      expect(
        metadata['foo'].metadata?.owners?.['@default-team']?.ownedFiles[0].files
      ).toEqual(['libs/foo/src/index.ts', 'libs/foo/project.json']);
      // Includes dotfiles, like the VCS providers do for CODEOWNERS patterns
      expect(
        metadata['bar'].metadata?.owners?.['@default-team']?.ownedFiles[0].files
      ).toEqual([
        'libs/bar/src/nested/util.ts',
        'libs/bar/.eslintrc.json',
        'libs/bar/project.json',
      ]);
    });

    it('should match unanchored file patterns at any depth, like the generated CODEOWNERS file does', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['src/index.ts', 'jest.config.ts'],
          },
          {
            projectName: 'bar',
            projectFiles: ['src/index.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['jest.config.ts'],
              owners: ['@test-team'],
            },
          ],
        },
      };

      const metadata = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      // Only foo contains a jest.config.ts, nested below the workspace root
      expect(Object.keys(metadata)).toEqual(['foo']);
      expect(
        metadata['foo'].metadata?.owners?.['@test-team']?.ownedFiles[0].files
      ).toEqual(['libs/foo/jest.config.ts']);
    });

    it('should treat a pattern with a trailing slash as owning the directory contents, like the generated CODEOWNERS file does', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['src/index.ts', 'docs/usage.md'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['/libs/foo/'],
              owners: ['@foo-team'],
            },
          ],
        },
      };

      const metadata = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      expect(
        metadata['foo'].metadata?.owners?.['@foo-team']?.ownedFiles[0].files
      ).toEqual([
        'libs/foo/src/index.ts',
        'libs/foo/docs/usage.md',
        'libs/foo/project.json',
      ]);
    });

    it('should keep a trailing "*" scoped to direct children only, like the generated CODEOWNERS file does', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['README.md', 'src/index.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['libs/foo/*'],
              owners: ['@foo-team'],
            },
          ],
        },
      };

      const metadata = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      // GitHub documents `docs/*` as matching `docs/getting-started.md` but not `docs/build-app/troubleshooting.md`
      expect(
        metadata['foo'].metadata?.owners?.['@foo-team']?.ownedFiles[0].files
      ).toEqual(['libs/foo/README.md', 'libs/foo/project.json']);
    });
  });

  describe('mixed owners', () => {
    it('should return project metadata containing deduplicated owners if there is overlap between projects and files', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              files: ['**/index.ts'],
              owners: ['@owner1'],
            },
            {
              projects: ['foo'],
              owners: ['@owner1', '@owner2'],
            },
          ],
        },
      };
      // @owner1 is listed as both an owner of whole foo project and one specific file within it, it should have one entry with ownerFiles *
      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 17,
                  "startLine": 17,
                },
              },
            },
          ],
        },
        "@owner2": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 18,
                  "startLine": 18,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });
  });

  describe('combined projects and files owners', () => {
    it('should only assign scoped file ownership to projects matching the project pattern, not all projects', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'ui-buttons',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
          {
            projectName: 'data-access',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              projects: ['ui-*'],
              files: ['**/project.json'],
              owners: ['@ops-team'],
            },
          ],
        },
      };

      const result = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      // ui-buttons should have scoped file ownership
      expect(result['ui-buttons']).toBeDefined();
      const uiButtonsOwners =
        result['ui-buttons']!.metadata!.owners!['@ops-team'];
      expect(uiButtonsOwners).toBeDefined();
      expect(uiButtonsOwners!.ownedFiles[0].files).toEqual([
        'libs/ui-buttons/project.json',
      ]);

      // data-access should NOT have any ownership from this pattern
      expect(result['data-access']).toBeUndefined();
    });

    it('should scope file patterns to matched project roots, not workspace root', async () => {
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'ui-buttons',
            projectFiles: ['index.ts', 'jest.config.ts'],
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              projects: ['ui-*'],
              files: ['jest.config.ts'],
              owners: ['@config-team'],
            },
          ],
        },
      };

      const result = await createMetadata(
        projectGraph,
        {},
        {
          nxJsonConfiguration: nxJson,
          workspaceRoot: '',
        }
      );

      const configTeamOwners =
        result['ui-buttons']!.metadata!.owners!['@config-team'];
      expect(configTeamOwners).toBeDefined();
      expect(configTeamOwners!.ownedFiles[0].files).toEqual([
        'libs/ui-buttons/jest.config.ts',
      ]);
    });
  });

  describe('project.json owners config', () => {
    it('should return project metadata based on resolving **/* owners configuration from project.json files', async () => {
      const projectLevelOwnersConfig: ProjectOwnersConfig = {
        // Owns the whole project
        '**/*': ['@owner1'],
      };
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
            projectLevelOwnersConfig,
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        // No owners config in nx.json
        owners: {},
      };
      projectJsonContents = stringifyNxJson({
        owners: projectLevelOwnersConfig,
      });

      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "libs/foo/project.json",
                "location": {
                  "endLine": 5,
                  "startLine": 3,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });

    it('should return project metadata based on resolving owners configuration containing a subset of files from project.json files', async () => {
      const projectLevelOwnersConfig: ProjectOwnersConfig = {
        // Owns only a subset of files in the project
        'index.ts': ['@owner1'],
      };
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
            projectLevelOwnersConfig,
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        // No owners config in nx.json, boolean shorthand to enable owners feature
        owners: true,
      };
      projectJsonContents = stringifyNxJson({
        owners: projectLevelOwnersConfig,
      });

      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/index.ts",
              ],
              "fromConfig": {
                "filePath": "libs/foo/project.json",
                "location": {
                  "endLine": 5,
                  "startLine": 3,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });

    it('should be appropriately merged with the metadata from root nx.json owners configuration', async () => {
      const projectLevelOwnersConfig: ProjectOwnersConfig = {
        // Owns only a subset of files in the project
        'index.ts': ['@owner1'],
      };
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
            projectLevelOwnersConfig,
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              // Owns only a subset of files in the project
              files: ['**/jest.config.ts'],
              owners: ['@owner2'],
            },
          ],
        },
      };
      projectJsonContents = stringifyNxJson({
        owners: projectLevelOwnersConfig,
      });

      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner1": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/index.ts",
              ],
              "fromConfig": {
                "filePath": "libs/foo/project.json",
                "location": {
                  "endLine": 5,
                  "startLine": 3,
                },
              },
            },
          ],
        },
        "@owner2": {
          "ownedFiles": [
            {
              "files": [
                "libs/foo/jest.config.ts",
              ],
              "fromConfig": {
                "filePath": "nx.json",
                "location": {
                  "endLine": 9,
                  "startLine": 9,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });

    it('should be appropriately merged with the metadata from root nx.json owners configuration', async () => {
      const projectLevelOwnersConfig: ProjectOwnersConfig = {
        // Owns the whole project and should take priority vs the subset of files in the nx.json
        '**/*': {
          // Expanded config form with description
          owners: ['@owner2'],
          description: 'Owns the whole project',
        },
      };
      ({ projectGraph, workspaceFileMap } =
        createProjectGraphAndWorkspaceFileMap([
          {
            projectName: 'foo',
            projectFiles: ['index.ts', 'jest.config.ts'],
            projectLevelOwnersConfig,
          },
        ]));
      mockCreateFileMapUsingProjectGraph.mockResolvedValue(workspaceFileMap);
      nxJson = {
        owners: {
          patterns: [
            {
              // Owns only a subset of files in the project at this level
              files: ['**/jest.config.ts'],
              owners: ['@owner2'],
            },
          ],
        },
      };
      projectJsonContents = stringifyNxJson({
        owners: projectLevelOwnersConfig,
      });

      await expect(
        createMetadata(
          projectGraph,
          {},
          {
            nxJsonConfiguration: nxJson,
            workspaceRoot: '',
          }
        )
      ).resolves.toMatchInlineSnapshot(`
{
  "foo": {
    "metadata": {
      "owners": {
        "@owner2": {
          "ownedFiles": [
            {
              "files": [
                "*",
              ],
              "fromConfig": {
                "filePath": "libs/foo/project.json",
                "location": {
                  "endLine": 6,
                  "startLine": 4,
                },
              },
            },
          ],
        },
      },
    },
  },
}
`);
    });
  });
});

function stringifyNxJson(json: any) {
  // We want formatted stringified JSON to prove that the location data is working as expected
  return JSON.stringify(json, null, 2);
}

function createProjectGraphAndWorkspaceFileMap(
  projectsWithFiles: {
    projectName: string;
    projectFiles: string[];
    projectLevelOwnersConfig?: ProjectOwnersConfig;
  }[]
) {
  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };
  const workspaceFileMap: WorkspaceFileMap = {
    allWorkspaceFiles: [],
    fileMap: {
      projectFileMap: {},
      nonProjectFiles: [],
    },
  };
  for (const {
    projectName,
    projectFiles,
    projectLevelOwnersConfig,
  } of projectsWithFiles) {
    projectGraph.nodes[projectName] = {
      type: 'lib',
      name: projectName,
      data: {
        root: `libs/${projectName}`,
        ...(projectLevelOwnersConfig && { owners: projectLevelOwnersConfig }),
      },
    };
    workspaceFileMap.fileMap.projectFileMap[projectName] = projectFiles.map(
      (file) => ({
        file: `libs/${projectName}/${file}`,
        hash: '',
      })
    );
    // Add project.json file
    workspaceFileMap.fileMap.projectFileMap[projectName].push({
      file: `libs/${projectName}/project.json`,
      hash: '',
    });
  }
  return { projectGraph, workspaceFileMap };
}
