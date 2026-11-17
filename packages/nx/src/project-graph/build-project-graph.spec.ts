import { TempFs } from '../internal-testing-utils/temp-fs';
import type { NxWorkspaceFilesExternals } from '../native';
import {
  buildProjectGraphUsingProjectFileMap,
  getFileMap,
  hydrateFileMap,
} from './build-project-graph';

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
  it('records a new catalogs hash when a catalog value changes', async () => {
    const tempFs = new TempFs('build-project-graph-catalogs');
    try {
      await tempFs.createFiles({
        'nx.json': '{}',
        'package.json': JSON.stringify({ name: 'root' }),
        'pnpm-lock.yaml': '',
        'pnpm-workspace.yaml': "catalog:\n  '@org/lib': workspace:*\n",
      });
      const buildCatalogsHash = async () =>
        (
          await buildProjectGraphUsingProjectFileMap(
            {},
            {},
            { nonProjectFiles: [], projectFileMap: {} },
            {} as NxWorkspaceFilesExternals,
            null,
            [],
            {}
          )
        ).projectFileMapCache.catalogsHash;

      const before = await buildCatalogsHash();
      // Same size as the original, so only the file contents tell them apart
      tempFs.createFileSync(
        'pnpm-workspace.yaml',
        "catalog:\n  '@org/lib': workspace:^\n"
      );

      expect(await buildCatalogsHash()).not.toEqual(before);
    } finally {
      tempFs.cleanup();
    }
  });
});
