import {
  formatFiles,
  logger,
  runTasksInSerial,
  stripIndents,
  type Tree,
} from '@nx/devkit';
import { UnitTestRunner } from '../../utils/test-runners';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import {
  addFileToRemoteTsconfig,
  addPathToExposes,
  addPathToTsConfig,
  addRemote,
} from './lib';
import type { Schema } from './schema';

export async function federateModuleGenerator(tree: Tree, schema: Schema) {
  if (!tree.exists(schema.path)) {
    throw new Error(stripIndents`The "path" provided  does not exist. Please verify the path is correct and pointing to a file that exists in the workspace.
    
    Path: ${schema.path}`);
  }

  schema.standalone = schema.standalone ?? true;

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  // federate-module uses webpack/rspack bundlers, so vitest-angular is not available
  schema.unitTestRunner ??=
    angularMajorVersion >= 21
      ? UnitTestRunner.VitestAnalog
      : UnitTestRunner.Jest;

  const { tasks, projectRoot, remoteName } = await addRemote(tree, schema);

  addFileToRemoteTsconfig(tree, remoteName, schema.path);

  addPathToExposes(tree, {
    projectPath: projectRoot,
    modulePath: schema.path,
    moduleName: schema.name,
  });

  addPathToTsConfig(tree, {
    remoteName,
    moduleName: schema.name,
    pathToFile: schema.path,
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.info(
    `✅️ Updated module federation config.
    Now you can use the module from your remote app like this:

    Static import:
    import { MyComponent } from '${remoteName}/${schema.name}';
    
    Dynamic import:
    import('${remoteName}/${schema.name}').then((m) => m.MyComponent);
  `
  );
  return runTasksInSerial(...tasks);
}

export default federateModuleGenerator;
