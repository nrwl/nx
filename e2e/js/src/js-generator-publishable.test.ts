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

  it('should update nxJson.release.projects with explicit projects list', async () => {
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
    expect(releaseConfig).toEqual({
      projects: [otherLib, publishableLib1, publishableLib2],
    });
  });
});
