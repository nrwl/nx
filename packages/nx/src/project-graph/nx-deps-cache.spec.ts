import '../internal-testing-utils/mock-fs';
import { vol } from 'memfs';
import {
  createProjectFileMapCache as _createCache,
  extractCachedFileData,
  FileMapCache,
  nxFileMap,
  nxProjectGraph,
  parseFileMapCache,
  parseProjectGraphCache,
  readFileMapCache,
  readProjectGraphCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';
import { ProjectGraphError, StaleProjectGraphCacheError } from './error-types';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../config/nx-json';
import { nxVersion } from '../utils/versions';
import { hashObject } from '../hasher/file-hasher';

describe('nx deps utils', () => {
  describe('shouldRecomputeWholeGraph', () => {
    it('should be false when nothing changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '6.0' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(false);
    });

    it('should be true if cache version is outdated', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '4.0' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when version of nx changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ nxVersion: '12.0.1' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when a cached project is missing', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            fileMap: {
              projectFileMap: {
                'renamed-mylib': [],
              } as any,
              nonProjectFiles: [],
            },
          }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when a path mapping changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson({ mylib: ['libs/mylib/changed.ts'] }),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when number of plugins changed', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({
            plugins: ['plugin', 'plugin2'],
          }),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when plugin version changed', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({ plugin: '2.0.0' }),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when plugin config changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({ plugin: '2.0.0' }),
          createProjectsConfiguration({}),
          createNxJson({ pluginsConfig: { somePlugin: { one: 1 } } }),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be false when external nodes did not change', () => {
      const externalNodesHash = hashObject({ 'npm:react': '18.0.0' });

      expect(
        shouldRecomputeWholeGraph(
          createCache({ externalNodesHash }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          externalNodesHash,
          '',
          true,
          ''
        )
      ).toEqual(false);
    });

    it('should be false when external nodes are both empty', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ externalNodesHash: hashObject({}) }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          hashObject({}),
          '',
          true,
          ''
        )
      ).toEqual(false);
    });

    it('should be true when external nodes are added', () => {
      const externalNodesHash = hashObject({ 'npm:react': '18.0.0' });

      expect(
        shouldRecomputeWholeGraph(
          createCache({ externalNodesHash: hashObject({}) }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          externalNodesHash,
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when external nodes are removed', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            externalNodesHash: hashObject({ 'npm:react': '18.0.0' }),
          }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          hashObject({}),
          '',
          true,
          ''
        )
      ).toEqual(true);
    });
    it('should be true when the lock files change', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ lockFileHash: 'lock-files-before-install' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          'lock-files-after-install',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when typescript becomes resolvable', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ typescriptResolvable: false }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          ''
        )
      ).toEqual(true);
    });

    it('should be true when the catalog definitions change', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ catalogsHash: 'catalogs-before-edit' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson(),
          '',
          '',
          true,
          'catalogs-after-edit'
        )
      ).toEqual(true);
    });
  });

  describe('extractCachedPartOfProjectGraph', () => {
    it('should return the cache project graph when nothing has changed', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index.ts',
                hash: 'hash1',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        projectFileMap: {},
        nonProjectFiles: [],
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index.ts': {
              file: 'index.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });

    it('should handle cases when new projects are added', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index.ts',
                hash: 'hash1',
              },
            ],
            secondlib: [
              {
                file: 'index.ts',
                hash: 'hash2',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        projectFileMap: {
          secondlib: [
            {
              file: 'index.ts',
              hash: 'hash2',
            },
          ],
        },
        nonProjectFiles: [],
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index.ts': {
              file: 'index.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });

    it('should handle cases when files change', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index1.ts',
                hash: 'hash1',
              },
              {
                file: 'index2.ts',
                hash: 'hash2b',
              },
              {
                file: 'index4.ts',
                hash: 'hash4',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index1.ts',
                  hash: 'hash1',
                },
                {
                  file: 'index2.ts',
                  hash: 'hash2',
                },
                {
                  file: 'index3.ts',
                  hash: 'hash3',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        nonProjectFiles: [],
        projectFileMap: {
          mylib: [
            {
              file: 'index2.ts',
              hash: 'hash2b',
            },
            {
              file: 'index4.ts',
              hash: 'hash4',
            },
          ],
        },
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index1.ts': {
              file: 'index1.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });
  });

  describe('createCache', () => {
    it('should work with empty tsConfig', () => {
      _createCache(
        createNxJson({}),
        createPackageJsonDeps({}),
        {} as any,
        {},
        '',
        '',
        true,
        ''
      );
    });

    it('should work with no tsconfig', () => {
      const result = _createCache(
        createNxJson({}),
        createPackageJsonDeps({}),
        {} as any,
        undefined,
        '',
        '',
        true,
        ''
      );

      expect(result).toBeDefined();
    });
  });

  function createCache(p: Partial<FileMapCache>): FileMapCache {
    const defaults: FileMapCache = {
      version: '6.0',
      nxVersion: nxVersion,
      pathMappings: {
        mylib: ['libs/mylib/index.ts'],
      },
      nxJsonPlugins: [{ name: 'plugin', version: '1.0.0' }],
      fileMap: {
        nonProjectFiles: [],
        projectFileMap: {
          mylib: [],
        },
      },
      externalNodesHash: '',
      lockFileHash: '',
      typescriptResolvable: true,
      catalogsHash: '',
    };
    return { ...defaults, ...p };
  }

  function createPackageJsonDeps(
    p: Record<string, string>
  ): Record<string, string> {
    const defaults = {
      '@nx/workspace': '12.0.0',
      plugin: '1.0.0',
    };
    return { ...defaults, ...p };
  }

  function createProjectsConfiguration(
    p: any
  ): Record<string, ProjectConfiguration> {
    return { mylib: {}, ...p };
  }

  function createNxJson(p: Partial<NxJsonConfiguration>): NxJsonConfiguration {
    const defaults: NxJsonConfiguration = {
      workspaceLayout: {} as any,
      plugins: ['plugin'],
    };
    return { ...defaults, ...p };
  }

  function createTsConfigJson(paths?: { [k: string]: any }): any {
    const r = {
      compilerOptions: {
        paths: {
          mylib: ['libs/mylib/index.ts'],
        },
      },
    } as any;
    if (paths) {
      r.compilerOptions.paths = paths;
    }
    return r;
  }

  describe('parseProjectGraphCache', () => {
    const graph = { nodes: {}, dependencies: {} };

    it('should return the graph and computedAt', () => {
      expect(
        parseProjectGraphCache(JSON.stringify({ ...graph, computedAt: 5 }))
      ).toEqual({ projectGraph: graph, computedAt: 5 });
    });

    it('should accept a BOM and comments', () => {
      expect(
        parseProjectGraphCache('\uFEFF// c\n' + JSON.stringify(graph))
      ).toEqual({
        projectGraph: graph,
        computedAt: undefined,
      });
    });

    it('should throw when computedAt is below the minimum', () => {
      expect(() =>
        parseProjectGraphCache(JSON.stringify({ ...graph, computedAt: 1 }), 2)
      ).toThrow(StaleProjectGraphCacheError);
      expect(() => parseProjectGraphCache(JSON.stringify(graph), 2)).toThrow(
        StaleProjectGraphCacheError
      );
    });

    it('should return null for a graph with errors and no minimum', () => {
      expect(
        parseProjectGraphCache(
          JSON.stringify({ ...graph, errors: [{ message: 'x' }] })
        )
      ).toBeNull();
    });

    it('should throw a ProjectGraphError for a graph with errors and a minimum', () => {
      expect(() =>
        parseProjectGraphCache(
          JSON.stringify({
            ...graph,
            computedAt: 5,
            errors: [{ message: 'x' }],
          }),
          2
        )
      ).toThrow(ProjectGraphError);
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseProjectGraphCache('{')).toThrow();
    });
  });

  describe('parseFileMapCache', () => {
    it('should return the parsed file map cache', () => {
      const cache = { version: '6.0', fileMap: { projectFileMap: {} } };
      expect(parseFileMapCache(JSON.stringify(cache))).toEqual(cache);
    });

    it('should accept a BOM and comments', () => {
      const cache = { version: '6.0', fileMap: { projectFileMap: {} } };
      expect(parseFileMapCache('\uFEFF// c\n' + JSON.stringify(cache))).toEqual(
        cache
      );
    });

    it('should return null for null content', () => {
      expect(parseFileMapCache('null')).toBeNull();
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseFileMapCache('{')).toThrow();
    });
  });

  describe('cache readers', () => {
    const graph = { nodes: {}, dependencies: {} };

    beforeEach(() => {
      vol.reset();
    });

    it('should return null when the project graph file is missing', () => {
      expect(readProjectGraphCache()).toBeNull();
    });

    it('should return null when the file map is missing', () => {
      expect(readFileMapCache()).toBeNull();
    });

    it('should log and return null when the file map is not valid JSON', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      vol.fromJSON({ [nxFileMap]: '{' });

      expect(readFileMapCache()).toBeNull();
      expect(log).toHaveBeenCalledWith(
        `Error reading '${nxFileMap}'. Continue the process without the cache.`
      );
      log.mockRestore();
    });

    it('should rethrow a StaleProjectGraphCacheError', () => {
      vol.fromJSON({
        [nxProjectGraph]: JSON.stringify({ ...graph, computedAt: 1 }),
      });

      expect(() => readProjectGraphCache(2)).toThrow(
        StaleProjectGraphCacheError
      );
    });

    it('should rethrow a ProjectGraphError', () => {
      vol.fromJSON({
        [nxProjectGraph]: JSON.stringify({
          ...graph,
          computedAt: 5,
          errors: [{ message: 'x' }],
        }),
      });

      expect(() => readProjectGraphCache(2)).toThrow(ProjectGraphError);
    });
  });
});
