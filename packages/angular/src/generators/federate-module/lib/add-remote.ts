import type { GeneratorCallback, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import remoteGenerator from '../../remote/remote';
import { type Schema } from '../schema';
import { getRemoteIfExists } from './check-remote-exists';

export async function addRemote(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const remote = getRemoteIfExists(tree, schema.remote);

  let projectRoot, remoteName;

  if (!remote) {
    const remoteGeneratorCallback = await remoteGenerator(tree, {
      name: schema.remote,
      directory: schema.remoteDirectory,
      host: schema.host,
      standalone: schema.standalone,
      projectNameAndRootFormat: schema.projectNameAndRootFormat ?? 'derived',
      unitTestRunner: schema.unitTestRunner ?? UnitTestRunner.Jest,
      e2eTestRunner: schema.e2eTestRunner ?? E2eTestRunner.Cypress,
      skipFormat: true,
    });

    tasks.push(remoteGeneratorCallback);
    const { projectName, projectRoot: remoteRoot } =
      await determineProjectNameAndRootOptions(tree, {
        name: schema.remote,
        directory: schema.remoteDirectory,
        projectType: 'application',
        projectNameAndRootFormat: schema.projectNameAndRootFormat ?? 'derived',
        callingGenerator: '@nx/angular:federate-module',
      });

    projectRoot = remoteRoot;
    remoteName = projectName;
  } else {
    projectRoot = remote.root;
    remoteName = remote.name;
  }

  // TODO(Colum): add implicit dependency if the path points to a file in a different project

  return {
    tasks,
    projectRoot,
    remoteName,
  };
}
