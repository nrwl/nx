import { createNodes } from './nodes';
import { runMavenAnalysis } from './maven-analyzer';
import { readMavenCache, writeMavenCache } from './maven-data-cache';
import { calculateHashesForCreateNodes } from '@nx/devkit/internal';
import type { CreateNodesContext } from '@nx/devkit';

jest.mock('./maven-analyzer');
jest.mock('./maven-data-cache', () => ({
  ...jest.requireActual('./maven-data-cache'),
  readMavenCache: jest.fn(),
  writeMavenCache: jest.fn(),
}));
jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  calculateHashesForCreateNodes: jest.fn(),
}));

describe('createNodes', () => {
  const [, createNodesFn] = createNodes;

  const workspaceRoot = '/workspace';
  const context = { workspaceRoot } as CreateNodesContext;

  beforeEach(() => {
    jest.clearAllMocks();
    (calculateHashesForCreateNodes as jest.Mock).mockResolvedValue(['hash']);
    (readMavenCache as jest.Mock).mockReturnValue({
      get: () => null,
      set: jest.fn(),
    });
    (writeMavenCache as jest.Mock).mockImplementation(() => {});
  });

  // Nx resolves projects against a `/`-separated file map, so a config file
  // spelled `backend\common\pom.xml` is never found and the graph fails with
  // `Source file "backend\common\pom.xml" does not exist in the workspace.`
  //
  // The backslash below is a separator on Windows and a legal filename
  // character on POSIX, so `relative` returns a Windows-separated path on
  // either host and the assertion pins the conversion on both.
  it('should emit config file paths with forward slashes', async () => {
    (runMavenAnalysis as jest.Mock).mockResolvedValue({
      createNodesResults: [
        [
          `${workspaceRoot}/backend\\common/pom.xml`,
          { projects: { 'backend/common': { root: 'backend/common' } } },
        ],
      ],
      createDependenciesResults: [],
    });

    const results = await createNodesFn(['pom.xml'], {}, context);

    expect(results[0][0]).toBe('backend/common/pom.xml');
  });

  it('should return an empty result when the workspace has no root pom.xml', async () => {
    const results = await createNodesFn(
      ['backend/common/pom.xml'],
      {},
      context
    );

    expect(results).toEqual([]);
    expect(runMavenAnalysis).not.toHaveBeenCalled();
  });
});
