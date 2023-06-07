import { getNxWorkspaceFiles } from '../index';
import {
  getGlobPatternsFromPackageManagerWorkspaces,
  getGlobPatternsFromPluginsAsync,
  globForProjectFiles,
  Workspaces,
} from '../../config/workspaces';
import { root } from 'postcss';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { fileHasher } from '../../hasher/file-hasher';

import { createProjectFileMap } from '../../project-graph/file-map-utils';
import { workspaceRoot } from '../../utils/workspace-root';

jest.mock('../../utils/workspace-root', () => {
  return {
    workspaceRoot: '/Users/jon/dev/testing/large-monorepo',
  };
});

describe('project graph', () => {
  it('should do something', async () => {
    let root = '/Users/jon/dev/testing/large-monorepo';
    // // let root = '/Users/jon/dev/nx';

    // await fileHasher.ensureInitialized();
    // const projectConfigurations = new Workspaces(
    //   workspaceRoot
    // ).readProjectsConfigurations();
    //
    // const { projectFileMap, allWorkspaceFiles } = createProjectFileMap(
    //   projectConfigurations,
    //   fileHasher.allFileData()
    // );

    // console.log(projectFileMap);
    let nxJson = new Workspaces(root).readNxJson();
    //
    let pluginGlobs = await getGlobPatternsFromPluginsAsync(
      nxJson,
      getNxRequirePaths(root),
      root
    );

    let globs = [
      'project.json',
      '**/project.json',
      ...pluginGlobs,
      ...getGlobPatternsFromPackageManagerWorkspaces(root),
    ];
    let { projectFileMap, configFiles, allWorkspaceFiles } =
      getNxWorkspaceFiles(root, globs);
    console.log(projectFileMap);
  });
});
