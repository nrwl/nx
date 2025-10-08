import {
  cleanupProject,
  exists,
  readJson,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupWorkspaceTests } from './workspace-setup';

describe('remove project', () => {
  let proj: string;

  beforeAll(() => {
    proj = setupWorkspaceTests();
  });

  afterAll(() => cleanupProject());

  /**
   * Tries creating then deleting a lib
   */
  it('should work', async () => {
    const lib1 = uniq('myliba');
    const lib2 = uniq('mylibb');

    runCLI(
      `generate @nx/js:lib ${lib1} --unitTestRunner=jest --directory=libs/${lib1}`
    );
    expect(exists(tmpProjPath(`libs/${lib1}`))).toBeTruthy();

    /**
     * Create a library which has an implicit dependency on lib1
     */

    runCLI(`generate @nx/js:lib libs/${lib2} --unitTestRunner=jest`);
    updateFile(join('libs', lib2, 'project.json'), (content) => {
      const data = JSON.parse(content);
      data.implicitDependencies = [lib1];
      return JSON.stringify(data, null, 2);
    });

    /**
     * Try removing the project (should fail)
     */

    let error;
    try {
      console.log(runCLI(`generate @nx/workspace:remove --project ${lib1}`));
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.stdout.toString()).toContain(
      `${lib1} is still a dependency of the following projects`
    );
    expect(error.stdout.toString()).toContain(lib2);

    /**
     * Try force removing the project
     */

    const removeOutputForced = runCLI(
      `generate @nx/workspace:remove --project ${lib1} --forceRemove`
    );

    expect(removeOutputForced).toContain(`DELETE libs/${lib1}`);
    expect(exists(tmpProjPath(`libs/${lib1}`))).toBeFalsy();

    expect(removeOutputForced).not.toContain(`UPDATE nx.json`);
    const projects = runCLI('show projects').split('\n');
    expect(projects).not.toContain(lib1);
    const lib2Config = readJson(join('libs', lib2, 'project.json'));
    expect(lib2Config.implicitDependencies).toEqual([]);

    expect(projects[`${lib1}`]).toBeUndefined();
  });
});
