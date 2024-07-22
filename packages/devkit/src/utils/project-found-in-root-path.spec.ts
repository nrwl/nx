import { projectFoundInRootPath } from './project-found-in-root-path';
import { CreateNodesContext } from 'nx/src/project-graph/plugins';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

describe('projectFoundInRootPath', () => {
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('workspace-tests');

    context = {
      nxJsonConfiguration: {},
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  describe('project.json', () => {
    it('should be a project if path contains a project.json file', async () => {
      // GIVEN
      const projectRoot = 'apps/my-app';
      await tempFs.createFiles({
        [`${projectRoot}/project.json`]: '{}',
      });
      //TEST
      const projectFound = projectFoundInRootPath(projectRoot, context);
      // EXPECT
      expect(projectFound).toBeTruthy();
    });
  });

  describe('package.json', () => {
    it('should be a project if path contains a package.json file and present in root workspaces', async () => {
      // GIVEN
      const projectRoot = 'apps/my-app';
      await tempFs.createFiles({
        'package.json': `{"workspaces": ["${projectRoot}"]}`,
        [`${projectRoot}/package.json`]: '{}',
      });
      //TEST
      const projectFound = projectFoundInRootPath(projectRoot, context);
      // EXPECT
      expect(projectFound).toBeTruthy();
    });

    it('should not be a project if path contains a package.json file but not present in root workspaces', async () => {
      // GIVEN
      const projectRoot = 'apps/my-app';
      await tempFs.createFiles({
        [`${projectRoot}/package.json`]: '{}',
      });
      //TEST
      const projectFound = projectFoundInRootPath(projectRoot, context);
      // EXPECT
      expect(projectFound).toBeFalsy();
    });
  });

  describe('additionalProjectFile', () => {
    it('should be a project if path contains a custom project file', async () => {
      // GIVEN
      const projectRoot = 'apps/my-app';
      await tempFs.createFiles({
        [`${projectRoot}/my-custom-project-file.json`]: '{}',
      });
      //TEST
      const projectFound = projectFoundInRootPath(projectRoot, context, [
        'my-custom-project-file.json',
      ]);
      // EXPECT
      expect(projectFound).toBeTruthy();
    });

    it('should not be a project if path does not contain a custom project file', async () => {
      // GIVEN
      const projectRoot = 'apps/my-app';
      await tempFs.createFiles({
        [`${projectRoot}/something-else.json`]: '{}',
      });
      //TEST
      const projectFound = projectFoundInRootPath(projectRoot, context, [
        'my-custom-project-file.json',
      ]);
      // EXPECT
      expect(projectFound).toBeFalsy();
    });
  });

  it('should not be a project if path does not contain project.json, package.json or any additional files', () => {
    //TEST
    const projectFound = projectFoundInRootPath('', context);
    // EXPECT
    expect(projectFound).toBeFalsy();
  });
});
