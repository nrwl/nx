import {
  createCache as _createCache,
  extractCachedFileData,
  ProjectGraphCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';
import { createCache } from './nx-deps-cache';
import { ProjectGraph } from 'nx/src/shared/project-graph';
import { WorkspaceJsonConfiguration } from 'nx/src/shared/workspace';
import { NxJsonConfiguration } from 'nx/src/shared/nx';

describe('nx deps utils', () => {
  describe('shouldRecomputeWholeGraph', () => {
    it('should be false when nothing changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '5.0' }),
          createPackageJsonDeps({}),
          createWorkspaceJson({}),
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
          createWorkspaceJson({}),
          createNxJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when version of nrwl/workspace changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            deps: {
              '@nrwl/workspace': '12.0.1',
              plugin: '1.0.0',
            },
          }),
          createPackageJsonDeps({}),
          createWorkspaceJson({}),
          createNxJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when a cached project is missing', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            nodes: {
              'renamed-mylib': { type: 'lib' } as any,
            },
          }),
          createPackageJsonDeps({}),
          createWorkspaceJson({}),
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
          createWorkspaceJson({}),
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
          createWorkspaceJson({}),
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
          createWorkspaceJson({}),
          createNxJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });
  });

  describe('extractCachedPartOfProjectGraph', () => {
    it('should return the cache project graph when nothing has changed', () => {
      const cached = {
        nodes: {
          mylib: {
            name: 'mylib',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedFileData(
        {
          mylib: [
            {
              file: 'index.ts',
              hash: 'hash1',
            },
          ],
        },
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesToProcess).toEqual({});
      expect(r.cachedFileData).toEqual({
        mylib: {
          'index.ts': {
            file: 'index.ts',
            hash: 'hash1',
          },
        },
      });
    });

    it('should handle cases when new projects are added', () => {
      const cached = {
        nodes: {
          mylib: {
            name: 'mylib',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedFileData(
        {
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
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesToProcess).toEqual({
        secondlib: [
          {
            file: 'index.ts',
            hash: 'hash2',
          },
        ],
      });
      expect(r.cachedFileData).toEqual({
        mylib: {
          'index.ts': {
            file: 'index.ts',
            hash: 'hash1',
          },
        },
      });
      expect(r.filesToProcess).toEqual({
        secondlib: [{ file: 'index.ts', hash: 'hash2' }],
      });
    });

    it('should handle cases when files change', () => {
      const cached = {
        nodes: {
          mylib: {
            name: 'mylib',
            type: 'lib',
            data: {
              files: [
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
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedFileData(
        {
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
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesToProcess).toEqual({
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
      });
      expect(r.cachedFileData).toEqual({
        mylib: {
          'index1.ts': {
            file: 'index1.ts',
            hash: 'hash1',
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
        createCache({}) as ProjectGraph,
        {}
      );
    });

    it('should work with no tsconfig', () => {
      const result = _createCache(
        createNxJson({}),
        createPackageJsonDeps({}),
        createCache({}) as ProjectGraph,
        undefined
      );

      expect(result).toBeDefined();
    });
  });

  function createCache(p: Partial<ProjectGraphCache>): ProjectGraphCache {
    const defaults: ProjectGraphCache = {
      version: '5.0',
      deps: {
        '@nrwl/workspace': '12.0.0',
        plugin: '1.0.0',
      },
      pathMappings: {
        mylib: ['libs/mylib/index.ts'],
      },
      nxJsonPlugins: [{ name: 'plugin', version: '1.0.0' }],
      nodes: {
        mylib: { type: 'lib' } as any,
      },
      dependencies: { mylib: [] },
    };
    return { ...defaults, ...p };
  }

  function createPackageJsonDeps(
    p: Record<string, string>
  ): Record<string, string> {
    const defaults = {
      '@nrwl/workspace': '12.0.0',
      plugin: '1.0.0',
    };
    return { ...defaults, ...p };
  }

  function createWorkspaceJson(p: any): WorkspaceJsonConfiguration {
    const defaults = {
      projects: { mylib: {} },
    } as any;
    return { ...defaults, ...p };
  }

  function createNxJson(p: Partial<NxJsonConfiguration>): NxJsonConfiguration {
    const defaults: NxJsonConfiguration = {
      npmScope: '',
      workspaceLayout: {} as any,
      targetDependencies: {},
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
