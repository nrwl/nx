import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateJson,
} from '../../utils';

describe('js:generators:publishable', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject({
      name: uniq('js_generators_publishable'),
      packages: ['@nx/js'],
    });
  });

  afterAll(() => cleanupProject());

  it('should not add release config when it does not exist', async () => {
    const otherLib = uniq('other-lib');
    const publishableLib1 = uniq('publishable-lib1');
    const publishableLib2 = uniq('publishable-lib2');

    updateJson('nx.json', (json) => {
      delete json.release;
      return json;
    });

    runCLI(`generate @nx/js:lib ${otherLib} --no-interactive`);

    runCLI(
      `generate @nx/js:lib ${publishableLib1} --publishable --importPath=@scope/publishable-lib-1 --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib ${publishableLib2} --publishable --importPath=@scope/publishable-lib-2 --no-interactive`
    );

    const releaseConfig = readJson('nx.json').release;
    expect(releaseConfig).toBeUndefined();
  });

  it('should update nxJson.release.projects when it has an explicit projects list', async () => {
    const otherLib = uniq('other-lib');
    const publishableLib3 = uniq('publishable-lib3');
    const publishableLib4 = uniq('publishable-lib4');

    updateJson('nx.json', (json) => {
      json.release = {
        projects: [publishableLib3],
      };
      return json;
    });

    runCLI(`generate @nx/js:lib ${otherLib} --no-interactive`);

    runCLI(
      `generate @nx/js:lib ${publishableLib3} --publishable --importPath=@scope/publishable-lib-3 --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib ${publishableLib4} --publishable --importPath=@scope/publishable-lib-4 --no-interactive`
    );

    const releaseConfig = readJson('nx.json').release;
    expect(releaseConfig).toEqual({
      projects: [publishableLib3, publishableLib4],
    });
  });
});
