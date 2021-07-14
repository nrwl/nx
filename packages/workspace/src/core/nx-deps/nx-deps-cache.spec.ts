import { NxJsonConfiguration, WorkspaceJsonConfiguration } from '@nrwl/devkit';
import {
  extractCachedPartOfProjectGraph,
  ProjectGraphCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';

describe('nx deps utils', () => {
  describe('shouldRecomputeWholeGraph', () => {
    it('should be false when nothing changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({}),
          createWorkspaceJson({}),
          createNxJson({}),
          createTsConfigJson()
        )
      ).toEqual(false);
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
              'renamed-mylib': {} as any,
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
                  ext: 'ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedPartOfProjectGraph(
        {
          mylib: [
            {
              file: 'index.ts',
              ext: 'ts',
              hash: 'hash1',
            },
          ],
        },
        createNxJson({}),
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesDifferentFromCache).toEqual({});
      expect(r.cachedPartOfProjectGraph).toEqual(cached);
    });

    it('should handle cases when no projects are added', () => {
      const cached = {
        nodes: {
          mylib: {
            name: 'mylib',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'index.ts',
                  ext: 'ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedPartOfProjectGraph(
        {
          mylib: [
            {
              file: 'index.ts',
              ext: 'ts',
              hash: 'hash1',
            },
          ],
          secondlib: [
            {
              file: 'index.ts',
              ext: 'ts',
              hash: 'hash2',
            },
          ],
        },
        createNxJson({}),
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesDifferentFromCache).toEqual({
        secondlib: [
          {
            file: 'index.ts',
            ext: 'ts',
            hash: 'hash2',
          },
        ],
      });
      expect(r.cachedPartOfProjectGraph).toEqual(cached);
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
                  file: 'index.ts',
                  ext: 'ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        },
        dependencies: { mylib: [] },
      } as any;
      const r = extractCachedPartOfProjectGraph(
        {
          mylib: [
            {
              file: 'index.ts',
              ext: 'ts',
              hash: 'hash2',
            },
          ],
        },
        createNxJson({}),
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesDifferentFromCache).toEqual({
        mylib: [
          {
            file: 'index.ts',
            ext: 'ts',
            hash: 'hash2',
          },
        ],
      });
      expect(r.cachedPartOfProjectGraph).toEqual({
        nodes: {},
        dependencies: {},
      });
    });

    it('should handle cases when implicits change', () => {
      const cached = {
        nodes: {
          mylib: {
            name: 'mylib',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'index.ts',
                  ext: 'ts',
                  hash: 'hash1',
                },
              ],
              implicitDependencies: ['otherlib'],
            },
          },
        },
        dependencies: {
          mylib: [{ type: 'static', source: 'mylib', target: 'otherlib' }],
        },
      } as any;
      const r = extractCachedPartOfProjectGraph(
        {
          mylib: [
            {
              file: 'index.ts',
              ext: 'ts',
              hash: 'hash1',
            },
          ],
        },
        createNxJson({
          projects: {
            mylib: {
              implicitDependencies: [],
            },
          },
        }),
        createCache({
          nodes: { ...cached.nodes },
          dependencies: { ...cached.dependencies },
        })
      );
      expect(r.filesDifferentFromCache).toEqual({
        mylib: [
          {
            file: 'index.ts',
            ext: 'ts',
            hash: 'hash1',
          },
        ],
      });
      expect(r.cachedPartOfProjectGraph).toEqual({
        nodes: {},
        dependencies: {},
      });
    });
  });

  function createCache(p: Partial<ProjectGraphCache>): ProjectGraphCache {
    const defaults: ProjectGraphCache = {
      version: '3.0',
      deps: {
        '@nrwl/workspace': '12.0.0',
        plugin: '1.0.0',
      },
      pathMappings: {
        mylib: ['libs/mylib/index.ts'],
      },
      nxJsonPlugins: [{ name: 'plugin', version: '1.0.0' }],
      nodes: {
        mylib: {} as any,
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
      projects: { mylib: {} },
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
