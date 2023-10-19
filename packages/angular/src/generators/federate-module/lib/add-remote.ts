import { GeneratorCallback, stripIndents, type Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { lt } from 'semver';
import { getRemoteIfExists } from './check-remote-exists';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { type Schema } from '../schema';
import remoteGenerator from '../../remote/remote';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';

export async function addRemote(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const remote = getRemoteIfExists(tree, schema.remote);

  let projectRoot, remoteName;

  if (!remote) {
    const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

    if (
      lt(installedAngularVersionInfo.version, '14.1.0') &&
      schema.standalone
    ) {
      throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
    }

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
