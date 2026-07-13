import * as configuration from '../config/configuration';
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

describe('strict project graph cycle validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports cycles introduced while building the complete project graph', async () => {
    jest.spyOn(configuration, 'readNxJson').mockReturnValue({
      strictProjectGraphCycles: true,
    });

    const result = buildProjectGraphUsingProjectFileMap(
      {
        app1: {
          name: 'app1',
          root: 'app1',
          implicitDependencies: ['lib1'],
        },
        lib1: {
          name: 'lib1',
          root: 'lib1',
          implicitDependencies: ['app1'],
        },
      },
      {},
      {
        projectFileMap: { app1: [], lib1: [] },
        nonProjectFiles: [],
      },
      {} as NxWorkspaceFilesExternals,
      null,
      [],
      {}
    );

    await expect(result).rejects.toMatchObject({
      errors: [
        expect.objectContaining({
          message: expect.stringContaining('app1 -> lib1 -> app1'),
        }),
      ],
      partialProjectGraph: expect.objectContaining({
        nodes: expect.objectContaining({ app1: expect.any(Object) }),
      }),
    });
  });
});
