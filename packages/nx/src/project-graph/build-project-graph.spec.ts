import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { TempFs } from '../internal-testing-utils/temp-fs';
import type { NxWorkspaceFilesExternals } from '../native';
import { buildExplicitDependencies } from '../plugins/js/project-graph/build-dependencies/build-dependencies';
import {
  buildProjectGraphUsingProjectFileMap,
  getFileMap,
  hydrateFileMap,
} from './build-project-graph';
import type { FileMapCache } from './nx-deps-cache';
import { LoadedNxPlugin } from './plugins/loaded-nx-plugin';

describe('hydrateFileMap', () => {
  const fileMap = {
    projectFileMap: { app: [{ file: 'app/index.ts', hash: 'h1' }] },
    nonProjectFiles: [{ file: 'package.json', hash: 'h2' }],
  };
  // Sentinel stands in for a napi External — only its identity is asserted.
  const rustReferences = {
    __sentinel: 'externals',
  } as unknown as NxWorkspaceFilesExternals;

  it('stores rustReferences from the new 2-arg form', () => {
    hydrateFileMap(fileMap, rustReferences);
    expect(getFileMap().rustReferences).toBe(rustReferences);
  });

  it('survives legacy 3-arg form from cached nx-cloud workers', () => {
    const legacyAllWorkspaceFiles = [
      { file: 'app/index.ts', hash: 'h1' },
      { file: 'package.json', hash: 'h2' },
    ];
    (hydrateFileMap as any)(fileMap, legacyAllWorkspaceFiles, rustReferences);
    expect(getFileMap().rustReferences).toBe(rustReferences);
  });

  it('exposes allWorkspaceFiles on getFileMap so legacy destructuring callers see []', () => {
    hydrateFileMap(fileMap, rustReferences);
    expect((getFileMap() as any).allWorkspaceFiles).toEqual([]);
  });
});

describe('buildProjectGraphUsingProjectFileMap', () => {
  it('recomputes cached dependencies when a catalog value changes', async () => {
    const tempFs = new TempFs('build-project-graph-catalogs');
    try {
      await tempFs.createFiles({
        'nx.json': '{}',
        'package.json': JSON.stringify({ name: 'root' }),
        'pnpm-lock.yaml': '',
        'pnpm-workspace.yaml': "catalog:\n  '@org/lib-a': ^1.0.0\n",
        'libs/lib-a/package.json': JSON.stringify({
          name: '@org/lib-a',
          version: '1.0.0',
        }),
        'libs/lib-b/package.json': JSON.stringify({
          name: '@org/lib-b',
          dependencies: { '@org/lib-a': 'catalog:' },
        }),
      });
      const projectRootMap: Record<string, ProjectConfiguration> = {};
      for (const name of ['lib-a', 'lib-b']) {
        projectRootMap[`libs/${name}`] = {
          name,
          root: `libs/${name}`,
          metadata: {
            js: { packageName: `@org/${name}`, packageVersion: '1.0.0' },
          },
        };
      }
      const packageJsonDependencies = new LoadedNxPlugin(
        {
          name: 'package-json-dependencies',
          createDependencies: (_, ctx) =>
            buildExplicitDependencies({ analyzeSourceFiles: false }, ctx),
        },
        'package-json-dependencies'
      );
      const build = (fileMapCache: FileMapCache | null) =>
        buildProjectGraphUsingProjectFileMap(
          projectRootMap,
          {},
          {
            nonProjectFiles: [],
            projectFileMap: {
              'lib-a': [{ file: 'libs/lib-a/package.json', hash: 'lib-a' }],
              'lib-b': [{ file: 'libs/lib-b/package.json', hash: 'lib-b' }],
            },
          },
          {} as NxWorkspaceFilesExternals,
          fileMapCache,
          [packageJsonDependencies],
          {}
        );

      const first = await build(null);
      expect(first.projectGraph.dependencies['lib-b']).toEqual([
        { source: 'lib-b', target: 'lib-a', type: 'static' },
      ]);

      // Same size as the original, so only the file contents tell them apart
      tempFs.createFileSync(
        'pnpm-workspace.yaml',
        "catalog:\n  '@org/lib-a': ^2.0.0\n"
      );

      const second = await build(first.projectFileMapCache);
      expect(second.projectGraph.dependencies['lib-b']).toEqual([]);
    } finally {
      tempFs.cleanup();
    }
  });
});
