import {
  GeneratorCallback,
  Tree,
  formatFiles,
  logger,
  readJson,
  runTasksInSerial,
  stripIndents,
} from '@nx/devkit';
import { Schema } from './schema';

import { remoteGeneratorInternal } from '../remote/remote';
import { addPathToExposes, checkRemoteExists } from './lib/utils';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { addTsConfigPath, getRootTsConfigPathInTree } from '@nx/js';

export async function federateModuleGenerator(tree: Tree, schema: Schema) {
  // Check if the file exists
  if (!tree.exists(schema.path)) {
    throw new Error(stripIndents`The "path" provided  does not exist. Please verify the path is correct and pointing to a file that exists in the workspace.
    
    Path: ${schema.path}`);
  }
  const tasks: GeneratorCallback[] = [];
  // Check remote exists
  const remote = checkRemoteExists(tree, schema.remote);

  let projectRoot, remoteName;

  if (!remote) {
    // create remote
    const remoteGenerator = await remoteGeneratorInternal(tree, {
      name: schema.remote,
      directory: schema.remoteDirectory,
      e2eTestRunner: schema.e2eTestRunner,
      skipFormat: schema.skipFormat,
      linter: schema.linter,
      style: schema.style,
      unitTestRunner: schema.unitTestRunner,
      host: schema.host,
      projectNameAndRootFormat: schema.projectNameAndRootFormat ?? 'derived',
    });

    tasks.push(remoteGenerator);

    const { projectName, projectRoot: remoteRoot } =
      await determineProjectNameAndRootOptions(tree, {
        name: schema.remote,
        directory: schema.remoteDirectory,
        projectType: 'application',
        projectNameAndRootFormat: schema.projectNameAndRootFormat ?? 'derived',
        callingGenerator: '@nx/react:federate-module',
      });

    projectRoot = remoteRoot;
    remoteName = projectName;
  } else {
    projectRoot = remote.root;
    remoteName = remote.name;
  }

  // add path to exposes property
  addPathToExposes(tree, projectRoot, schema.name, schema.path);

  // Add new path to tsconfig
  const rootJSON = readJson(tree, getRootTsConfigPathInTree(tree));
  if (!rootJSON?.compilerOptions?.paths[`${remoteName}/${schema.name}`]) {
    addTsConfigPath(tree, `${remoteName}/${schema.name}`, [schema.path]);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.info(
    `✅️ Updated module federation config.
    Now you can use the module from your host app like this:

    Static import:
    import { MyComponent } from '${schema.name}/${remoteName}';
    
    Dynamic import:
    import('${schema.name}/${remoteName}').then((m) => m.${remoteName});
  `
  );
  return runTasksInSerial(...tasks);
}

export default federateModuleGenerator;
