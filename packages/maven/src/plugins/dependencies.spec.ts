import { createDependencies } from './dependencies';
import { getCurrentMavenData } from './maven-data-cache';
import type { CreateDependenciesContext } from '@nx/devkit';

jest.mock('./maven-data-cache');

describe('createDependencies', () => {
  const context = {
    projects: {
      'koala-common': { name: 'koala-common', root: 'backend/common' },
    },
  } as unknown as CreateDependenciesContext;

  beforeEach(() => jest.clearAllMocks());

  // A cache written by an older plugin is keyed on project hashes alone, so it
  // survives an upgrade and can still hold the Windows-separated paths that
  // version emitted. Without normalizing on read, the project root misses the
  // lookup and `sourceFile` fails validation against Nx's POSIX file map.
  it('should resolve dependencies from OS-separated cached paths', async () => {
    (getCurrentMavenData as jest.Mock).mockReturnValue({
      createNodesResults: [],
      createDependenciesResults: [
        {
          type: 'static',
          source: 'backend\\common',
          target: 'maven:org.springframework:spring-core',
          sourceFile: 'backend\\common\\pom.xml',
        },
      ],
    });

    const dependencies = await createDependencies({}, context);

    expect(dependencies).toEqual([
      {
        type: 'static',
        source: 'koala-common',
        target: 'maven:org.springframework:spring-core',
        sourceFile: 'backend/common/pom.xml',
      },
    ]);
  });

  it('should return no dependencies when the analyzer produced no data', async () => {
    (getCurrentMavenData as jest.Mock).mockReturnValue(null);

    expect(await createDependencies({}, context)).toEqual([]);
  });
});
