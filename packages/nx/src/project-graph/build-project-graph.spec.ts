import { getFileMap, hydrateFileMap } from './build-project-graph';
import type { NxWorkspaceFilesExternals } from '../native';

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
