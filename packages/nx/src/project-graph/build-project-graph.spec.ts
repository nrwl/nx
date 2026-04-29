import { getFileMap, hydrateFileMap } from './build-project-graph';
import type { NxWorkspaceFilesExternals } from '../native';

describe('hydrateFileMap', () => {
  const fileMap = {
    projectFileMap: { app: [{ file: 'app/index.ts', hash: 'h1' }] },
    nonProjectFiles: [{ file: 'package.json', hash: 'h2' }],
  };
  // Real nx-cloud workers pass napi `External<...>` instances; for unit-test
  // purposes any non-array sentinel verifies it lands in the rustReferences slot.
  const rustReferences = {
    __sentinel: 'externals',
  } as unknown as NxWorkspaceFilesExternals;

  it('stores rustReferences from the new 2-arg form', () => {
    hydrateFileMap(fileMap, rustReferences);
    expect(getFileMap().rustReferences).toBe(rustReferences);
  });

  // Pre-#34425 nx-cloud V4 workers (cached at .nx/cache/cloud/<ver>/.../discrete-task-worker.js)
  // call hydrateFileMap(fileMap, allWorkspaceFiles, rustReferences). Without back-compat
  // this poisons storedRustReferences with the FileData[] array, which later trips
  // "Failed to get external value" inside NativeTaskHasherImpl.
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
