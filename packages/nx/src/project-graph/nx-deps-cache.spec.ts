import {
  createProjectFileMapCache as _createCache,
  extractCachedFileData,
  FileMapCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../config/nx-json';
import { nxVersion } from '../utils/versions';

describe('nx deps utils', () => {
  describe('shouldRecomputeWholeGraph', () => {
    it('should be false when nothing changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '6.0' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson()
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
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when version of nx changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            nxVersion: '12.0.1',
          }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createNxJson({}),
          createTsConfigJson()
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
          createTsConfigJson()
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
          createTsConfigJson({ mylib: ['libs/mylib/changed.ts'] })
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
          createTsConfigJson()
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
          createTsConfigJson()
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
          createTsConfigJson()
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
      _createCache(createNxJson({}), createPackageJsonDeps({}), {} as any, {});
    });

    it('should work with no tsconfig', () => {
      const result = _createCache(
        createNxJson({}),
        createPackageJsonDeps({}),
        {} as any,
        undefined
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
});
